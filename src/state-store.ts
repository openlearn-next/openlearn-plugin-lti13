import type { PluginContext } from '@openlearn/plugin-sdk';
import { IDatabaseToken } from '@openlearn/plugin-sdk';
import { generateRsaKeyPair } from './crypto.js';
import type { LtiPlatformConfig, LtiStateRecord } from './contracts/index.js';

export interface StoredKeyPair {
  publicKey: string;
  privateKey: string;
  kid: string;
}

export class LtiStateStore {
  private keysTable = '';
  private platformsTable = '';
  private statesTable = '';
  private db: any = null;

  constructor(private ctx: PluginContext) {}

  /**
   * 初始化 LTI 插件所需的数据表与底层连接
   */
  async init(): Promise<void> {
    await this.ctx.db.ensureTable(
      'keys',
      'id INTEGER PRIMARY KEY CHECK (id = 1), kid TEXT NOT NULL, public_key TEXT NOT NULL, private_key TEXT NOT NULL, created_at INTEGER NOT NULL'
    );
    await this.ctx.db.ensureTable(
      'platforms',
      'platform_id TEXT PRIMARY KEY, client_id TEXT NOT NULL, deployment_id TEXT NOT NULL, auth_url TEXT NOT NULL, jwks_url TEXT NOT NULL, name TEXT, created_at INTEGER NOT NULL'
    );
    await this.ctx.db.ensureTable(
      'states',
      'state TEXT PRIMARY KEY, nonce TEXT NOT NULL, platform_id TEXT NOT NULL, target_link_uri TEXT, expires_at INTEGER NOT NULL'
    );

    this.keysTable = this.ctx.db.table('keys');
    this.platformsTable = this.ctx.db.table('platforms');
    this.statesTable = this.ctx.db.table('states');

    // 解析平台底层的 SQLite 数据库服务
    this.db = (this.ctx as any).services?.db || (await this.ctx.resolve(IDatabaseToken));
  }

  /**
   * 获取或初始化持久化的 RSA 密钥对
   */
  getOrGenerateKeyPair(): StoredKeyPair {
    const row = this.db.prepare(`SELECT kid, public_key, private_key FROM ${this.keysTable} WHERE id = 1`).get() as {
      kid: string;
      public_key: string;
      private_key: string;
    } | undefined;

    if (row) {
      return {
        kid: row.kid,
        publicKey: row.public_key,
        privateKey: row.private_key,
      };
    }

    const { publicKey, privateKey, kid } = generateRsaKeyPair();
    this.db
      .prepare(`INSERT INTO ${this.keysTable} (id, kid, public_key, private_key, created_at) VALUES (1, ?, ?, ?, ?)`)
      .run(kid, publicKey, privateKey, Date.now());

    return { publicKey, privateKey, kid };
  }

  /**
   * 保存或更新 LMS 平台配置
   */
  savePlatform(config: LtiPlatformConfig): void {
    this.db
      .prepare(`
        INSERT INTO ${this.platformsTable} (platform_id, client_id, deployment_id, auth_url, jwks_url, name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(platform_id) DO UPDATE SET
          client_id = excluded.client_id,
          deployment_id = excluded.deployment_id,
          auth_url = excluded.auth_url,
          jwks_url = excluded.jwks_url,
          name = excluded.name;
      `)
      .run(
        config.platformId,
        config.clientId,
        config.deploymentId,
        config.authUrl,
        config.jwksUrl,
        config.name || null,
        config.createdAt || Date.now()
      );
  }

  /**
   * 获取指定平台配置
   */
  getPlatform(platformId: string): LtiPlatformConfig | null {
    const row = this.db
      .prepare(`SELECT platform_id, client_id, deployment_id, auth_url, jwks_url, name, created_at FROM ${this.platformsTable} WHERE platform_id = ?`)
      .get(platformId) as any;

    if (!row) return null;

    return {
      platformId: row.platform_id,
      clientId: row.client_id,
      deploymentId: row.deployment_id,
      authUrl: row.auth_url,
      jwksUrl: row.jwks_url,
      name: row.name || undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * 获取所有注册的 LMS 平台列表
   */
  listPlatforms(): LtiPlatformConfig[] {
    const rows = this.db
      .prepare(`SELECT platform_id, client_id, deployment_id, auth_url, jwks_url, name, created_at FROM ${this.platformsTable} ORDER BY created_at DESC`)
      .all() as any[];

    return rows.map(row => ({
      platformId: row.platform_id,
      clientId: row.client_id,
      deploymentId: row.deployment_id,
      authUrl: row.auth_url,
      jwksUrl: row.jwks_url,
      name: row.name || undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * 删除指定的 LMS 平台
   */
  deletePlatform(platformId: string): boolean {
    const result = this.db.prepare(`DELETE FROM ${this.platformsTable} WHERE platform_id = ?`).run(platformId);
    return result.changes > 0;
  }

  /**
   * 存储一次性 State & Nonce（默认 5 分钟有效期）
   */
  saveState(state: string, nonce: string, platformId: string, targetLinkUri?: string, ttlSeconds = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.db
      .prepare(`INSERT INTO ${this.statesTable} (state, nonce, platform_id, target_link_uri, expires_at) VALUES (?, ?, ?, ?, ?)`)
      .run(state, nonce, platformId, targetLinkUri || null, expiresAt);

    // 顺便清理已过期的历史 states
    this.db.prepare(`DELETE FROM ${this.statesTable} WHERE expires_at < ?`).run(Date.now());
  }

  /**
   * 一次性消费 State（立即删除防重放）
   */
  consumeState(state: string): LtiStateRecord | null {
    const row = this.db
      .prepare(`SELECT state, nonce, platform_id, target_link_uri, expires_at FROM ${this.statesTable} WHERE state = ?`)
      .get(state) as any;

    if (!row) return null;

    // 立即从数据库中删除，确保不可重放
    this.db.prepare(`DELETE FROM ${this.statesTable} WHERE state = ?`).run(state);

    if (row.expires_at < Date.now()) {
      return null; // 已过期
    }

    return {
      state: row.state,
      nonce: row.nonce,
      platformId: row.platform_id,
      targetLinkUri: row.target_link_uri || undefined,
      expiresAt: row.expires_at,
    };
  }
}
