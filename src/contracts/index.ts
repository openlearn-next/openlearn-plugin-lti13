/**
 * OpenLearn LTI 1.3 Advantage 跨端数据契约与接口定义
 */

export interface LtiPlatformConfig {
  /** LMS 平台唯一 Issuer 标识 (e.g. https://canvas.instructure.com) */
  platformId: string;
  /** LMS 分配给本 Tool 的客户端 Client ID (e.g. 10000000000001) */
  clientId: string;
  /** LMS 部署 ID (Deployment ID) */
  deploymentId: string;
  /** LMS OIDC 认证重定向端点 (e.g. https://canvas.instructure.com/api/lti/authorize_redirect) */
  authUrl: string;
  /** LMS 公钥集合端点 (JWKS URL，用于拉取 LMS 公钥并校验 id_token) */
  jwksUrl: string;
  /** 平台可读显示名称 (e.g. "本部 Canvas LMS") */
  name?: string;
  /** 创建时间戳 */
  createdAt?: number;
}

export interface LtiOidcLoginRequest {
  iss: string;
  login_hint: string;
  target_link_uri?: string;
  lti_message_hint?: string;
  client_id?: string;
  deployment_id?: string;
}

export interface LtiLaunchClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  'https://purl.imsglobal.org/spec/lti/claim/message_type'?: string;
  'https://purl.imsglobal.org/spec/lti/claim/version'?: string;
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id'?: string;
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri'?: string;
  'https://purl.imsglobal.org/spec/lti/claim/roles'?: string[];
  'https://purl.imsglobal.org/spec/lti/claim/context'?: {
    id: string;
    label?: string;
    title?: string;
  };
  'https://purl.imsglobal.org/spec/lti/claim/resource_link'?: {
    id: string;
    title?: string;
  };
  'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'?: {
    scope: string[];
    lineitems?: string;
    lineitem?: string;
  };
}

export interface LtiStateRecord {
  state: string;
  nonce: string;
  platformId: string;
  targetLinkUri?: string;
  expiresAt: number;
}

export interface LtiToolConfigInfo {
  toolUrl: string;
  oidcLoginUrl: string;
  targetLinkUri: string;
  jwksUrl: string;
  publicKeyPem: string;
  jwks: {
    keys: Array<{
      kty: string;
      use: string;
      alg: string;
      kid: string;
      n: string;
      e: string;
    }>;
  };
}
