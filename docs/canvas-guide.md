# Canvas LMS 与 OpenLearn LTI 1.3 对接实战指南

本指南手把手指导管理员如何在 **Canvas LMS** 中配置 OpenLearn 作为 LTI 1.3 Advantage 工具。

---

## 步骤 1：在 Canvas 创建 LTI 1.3 开发者密钥 (Developer Key)

1. 以管理员身份登录 Canvas，进入 **Admin (系统管理)** -> 选择根账户。
2. 点击侧边栏的 **Developer Keys (开发者密钥)**。
3. 点击右上角 **+ Developer Key** -> 选择 **+ LTI Key**。
4. 填写基本参数：
   - **Key Name**: `OpenLearn Educational Platform`
   - **Owner Email**: 管理员邮箱
   - **Redirect URIs**: 填写 OpenLearn 的 Target Link URI，例如：
     `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/launch`
   - **Method**: 选择 `Enter URL`
   - **Title**: `OpenLearn 智能学习空间`
   - **Description**: `基于 AI 助教与沉浸式交互课件的新一代智能教学系统`
   - **Target Link URI**:
     `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/launch`
   - **OpenID Connect Initiation Url**:
     `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/login`
   - **Public JWK URL**:
     `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/jwks`
5. 在 **Placements (放置位置)** 中根据需求勾选：
   - `Course Navigation`（课程左侧导航菜单，用于师生一键直达课堂）；
   - `Assignment Selection`（作业外部工具选择）；
   - `Link Selection`（富文本编辑器插入课件）。
6. 点击右下角 **Save** 保存。
7. 在密钥列表中，将该 Key 的状态从 **OFF** 切换为 **ON**。
8. 复制 **Details** 列中生成的 **Client ID**（例如 `10000000000001`）。

---

## 步骤 2：在 Canvas 课程或全局中安装工具

1. 进入课程 -> **Settings (设置)** -> **Apps (应用)** 选项卡。
2. 点击 **View App Configurations** -> 点击 **+ App**。
3. **Configuration Type** 选择 `By Client ID`。
4. 在 **Client ID** 输入框中粘贴刚才在步骤 1 中生成的 Client ID。
5. 点击 **Submit**，在弹出的确认窗口中点击 **Install**。
6. 安装成功后，点击工具项右侧的齿轮图标 -> 点击 **Deployment ID**，复制弹出的 Deployment ID 字符串。

---

## 步骤 3：在 OpenLearn LTI 管理控制台中登记 Canvas 连接

1. 登录 OpenLearn 管理员后台 -> 进入 **LTI 1.3 集成中心**。
2. 在 **注册新的 LMS 平台连接器** 表单中填写：
   - **平台名称**: `Canvas LMS 本部`
   - **Platform ID / Issuer URL**: `https://canvas.instructure.com`
   - **LMS Client ID**: 步骤 1 复制的 Client ID
   - **Deployment ID**: 步骤 2 复制的 Deployment ID
   - **OIDC 认证端点**: `https://canvas.instructure.com/api/lti/authorize_redirect`
   - **LMS 公钥集端点**: `https://canvas.instructure.com/api/lti/security/jwks`
3. 点击 **保存连接配置**。

---

## 步骤 4：配置 OpenLearn 服务端跨域放行环境变量

确保 OpenLearn 宿主服务启动时包含 Canvas 域名白名单：
```bash
export LTI_ALLOWED_LMS_ORIGINS="https://canvas.instructure.com"
```

---

## 步骤 5：验证免密登录

教师或学生在 Canvas 课程页面点击左侧 **OpenLearn** 导航项，浏览器将在内嵌 Iframe 容器中自动完成 3-Legged OIDC 鉴权，直接进入 OpenLearn 学习空间，无需二次输入账号密码！
