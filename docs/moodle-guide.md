# Moodle LMS 与 OpenLearn LTI 1.3 对接实战指南

本指南手把手指导管理员如何在 **Moodle 3.10+ / 4.x** 中配置 OpenLearn 作为 LTI 1.3 外部工具。

---

## 步骤 1：在 Moodle 中添加外部工具

1. 以管理员登录 Moodle，进入 **Site administration (网站管理)** -> **Plugins (插件)** -> **Activity modules (活动模块)** -> **External tool (外部工具)** -> **Manage tools (管理工具)**。
2. 点击 **configure a tool manually (手动配置工具)**。
3. 填写工具配置参数：
   - **Tool name**: `OpenLearn 智慧教学平台`
   - **Tool URL**: `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/launch`
   - **LTI version**: 选择 `LTI 1.3`
   - **Public key type**: 选择 `Keyset URL`
   - **Public keyset**:
     `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/jwks`
   - **Initiate login URL**:
     `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/login`
   - **Redirection URI(s)**:
     `https://your-openlearn-host.com/api/plugins/openlearn-plugin-lti13/launch`
4. 展开 **Services (服务)**：
   - **IMS LTI Assignment and Grade Services**: 选择 `Use this service for grade sync and column management`
   - **IMS LTI Names and Role Provisioning**: 选择 `Use this service to retrieve members' information`
5. 展开 **Privacy (隐私)**：
   - **Share launcher's name with tool**: 选择 `Always`
   - **Share launcher's email with tool**: 选择 `Always`
6. 点击 **Save changes** 保存。

---

## 步骤 2：查看 Moodle 生成的配置凭据

保存成功后，在 **Manage tools** 列表中找到刚才添加的工具，点击卡片右上角的 **View configuration details (查看配置详情)** 图标（形似列表或眼睛）。
弹窗中将展示 Moodle 分配的信息：
- **Platform ID**: 例如 `https://your-moodle.edu.cn`
- **Client ID**: 例如 `abc123xyz`
- **Deployment ID**: 例如 `1`
- **OpenID Connect Authorization Endpoint**: 例如 `https://your-moodle.edu.cn/mod/lti/auth.php`
- **Public Keyset URL**: 例如 `https://your-moodle.edu.cn/mod/lti/certs.php`

---

## 步骤 3：在 OpenLearn LTI 插件管理中心注册 Moodle

将步骤 2 获取的 5 项参数复制并录入 OpenLearn 的 LTI 管理控制台中并保存。

---

## 步骤 4：在 Moodle 课程中添加 OpenLearn 活动

教师进入任意 Moodle 课程，开启编辑模式，点击 **+ Add an activity or resource** -> 选择 **External tool (外部工具)**，在 **Preconfigured tool** 下拉列表中选择 **OpenLearn 智慧教学平台** 并保存。学生点击该活动即可一键直达课堂！
