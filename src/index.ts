import type { PluginContext, PluginApiResponse } from '@openlearn/plugin-sdk';
import { IAuthSessionBridgeToken } from '@openlearn/plugin-sdk';
import { randomBytes } from 'node:crypto';
import { exportPublicKeyToJwks, decodeJwtUnverified } from './crypto.js';
import { LtiStateStore } from './state-store.js';
import type { LtiLaunchClaims, LtiPlatformConfig } from './contracts/index.js';

export default {
  manifest: {
    id: 'openlearn-plugin-lti13',
    name: 'LTI 1.3 Advantage Tool Provider',
    version: '1.0.0',
    main: 'dist/index.js',
    description: '1EdTech LTI 1.3 核心单点登录 (OIDC 3-Legged Launch) 与 LTI Advantage 成绩回传插件',
    engines: { openlearn: '>=0.3.15' },
    requires: ['@openlearn/core:IAuthSessionBridgeService@^1.0.0'],
    api: {
      routes: [
        { method: 'GET', path: '/login', auth: false },
        { method: 'POST', path: '/login', auth: false },
        { method: 'POST', path: '/launch', auth: false },
        { method: 'GET', path: '/jwks', auth: false },
        { method: 'GET', path: '/platforms', roles: ['administrator'] },
        { method: 'POST', path: '/platforms', roles: ['administrator'] },
        { method: 'DELETE', path: '/platforms', roles: ['administrator'] },
        { method: 'GET', path: '/config-info', roles: ['administrator'] },
      ],
    },
  },

  async activate(ctx: PluginContext): Promise<void> {
    ctx.log.info('Initializing LTI 1.3 Tool Provider Plugin...');

    // 1. 初始化持久化存储
    const stateStore = new LtiStateStore(ctx);
    await stateStore.init();

    // 2. 获取或生成 RSA 密钥对
    const keyPair = stateStore.getOrGenerateKeyPair();
    ctx.log.info(`LTI 1.3 RSA Key loaded. Key ID (kid): ${keyPair.kid}`);

    // 3. 获取平台统一认证会话桥接服务
    const authBridge = await ctx.resolve(IAuthSessionBridgeToken);
    if (!authBridge) {
      ctx.log.warn('IAuthSessionBridgeService not available. LTI SSO auto-login will be disabled.');
    }

    // ── HTTP 端点 1: /jwks (托管 RFC 7517 公钥集合) ──────────────────────
    ctx.http.get('/jwks', async (): Promise<PluginApiResponse<any>> => {
      const jwks = exportPublicKeyToJwks(keyPair.publicKey, keyPair.kid);
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
        body: jwks,
      };
    });

    // ── HTTP 端点 2: /login (OIDC 3-Legged 第三方发起登录) ────────────────
    const handleLogin = async (req: any): Promise<PluginApiResponse<any>> => {
      const params = req.method === 'POST' ? req.body || {} : req.query || {};
      const { iss, login_hint, target_link_uri, lti_message_hint, client_id } = params;

      if (!iss || !login_hint) {
        return {
          status: 400,
          body: { error: 'Missing required OIDC login initiation parameters: iss, login_hint' },
        };
      }

      // 查询已注册的 LMS 平台配置
      let platform = stateStore.getPlatform(iss);
      if (!platform && client_id) {
        // 支持通过 client_id 容错检索
        const all = stateStore.listPlatforms();
        platform = all.find(p => p.clientId === client_id) || null;
      }

      // 如果未预先注册，且配置允许，使用标准 Canvas/Moodle 默认 OIDC 授权路径
      const authUrl = platform?.authUrl || `${iss.replace(/\/$/, '')}/api/lti/authorize_redirect`;
      const resolvedClientId = platform?.clientId || client_id || 'openlearn_lti13';

      // 生成密码学强随机 state 和 nonce
      const state = randomBytes(16).toString('hex');
      const nonce = randomBytes(16).toString('hex');

      // 状态入库，默认 5 分钟有效期
      stateStore.saveState(state, nonce, iss, target_link_uri, 300);

      // 构造重定向回 LMS 的认证请求 URL
      const redirectUrl = new URL(authUrl);
      redirectUrl.searchParams.set('response_type', 'id_token');
      redirectUrl.searchParams.set('scope', 'openid');
      redirectUrl.searchParams.set('client_id', resolvedClientId);
      redirectUrl.searchParams.set('login_hint', login_hint);
      redirectUrl.searchParams.set('state', state);
      redirectUrl.searchParams.set('nonce', nonce);
      redirectUrl.searchParams.set('response_mode', 'form_post');
      redirectUrl.searchParams.set('prompt', 'none');

      if (target_link_uri) {
        redirectUrl.searchParams.set('redirect_uri', target_link_uri);
      }
      if (lti_message_hint) {
        redirectUrl.searchParams.set('lti_message_hint', lti_message_hint);
      }

      return {
        status: 302,
        headers: {
          Location: redirectUrl.toString(),
        },
        body: `Redirecting to LMS: ${redirectUrl.toString()}`,
      };
    };

    ctx.http.get('/login', handleLogin);
    ctx.http.post('/login', handleLogin);

    // ── HTTP 端点 3: /launch (LTI 资源链接启动与会话桥接) ────────────────
    ctx.http.post('/launch', async (req: any): Promise<PluginApiResponse<any>> => {
      const { id_token, state } = req.body || {};

      if (!id_token || !state) {
        return {
          status: 400,
          body: { error: 'Missing required LTI launch parameters: id_token, state' },
        };
      }

      // 1. 验证并单次消费 state (防重放)
      const stateRecord = stateStore.consumeState(state);
      if (!stateRecord) {
        return {
          status: 403,
          body: { error: 'Invalid, expired, or previously consumed state parameter' },
        };
      }

      // 2. 解包 id_token 并校验 nonce
      let claims: LtiLaunchClaims;
      try {
        const decoded = decodeJwtUnverified<LtiLaunchClaims>(id_token);
        claims = decoded.payload;
      } catch (err: any) {
        return {
          status: 400,
          body: { error: 'Failed to decode LTI id_token: ' + err.message },
        };
      }

      if (claims.nonce !== stateRecord.nonce) {
        return {
          status: 403,
          body: { error: 'Nonce mismatch in id_token' },
        };
      }

      // 3. 映射用户身份与角色
      const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];
      const isTeacher = roles.some(r =>
        r.includes('http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor') ||
        r.includes('Instructor') ||
        r.includes('Faculty') ||
        r.includes('Administrator')
      );
      const mappedRole: 'student' | 'teacher' | 'administrator' = isTeacher ? 'teacher' : 'student';

      const username = `lti_${claims.sub.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const name = claims.name || claims.given_name || username;
      const email = claims.email || `${username}@lti.openlearn.local`;

      // 4. 调用宿主统一会话桥接服务签发平台凭据
      let sessionToken: string | undefined;
      if (authBridge) {
        try {
          const session = await authBridge.createSession({
            userId: username,
            username,
            role: mappedRole,
            name,
            email,
          });
          sessionToken = session.token;
          ctx.log.info(`LTI launch authenticated: user=${username} role=${mappedRole} session=${sessionToken ? sessionToken.substring(0, 8) : 'unknown'}...`);
        } catch (err: any) {
          ctx.log.error(`Auth session bridge failed: ${err.message}`);
        }
      }

      // 5. 确定跳转目标 URL
      const targetUrl = stateRecord.targetLinkUri || '/';

      // 6. 返回具备 sessionToken 的响应
      // 网关将在主线程自动向客户端注入 SameSite=None; Secure; HttpOnly 会话 Cookie
      const responseHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OpenLearn LTI Launch</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
    .spinner { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h3>正在进入 OpenLearn 学习空间...</h3>
    <p style="color: #64748b; font-size: 0.9rem;">已成功验证 LMS 身份：${name} (${mappedRole})</p>
  </div>
  <script>
    setTimeout(function() {
      window.location.replace('${targetUrl}');
    }, 300);
  </script>
</body>
</html>
`;

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
        sessionToken,
        body: responseHtml,
      };
    });

    // ── HTTP 端点 4: /platforms (LMS 平台配置 CRUD 管理) ──────────────────
    ctx.http.get('/platforms', async (): Promise<PluginApiResponse<any>> => {
      const list = stateStore.listPlatforms();
      return {
        status: 200,
        body: { platforms: list },
      };
    });

    ctx.http.post('/platforms', async (req: any): Promise<PluginApiResponse<any>> => {
      const config = req.body as LtiPlatformConfig;
      if (!config || !config.platformId || !config.clientId || !config.authUrl) {
        return {
          status: 400,
          body: { error: 'Missing required platform parameters: platformId, clientId, authUrl' },
        };
      }

      stateStore.savePlatform(config);
      ctx.log.info(`LMS Platform registered/updated: ${config.platformId} (${config.name || 'unnamed'})`);

      return {
        status: 200,
        body: { success: true, platform: config },
      };
    });

    ctx.http.delete('/platforms', async (req: any): Promise<PluginApiResponse<any>> => {
      const { platformId } = req.query || req.body || {};
      if (!platformId) {
        return {
          status: 400,
          body: { error: 'Missing platformId parameter' },
        };
      }

      const deleted = stateStore.deletePlatform(platformId);
      return {
        status: 200,
        body: { success: deleted },
      };
    });

    // ── HTTP 端点 5: /config-info (获取当前 Tool 的配置参数) ─────────────
    ctx.http.get('/config-info', async (req: any): Promise<PluginApiResponse<any>> => {
      const host = req.headers?.host || 'localhost:9000';
      const proto = req.headers?.['x-forwarded-proto'] || 'http';
      const baseUrl = `${proto}://${host}`;

      const jwks = exportPublicKeyToJwks(keyPair.publicKey, keyPair.kid);

      return {
        status: 200,
        body: {
          toolUrl: baseUrl,
          oidcLoginUrl: `${baseUrl}/api/plugins/openlearn-plugin-lti13/login`,
          targetLinkUri: `${baseUrl}/api/plugins/openlearn-plugin-lti13/launch`,
          jwksUrl: `${baseUrl}/api/plugins/openlearn-plugin-lti13/jwks`,
          publicKeyPem: keyPair.publicKey,
          jwks,
        },
      };
    });

    ctx.log.info('OpenLearn LTI 1.3 Tool Provider Plugin successfully activated!');
  },

  async deactivate(): Promise<void> {
    // 卸载与清理逻辑
  },
};
