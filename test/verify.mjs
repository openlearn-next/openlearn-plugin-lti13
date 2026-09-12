import assert from 'node:assert';
import { generateRsaKeyPair, exportPublicKeyToJwks, signJwtRs256, verifyJwtRs256, decodeJwtUnverified } from '../src/crypto.js';

console.log('🧪 Starting LTI 1.3 Crypto & JWT Verification...');

// 1. 测试 RSA 密钥生成与 JWKS 导出
const { publicKey, privateKey, kid } = generateRsaKeyPair();
assert.ok(publicKey.includes('BEGIN PUBLIC KEY'), 'Public key must be PEM format');
assert.ok(privateKey.includes('BEGIN PRIVATE KEY'), 'Private key must be PEM format');
assert.ok(kid.startsWith('openlearn-lti13-'), 'Key ID must have prefix');

const jwks = exportPublicKeyToJwks(publicKey, kid);
assert.equal(jwks.keys.length, 1, 'JWKS must contain 1 key');
assert.equal(jwks.keys[0].kty, 'RSA', 'Key type must be RSA');
assert.equal(jwks.keys[0].alg, 'RS256', 'Alg must be RS256');
assert.equal(jwks.keys[0].use, 'sig', 'Use must be sig');
assert.equal(jwks.keys[0].kid, kid, 'Key ID must match');
assert.ok(jwks.keys[0].n && jwks.keys[0].e, 'Modulus and Exponent must exist');
console.log('✅ RSA Key generation & JWKS export verified.');

// 2. 测试 RS256 签名与验签
const payload = {
  iss: 'https://canvas.instructure.com',
  sub: 'user_45678',
  aud: 'client_openlearn_123',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  nonce: 'test_nonce_abcdef',
  name: 'Alice Wonder',
  email: 'alice@example.edu',
  'https://purl.imsglobal.org/spec/lti/claim/roles': [
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'
  ]
};

const token = signJwtRs256(payload, privateKey, kid);
assert.ok(token && token.split('.').length === 3, 'JWT must have 3 segments');

const decodedUnverified = decodeJwtUnverified(token);
assert.equal(decodedUnverified.header.kid, kid);
assert.equal(decodedUnverified.payload.sub, 'user_45678');
assert.equal(decodedUnverified.payload.nonce, 'test_nonce_abcdef');

const verified = verifyJwtRs256(token, publicKey);
assert.equal(verified.sub, 'user_45678');
assert.equal(verified.email, 'alice@example.edu');
console.log('✅ RS256 JWT signature & verification passed.');

// 3. 测试篡改防御与防过期
const tamperedToken = token.slice(0, -4) + 'abcd';
assert.throws(() => {
  verifyJwtRs256(tamperedToken, publicKey);
}, /Invalid JWT signature/, 'Tampered token must be rejected');

const expiredToken = signJwtRs256({ ...payload, exp: Math.floor(Date.now() / 1000) - 10 }, privateKey, kid);
assert.throws(() => {
  verifyJwtRs256(expiredToken, publicKey);
}, /JWT token has expired/, 'Expired token must be rejected');

console.log('✅ Security guard against tampering & expiration verified.');

console.log('\n🎉 ALL CRYPTO VERIFICATION TESTS PASSED SUCCESSFULLY!');
