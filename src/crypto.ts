import { generateKeyPairSync, createSign, createVerify, createPublicKey, randomBytes } from 'node:crypto';

export interface JwkKey {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export interface JwksResponse {
  keys: JwkKey[];
}

/**
 * 原生生成 2048 位 RSA 密钥对 (PEM 格式)
 */
export function generateRsaKeyPair(): { publicKey: string; privateKey: string; kid: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const kid = 'openlearn-lti13-' + randomBytes(4).toString('hex');
  return { publicKey, privateKey, kid };
}

/**
 * 将 PEM 公钥导出为 RFC 7517 标准的 JWKS (JSON Web Key Set)
 */
export function exportPublicKeyToJwks(publicKeyPem: string, kid: string): JwksResponse {
  const keyObj = createPublicKey(publicKeyPem);
  const jwk = keyObj.export({ format: 'jwk' });

  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid,
        n: jwk.n || '',
        e: jwk.e || '',
      },
    ],
  };
}

/**
 * 使用原生 crypto 库对载荷进行 RS256 签名
 */
export function signJwtRs256(payload: Record<string, unknown>, privateKeyPem: string, kid: string): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(dataToSign);
  const signature = signer.sign(privateKeyPem);
  const encodedSignature = base64UrlEncode(signature);

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * 无需验签解包 JWT (用于提前获取 iss / kid)
 */
export function decodeJwtUnverified<T = any>(token: string): { header: any; payload: T } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT: Expected 3 parts separated by dots');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1])) as T;
  return { header, payload };
}

/**
 * 使用指定的公钥验签 RS256 JWT
 */
export function verifyJwtRs256<T = any>(token: string, publicKeyPem: string): T {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const dataToVerify = `${parts[0]}.${parts[1]}`;
  const signatureBuffer = Buffer.from(base64UrlUnescape(parts[2]), 'base64');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(dataToVerify);
  const isValid = verifier.verify(publicKeyPem, signatureBuffer);

  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  const payload = JSON.parse(base64UrlDecode(parts[1])) as T;

  // 校验 exp
  const now = Math.floor(Date.now() / 1000);
  if ((payload as any).exp && (payload as any).exp < now) {
    throw new Error('JWT token has expired');
  }

  return payload;
}

// ── Base64URL 工具函数 ──────────────────────────────────────────────────

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(base64UrlUnescape(input), 'base64').toString('utf-8');
}

function base64UrlUnescape(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}
