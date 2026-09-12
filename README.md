# OpenLearn LTI 1.3 Advantage Tool Provider Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: OpenLearn](https://img.shields.io/badge/OpenLearn-v0.3.15%2B-brightgreen.svg)](https://github.com/aymwoo/OpenLearn-Next-V2)
[![SDK: @openlearn/plugin-sdk](https://img.shields.io/badge/@openlearn/plugin--sdk-3.6.1-orange.svg)](https://www.npmjs.com/package/@openlearn/plugin-sdk)

本插件为 **OpenLearn V2 (openlearn-next)** 提供符合 1EdTech 官方标准的 **LTI 1.3 (Learning Tools Interoperability 1.3 / LTI Advantage)** 核心工具提供者能力。通过本插件，OpenLearn 可以无缝嵌入 Canvas、Moodle、Blackboard、Sakai 等主流 LMS 系统，实现基于 3-Legged OIDC 流程的免密单点登录、学生/教师自动开户以及跨域 Iframe 沉浸式教学。

---

## 🌟 核心特性

- **官方标准 OIDC 3-Legged 登录状态机**：严格遵循 1EdTech LTI 1.3 规范，支持第三方登录发起与防重放安全验证。
- **纯原生零外部重型依赖**：加解密与 JWT RS256 签名验签完全基于 Node.js 原生 `crypto` 模块实现，轻量高效，打包体积小于 50KB。
- **动态公钥集托管 (RFC 7517 JWKS)**：内置 `/jwks` 端点，自动输出标准 JSON Web Key Set，且 RSA 密钥对在插件独立 SQLite 数据库中持久化，重启不漂移。
- **特权会话安全桥接**：深度对接 OpenLearn v0.3.15 内核的 `IAuthSessionBridgeService` 与 `PluginApiGateway`，安全生成平台会话并在主线程自动注入 `SameSite=None; Secure; HttpOnly` 跨域 Cookie。
- **可视化 LMS 平台管理控制台**：内置现代响应式前端管理面板，一键查看与复制本 Tool 的对接 URL，并支持多租户 LMS 平台动态注册与管理。

---

## 📂 项目结构

```
openlearn-plugin-lti13/
├── package.json              # 依赖 @openlearn/plugin-sdk@3.6.1
├── manifest.json             # 插件清单规范 (权限、API 静态路由与元数据)
├── tsconfig.json             # TypeScript 构建配置
├── build.mjs                 # 自动化 esbuild 打包与 ZIP 生成流水线
├── src/
│   ├── contracts/
│   │   └── index.ts          # 跨端数据模型与契约 (Platform, Claims, State)
│   ├── crypto.ts             # RSA-2048 密钥管理、JWKS 导出与 RS256 验签
│   ├── state-store.ts        # SQLite 持久化层 (密钥、多平台注册表、Nonce 防重放)
│   ├── frontend.tsx          # 前端管理控制台 (Tool 详情、平台 CRUD、复制引导)
│   └── index.ts              # 后端服务入口 (注册 /login, /launch, /jwks 等端点)
├── docs/
│   ├── canvas-guide.md       # Canvas LMS 实战对接指南
│   └── moodle-guide.md       # Moodle LMS 实战对接指南
└── README.md                 # 插件项目说明文档
```

---

## 🚀 快速上手与构建打包

### 1. 安装依赖

```bash
pnpm install
```

### 2. 编译与打包

```bash
pnpm run build
```

构建流水线会自动在项目根目录生成：
- `dist/index.js`（服务端 Bundle）
- `dist/frontend.js`（前端管理面板 Bundle）
- `dist/manifest.json`（插件清单）
- **`openlearn-plugin-lti13.zip`**（可直接上传部署的插件分发包）

---

## 🛠️ 安装与部署指南

### 1. 上传插件至 OpenLearn

1. 以管理员身份登录 OpenLearn 后台；
2. 进入 **插件管理 (Plugin Center)**；
3. 点击 **上传插件**，选择构建生成的 `openlearn-plugin-lti13.zip`；
4. 点击 **启用/激活插件**。

### 2. 配置服务端允许 LMS Iframe 嵌入

在 OpenLearn 生产服务器的启动环境变量中加入所对接的 LMS 域名白名单（多个以逗号分隔）：

```bash
# 例如支持 Canvas 与 Moodle
export LTI_ALLOWED_LMS_ORIGINS="https://canvas.instructure.com,https://moodle.your-school.edu"
```

OpenLearn 将自动放行 CSP `frame-ancestors` 指令并移除阻断头，保障跨域嵌入体验。

---

## 📖 对接指南

- 🎓 [Canvas LMS 对接实战指南](docs/canvas-guide.md)
- 🏫 [Moodle LMS 对接实战指南](docs/moodle-guide.md)

---

## 🔒 安全设计与威胁缓解

| 潜在风险 | 缓解防御策略 |
|---|---|
| **重放攻击 (Replay Attack)** | `/login` 生成一次性高熵 `state` 与 `nonce` 并存入 SQLite，`/launch` 校验后**单次即刻物理删除**，超时（5分钟）自动熔断。 |
| **点击劫持 (Clickjacking)** | 服务端严格依据 `LTI_ALLOWED_LMS_ORIGINS` 白名单放行特定的 `frame-ancestors`，未配置时维持最高级别同源阻断。 |
| **第三方 Cookie 阻断** | 网关自动下发 `SameSite=None; Secure; HttpOnly` 标头，完全兼容 Chrome、Safari 及 Edge 等现代浏览器的跨域 Iframe Cookie 策略。 |
| **恶意插件 Cookie 污染** | 插件在 Worker 隔离沙箱中运行，普通插件常规响应头 `Set-Cookie` 被安全网关彻底清洗剥离，仅特权桥接的 `sessionToken` 允许注入。 |

---

## 📄 License

MIT © OpenLearn Team
