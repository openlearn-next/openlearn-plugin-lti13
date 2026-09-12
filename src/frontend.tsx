import React, { useState, useEffect } from 'react';
import type { LtiPlatformConfig, LtiToolConfigInfo } from './contracts/index.js';

export default function LtiAdminPanel() {
  const [configInfo, setConfigInfo] = useState<LtiToolConfigInfo | null>(null);
  const [platforms, setPlatforms] = useState<LtiPlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 表单状态
  const [formData, setFormData] = useState<LtiPlatformConfig>({
    platformId: '',
    clientId: '',
    deploymentId: '',
    authUrl: '',
    jwksUrl: '',
    name: '',
  });

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [infoRes, platformsRes] = await Promise.all([
        fetch('/api/plugins/openlearn-plugin-lti13/config-info').then(r => r.json()),
        fetch('/api/plugins/openlearn-plugin-lti13/platforms').then(r => r.json()),
      ]);

      if (infoRes) setConfigInfo(infoRes);
      if (platformsRes?.platforms) setPlatforms(platformsRes.platforms);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: '获取 LTI 配置失败: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.platformId || !formData.clientId || !formData.authUrl) {
      setStatusMessage({ type: 'error', text: '请填写完整的平台 ID、Client ID 与 OIDC 授权 URL' });
      return;
    }

    try {
      const res = await fetch('/api/plugins/openlearn-plugin-lti13/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error('保存失败');
      }

      setStatusMessage({ type: 'success', text: 'LMS 平台连接器保存成功！' });
      setFormData({ platformId: '', clientId: '', deploymentId: '', authUrl: '', jwksUrl: '', name: '' });
      fetchAllData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: '保存失败: ' + err.message });
    }
  };

  const handleDeletePlatform = async (platformId: string) => {
    if (!confirm(`确定要解除与平台 [${platformId}] 的 LTI 连接吗？`)) return;

    try {
      const res = await fetch('/api/plugins/openlearn-plugin-lti13/platforms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformId }),
      });

      if (!res.ok) throw new Error('删除失败');
      setStatusMessage({ type: 'success', text: '已移除该 LMS 平台配置' });
      fetchAllData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: '删除失败: ' + err.message });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        正在载入 LTI 1.3 服务端配置...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
          LTI 1.3 Advantage 工具集成中心
        </h2>
        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
          为 OpenLearn 启用 1EdTech LTI 1.3 标准支持，使 Canvas、Moodle、Blackboard 等 LMS 可通过单点登录 (SSO) 与跨域 Iframe 无缝嵌入。
        </p>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            background: statusMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: statusMessage.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${statusMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* 模块一：Tool 自身公开端点配置（用于填入 LMS） */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginTop: 0, marginBottom: '1rem' }}>
          📋 平台端公开配置 (在 LMS 注册本工具时使用)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
          {[
            { label: 'OIDC 登录发起端点 (Initiate Login URL)', value: configInfo?.oidcLoginUrl, key: 'login' },
            { label: '目标启动端点 (Launch / Target Link URI)', value: configInfo?.targetLinkUri, key: 'launch' },
            { label: '公钥集端点 (Public Keyset / JWKS URL)', value: configInfo?.jwksUrl, key: 'jwks' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>{item.label}</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  readOnly
                  value={item.value || ''}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.value || '', item.key)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    background: copiedKey === item.key ? '#22c55e' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {copiedKey === item.key ? '已复制 ✔' : '复制'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 模块二：已注册的 LMS 平台 */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '1rem' }}>
          🔗 已连接的 LMS 平台 ({platforms.length})
        </h3>
        {platforms.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
            尚未添加任何 LMS 平台配置。您可以在下方添加 Canvas 或 Moodle 连接。
          </div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>平台名称 / Issuer (Platform ID)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Client ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Deployment ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map(p => (
                  <tr key={p.platformId} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.name || '未命名平台'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{p.platformId}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{p.clientId}</td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{p.deploymentId || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        type="button"
                        onClick={() => handleDeletePlatform(p.platformId)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        解绑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 模块三：新增 LMS 平台配置 */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginTop: 0, marginBottom: '1rem' }}>
          ➕ 注册新的 LMS 平台连接器
        </h3>
        <form onSubmit={handleSavePlatform}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                平台名称 (备注)
              </label>
              <input
                placeholder="例如: 某某大学 Canvas LMS"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                Platform ID / Issuer URL *
              </label>
              <input
                required
                placeholder="例如: https://canvas.instructure.com"
                value={formData.platformId}
                onChange={e => setFormData({ ...formData, platformId: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                LMS Client ID *
              </label>
              <input
                required
                placeholder="例如: 10000000000001"
                value={formData.clientId}
                onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                Deployment ID
              </label>
              <input
                placeholder="例如: 1:fe45b89a..."
                value={formData.deploymentId}
                onChange={e => setFormData({ ...formData, deploymentId: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                OIDC 认证端点 (OpenID Connect Authorization Endpoint) *
              </label>
              <input
                required
                placeholder="例如: https://canvas.instructure.com/api/lti/authorize_redirect"
                value={formData.authUrl}
                onChange={e => setFormData({ ...formData, authUrl: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                LMS 公钥集端点 (Public Keyset URL)
              </label>
              <input
                placeholder="例如: https://canvas.instructure.com/api/lti/security/jwks"
                value={formData.jwksUrl}
                onChange={e => setFormData({ ...formData, jwksUrl: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
          </div>
          <button
            type="submit"
            style={{
              padding: '0.6rem 1.5rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            保存连接配置
          </button>
        </form>
      </div>
    </div>
  );
}
