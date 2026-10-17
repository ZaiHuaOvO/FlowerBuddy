# Windows 桌宠个人助手 — 技术开发文档

> 文档版本：1.1  
> 编写日期：2026-10-16  
> 目标：提供给 AI Agent 作为从零开发、分阶段实现、测试和打包的唯一主技术规范。  
> 产品定位：运行于 Windows 的轻量级桌面宠物与个人信息助手。  
> 当前原则：自有代码从零编写，借鉴开源项目的产品交互和架构思路；未经许可证允许，不直接复制其源码或资源。

---

## 文档状态（2026-10-17 补充）

**本文是项目最初的完整产品/技术规划与长期约束，不是当前实现清单。** 阶段 0–6 已完成，实际架构、文件位置、配置版本和测试方式以源码及以下文档为准：

- 当前架构与数据流：[docs/architecture/overview.md](docs/architecture/overview.md)
- 文档索引与权威来源：[docs/README.md](docs/README.md)
- 未完成项与已知限制：[docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)
- Agent 操作规则：[AGENTS.md](AGENTS.md)

阅读时请注意以下已知差异（不要据此判断当前代码缺失）：

| 本文内容 | 当前实现 |
| --- | --- |
| 目录示例使用 `service.ts` / `schema.ts` / `oauth.ts` | 实际为 `*-service.ts`、`*-module.ts`、`types.ts`、`gmail-auth.ts` 等 |
| 配置 schema 示例为 `schemaVersion: 1` | 当前 `CURRENT_CONFIG_SCHEMA_VERSION = 4` |
| 规划 `notifications/notification-service.ts` | 当前由 `AppController.handleGmailNewMessages()` 直接使用 Electron `Notification` |
| §8.3 规划设置页“打开日志目录 / 复制脱敏诊断信息” | 尚未实现，登记在 `OPEN_ITEMS.md` |
| 目录示例包含 `tests/integration/` | 当前只有 `tests/unit/` |
| §12 是“从零开发”的阶段任务 | 阶段 0–6 已完成；历史结果见 `docs/regression-report.md` 与 `docs/performance-*.md` |

本文中的产品边界、安全要求、隐私原则和长期技术约束仍然有效；与源码冲突时，先查证事实，再更新本文或登记待办，不要擅自改变产品行为。

---

## 0. 给 AI Agent 的最高优先级指令

> 任务开始前还需阅读根目录 [`AGENTS.md`](./AGENTS.md) 和文档索引 [`docs/README.md`](./docs/README.md)；本文件不是当前实现清单，架构事实见 [`docs/architecture/overview.md`](./docs/architecture/overview.md)。

开始工作前必须完整阅读本文件，并遵循以下规则：

1. **从零创建本项目。** 不要把 `yuqiangdede/desktop-pet`、`SeakMengs/WindowPet`、`Egger0/desk-pet` 或其他项目拼接成新项目。可以研究它们的交互和架构；是否允许复用代码，以仓库当前 LICENSE 为准。
2. **严格遵守分阶段开发。** 每次只实现用户明确要求的当前阶段。阶段未验收时，不要提前实现后续模块。
3. **先核验，后实现。** 开始每个阶段时，简要说明将检查的文件、计划修改的范围和验收办法；随后按本阶段任务执行，不要只给伪代码或操作建议。
4. **不虚构第三方 API。** 调用真实官方文档中存在的 API。没有官方账号级 DeepSeek 每日花费接口时，不得用余额差额冒充真实消费，也不得生成假数据。
5. **安全优先。** API Key、阿里云 AccessKey Secret、Gmail OAuth token / refresh token 等凭据只允许在 Electron 主进程处理；敏感数据必须加密后持久化。禁止把密钥放入 renderer、源码常量、`VITE_*` 变量、前端 bundle、日志或 Git。
6. **交付必须是可直接运行的 Windows 成品。** 正式用户不需要安装 Node.js、不需要运行 `npm install`、不需要打开终端。至少输出 Windows NSIS 安装程序 `.exe`；同时尽可能输出便携版 `.exe`，可以附带 ZIP。开发命令只用于贡献者和 AI Agent。
7. **可配置、模块独立。** 每项功能都能独立启用/停用；停用后不发起轮询、不主动调用接口，并保留/删除凭据由用户决定。未配置的模块展示“尚未配置”，不得影响其他模块。
8. **不破坏已有用户数据。** 应用升级时，配置、凭据、导入的角色图像和事件数据保存在用户数据目录，不打包写回安装目录。
9. **完成后提供证据。** 每阶段报告修改摘要、运行的检查、测试结果、未完成项和已知限制。不得宣称运行过实际没有运行的命令或测试。
10. 若发现本规范和真实官方接口文档冲突，以安全要求和当前官方文档为准，并在结果中说明更改理由。

### 建议给 AI Agent 的启动提示

```text
请先完整阅读《Windows_桌宠个人助手_技术开发文档.md》。这是本项目的主要产品与技术规范。

项目从零开始，采用 Electron + TypeScript + React + Vite。请参考文档中的仓库链接理解桌宠交互，但不要拼接仓库或未经许可复制源码。

现在只执行“阶段 0：工程初始化与技术验证”。先简要给出执行计划，再完成阶段 0 约定的工作，运行相应检查，报告结果。不要提前实现任何业务模块。最终用户必须能够直接运行打包后的 Windows 安装程序，而无需安装 Node.js 或使用终端。
```

---

## 0.1 Git 与 GitHub 工作流（必须遵守）

Git 的详细执行规范位于项目根目录的 [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)。AI Agent 每次开始修改前必须先阅读该文件，并在每次完成一个可独立验收的小更新或大更新后，按其中规定执行检查、提交和推送。

核心要求：

1. **每个完整更新都应形成 Git 记录并推送到用户的 GitHub 远程仓库。** 小更新也不能长期只留在本地；按一个可说明、可验证的改动单元提交，不要求每修改一行就提交。
2. **提交前必须检查差异、测试结果、当前分支和待提交文件。** 禁止将密钥、OAuth token、个人配置、构建产物或其他敏感数据提交到 Git。
3. **推送前确认远程仓库、分支和认证状态。** 不得猜测仓库地址，不得在未确认的情况下创建或改写远程仓库；推送失败时必须如实报告，不得宣称已推送。
4. **每次推送后必须验证远程状态。** 至少检查当前分支、最新提交、工作区状态及本地与远程是否同步。遵循“提交不等于推送，推送不等于验证完成”。
5. **每次推送都必须向用户给出改动说明。** 先用一句话总结本次更新，再在下方逐条用完整句子说明具体改动；每条说明聚焦一个改动点，不能只写“优化代码”“修复问题”等空泛内容。
6. **不擅自破坏历史。** 默认禁止 `git push --force`、`git reset --hard`、删除远程分支或重写已推送提交；确需进行破坏性操作时必须先取得用户明确同意。
7. **提交身份与远程权限由用户控制。** 若没有 GitHub 登录权限、远程地址或必要认证，先完成本地检查和提交（如果身份配置允许），明确说明阻塞原因，并请求用户完成授权；不得伪造成功。

建议提交说明格式、分支策略、推送前后检查清单、失败处理方式和用户汇报模板，全部以 `GIT_WORKFLOW.md` 为准。

---

## 0.2 视觉设计系统（必须遵守）

项目根目录的 [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) 是 FlowerBuddy 的视觉与交互规范接入说明。AI Agent 在开发任何 UI 前必须阅读该文件，并打开 <https://flowersink.com/design/> 核对花墨设计规范中的实际 token、字体、间距、圆角、阴影、排版、动效、组件状态和无障碍约定。

1. **不要等所有功能完成后再统一做样式。** 从阶段 1 开始建立视觉基线，后续功能直接复用；当前已经完成的功能逻辑不应因此被无必要地推翻。
2. **不要凭感觉编造样式值。** 具体 token 以设计规范网页实际内容为准；如果暂时无法访问，先查项目中的现有样式和资源并明确记录尚未核验的内容。
3. **统一使用设计 token 和公共组件。** 颜色、字体、间距、圆角、阴影和动效应集中管理，不得在各业务组件中各自硬编码一套。
4. **进行桌面端适配而非复制网页布局。** 保持 Electron 桌宠窗口真正透明，以用户导入的角色图片为主视觉；菜单、气泡和设置窗口采用一致的视觉规则。
5. **每次 UI 更新都要进行视觉回归检查。** 至少检查默认态、悬停/焦点态、加载态、错误态、长文本和 Windows 高 DPI 布局，并按 `GIT_WORKFLOW.md` 汇报、提交和推送。

---

## 1. 项目目标与范围

### 1.1 产品目标

桌面常驻一只可以自定义外观的桌宠。用户单击桌宠后打开快捷操作菜单，选择某个信息功能；程序在后台执行请求，并通过“思考中”气泡、结果气泡或系统通知反馈结果。

桌宠的价值顺序：

1. **随手可用：** 不必打开浏览器、控制台或其他应用即可查看常用信息。
2. **轻量稳定：** 常驻低占用、支持开机启动、断网后可以恢复，不因单一接口失败而退出。
3. **可自行配置：** 用户自由选择外观、启用功能、配置服务凭据和刷新频率。
4. **可扩展：** 新增功能模块时，尽量不修改桌宠窗口、设置体系和现有功能。

### 1.2 第一版范围（MVP）

| 模块 | 第一版必须实现的能力 | 第一版明确不承诺的能力 |
|---|---|---|
| 桌宠外观与交互 | 单张 PNG 图片导入、透明窗口、置顶、拖动、点击菜单、基础弹跳动画、托盘、设置窗口 | Live2D、骨骼动画、语音、摄像头、复杂 AI 对话 |
| 特殊日期 | 新增/编辑/删除事件；一次性日期与每年重复；显示最近事件及倒计时 | 云端日历同步、多人共享 |
| Gmail | OAuth 授权、后台轮询新邮件、显示发件人/主题/时间、去重、开关与轮询间隔 | SMTP 收件箱监听、默认读取邮件正文、未经用户确认自动执行邮件内容 |
| ESA 流量 | 配置阿里云只读凭据与站点 ID；查询今日流量；显示单位、更新时间和错误 | 把分析流量直接当作精确计费金额；承诺数据秒级实时 |
| DeepSeek | 查询当前余额、余额构成、更新时间；提供清楚的状态提示 | 未经官方接口支持却声称知道账号所有调用的今日精确消费 |
| 网站检测 | 手动检查 URL，展示 HTTP 状态/耗时/失败原因；可选定时检查 | 宣称从全球所有地区都能访问，仅根据本机检测作全球结论 |
| 安全与配置 | 模块独立开关、凭据加密存储、配置迁移与重置 | 在 renderer 暴露 Node.js/Electron 全量 API |
| 发行 | Windows x64 安装版 `.exe`，优先提供便携版 `.exe` 和 ZIP | 要求最终用户安装 Node.js 或运行命令行启动 |

### 1.3 第一版暂缓功能

- DeepSeek 账号级每日消费：必须先确认官方存在可用、受支持的账号级统计接口；否则只显示余额，并把每日消费标记为“当前版本暂不支持”。未来若通过桌宠代理自身的模型请求进行日志统计，应标明其仅覆盖经过本程序的请求，不等同于账号总账单。
- 通用动态插件加载：第一版采用内置模块注册表，不执行第三方任意 JS 代码。模块接口应预留，但不能为“可扩展”而引入高风险动态代码执行。
- 自动更新、云端同步、跨平台 macOS/Linux、复杂 AI Agent/MCP 工具执行。

---

## 2. 开源项目调研与借鉴边界

以下仓库是架构和产品参考，不是必须依赖。正式实现前，Agent 应再次检查仓库当前版本、LICENSE、依赖版本和维护情况。

| 项目 | 地址 | 重点参考内容 | 复用边界 |
|---|---|---|---|
| `desktop-pet`（yuqiangdede） | https://github.com/yuqiangdede/desktop-pet | Electron + React + TS；透明置顶窗口；单张 PNG 导入；角色缩放；托盘；设置页；Windows 打包 | 仓库页面未明显列出 LICENSE 时，按“仅参考思路、不复制代码/资源”处理，除非后续核实获得明确许可 |
| `WindowPet` | https://github.com/SeakMengs/WindowPet | 桌宠拖动、点击穿透、置顶、托盘/设置体验 | 仓库标明 MIT。若确需复制代码，必须保留许可证和版权声明并满足 MIT 条款；本项目默认仍从零实现 |
| `desk-pet`（Egger0） | https://github.com/Egger0/desk-pet | 透明桌宠、菜单交互、DeepSeek 余额请求与轮询、余额变化提醒 | README 标注“仅供个人学习与娱乐使用”，不得把其源码直接集成到一个希望公开分发的项目；仅参考交互和官方 API 用法 |
| `OpenPet` | https://github.com/dengyie/OpenPet | Electron 服务层、设置中心、插件分层和 IPC 组织 | 适合学习架构；它的当前发布方向为 macOS 优先，不作为本项目的基础模板 |
| `Uptime Kuma` | https://github.com/louislam/uptime-kuma | HTTP 检查、超时、监控状态和告警处理 | 只参考监控设计，不嵌入完整监控系统 |

### 2.1 必须遵守的许可证规则

- 不复制没有明确许可证的仓库源码、图片、动画、图标或文案。
- MIT 项目若复制了代码或衍生实现，应按其许可证保留版权和许可证文本。
- “公开可见”不等于“允许随意复用”。
- 依赖包也需遵循各自的许可证；发布时保留必要的第三方许可清单。
- 用户导入的角色图片属于用户资产，应用不得上传或传给外部 API。

---

## 3. 技术栈与工程决策

### 3.1 必选技术

| 层 | 技术 | 责任 |
|---|---|---|
| 桌面运行时 | Electron | Windows 原生窗口、系统托盘、系统通知、开机启动、密钥保护、主进程后台任务 |
| 语言 | TypeScript，开启 strict | 主进程、preload、渲染层及 API 类型约束 |
| UI | React | 桌宠交互、快捷菜单、设置中心、结果面板 |
| 开发/构建 | Vite + electron-vite（或等价的成熟 Electron/Vite 集成） | 分别构建 main、preload、renderer，支持开发和生产资源路径 |
| Windows 发布 | electron-builder | NSIS 安装程序、portable 便携版、版本与资源打包 |
| 配置验证 | Zod 或同类运行时校验库 | IPC 输入、用户配置、API 响应结构的基础校验 |
| 测试 | Vitest | 日期规则、格式化、模块逻辑、配置迁移和 API 数据转换单测 |
| Google API | `googleapis` 或官方推荐库 | Gmail OAuth 与 Gmail API 调用 |
| 阿里云 API | ESA 当前官方 Node.js/TypeScript SDK | ESA 请求签名、流量查询；不要自行重写 RPC 签名 |
| 凭据加密 | Electron `safeStorage` 异步 API | 利用 Windows 提供的加密机制加密本地密钥与 OAuth token |

Agent 可以根据初始化时的当前稳定版本选取兼容版本，但必须锁定 `package-lock.json`，避免使用浮动版本。不要为了“最新”盲目升级主框架。

### 3.2 设计原则

- 所有第三方 API 请求均由 **Electron 主进程** 发出。
- renderer 只负责显示数据与收集用户输入，不直接持有 API Key、AccessKey Secret 或 OAuth refresh token。
- `preload` 通过 `contextBridge` 暴露少量、明确、按功能划分的 API；禁止暴露整个 `ipcRenderer`、`fs`、`process` 或通用命令执行功能。
- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，除非有充分理由且记录批准，不得关闭安全设置。
- 使用本地打包的前端内容，不把远程网站加载进具有 Node.js 能力的窗口。
- 新增模块只需要实现统一模块接口、配置 schema、主进程 service 和 UI 面板，不应把所有业务堆进 `main.ts`。
- 不引入 NestJS、MySQL 或云端后端。第一版为纯本地桌面应用。

### 3.3 项目初始化命令仅供开发者使用

这些命令用于 AI Agent 初始化和构建，不会要求普通用户执行：

```bash
npm install
npm run dev
npm run test
npm run build
npm run dist:win
```

具体脚本名可在初始化时统一确定，并必须写入根目录 README。最终用户只接收打包产物。

---

## 4. 系统架构

### 4.1 进程职责

**Main process（可信服务层）**

- 创建桌宠主窗口、设置窗口和托盘。
- 管理应用单实例、窗口位置、开机启动、系统通知。
- 读取和校验配置；加密保存与读取密钥。
- 提供受控的 IPC handlers。
- 注册并调度模块轮询任务，确保同一模块不会并发重复请求。
- 调用 Gmail、ESA、DeepSeek 和网站检测服务。
- 对外部错误做脱敏和统一分类。

**Preload（窄桥接层）**

- 通过 `contextBridge.exposeInMainWorld` 暴露已列入类型定义的 API。
- 每个 API 只暴露明确能力，例如 `petApi.getSnapshot()`、`petApi.runAction(id)`、`settingsApi.getPublicConfig()`、`settingsApi.saveGeneralSettings(data)`。
- 不暴露任意 channel、任意 URL 请求代理或任意文件路径读写。

**Renderer（不可信 UI 层）**

- 展示角色、快捷菜单、气泡、模块卡片、设置表单和状态。
- 不导入 Node.js 模块，不存放密钥。
- 表单提交前做用户体验级校验；真正安全校验必须在主进程再次执行。

### 4.2 推荐目录结构

```text
src/
  main/
    index.ts
    windows/
      pet-window.ts
      settings-window.ts
    tray/
      tray.ts
    ipc/
      register-handlers.ts
      validate-sender.ts
    security/
      secret-store.ts
      safe-url.ts
    storage/
      config-store.ts
      data-store.ts
      migrations.ts
    scheduler/
      task-scheduler.ts
    modules/
      registry.ts
      types.ts
      dates/
        service.ts
        schema.ts
      gmail/
        service.ts
        oauth.ts
        schema.ts
      esa/
        service.ts
        schema.ts
      deepseek/
        service.ts
        schema.ts
      website-check/
        service.ts
        schema.ts
    notifications/
      notification-service.ts
    shared/
      errors.ts
      logger.ts
      types.ts
  preload/
    index.ts
    api.ts
  renderer/
    index.html
    src/
      app/
      pet/
      quick-menu/
      bubbles/
      panels/
        dates/
        gmail/
        esa/
        deepseek/
        website-check/
      settings/
      components/
      styles/
      types/
assets/
  app-icon.ico
  default-pet/              # 仅放可合法分发的默认素材
  licenses/
  ...
 tests/
  unit/
  integration/
 docs/
  ...
 release/                   # 仅构建输出，不提交用户密钥
```

目录可随实际构建配置略作调整，但必须保持 main、preload、renderer、模块 service、存储层职责清楚。

### 4.3 模块统一接口

每个模块至少定义：

- 固定 `id`、显示名称、描述、图标标识。
- `enabled` 配置。
- `isConfigured()` / `getSetupStatus()`：返回尚未配置、已配置、认证过期等状态，不泄露凭据。
- `runAction(actionId, input)`：执行用户主动查询。
- 可选 `start()` / `stop()`：仅有后台监控需求的模块实现；停用时必须停止计时器和正在等待的可取消请求。
- 明确的输入、输出和错误类型。
- 配置 schema、表单 schema、单元测试。

第一版使用静态注册表：`dates`、`gmail`、`esa`、`deepseek`、`website-check`。注册表只决定内置模块的显示与生命周期，不加载未知路径中的代码。

---

## 5. UI 与交互要求

### 5.1 桌宠窗口

- 默认显示一张用户可更换的透明 PNG。
- 无边框、透明背景、默认置顶、可拖动。
- 单击桌宠打开快捷操作菜单；如果用户正在拖动，不应误判为点击。
- 点击动作触发轻微上下弹跳（CSS transform 即可），动画时长约 150–300ms；系统可关闭动画。
- 提供鼠标右键/托盘备用入口，避免用户误移或菜单无法打开时失去控制。
- 默认不启用点击穿透。若实现穿透，应提供明确开关和退出快捷入口。
- 窗口大小根据角色图片宽高比计算，限制最小和最大尺寸；不能把长图强制拉伸为正方形。
- 保存位置，启动时将桌宠移回当前显示器可见区域，处理分辨率变化和多显示器切换。

### 5.2 气泡与信息反馈

统一显示状态：

- `idle`：普通提示。
- `loading`：显示“正在查询……”或功能特定的简短文本；可选轻微思考动画。
- `success`：显示结果与更新时间。
- `empty`：提示没有待展示的数据。
- `error`：显示用户能理解的错误及可执行建议，例如“授权已失效，请重新连接 Gmail”。

要求：

- 长请求有 10–20 秒的默认超时（按 API 具体情况可单独配置），不能无限 loading。
- 每次请求产生 requestId，旧请求返回不得覆盖新请求结果。
- 不把服务端原始堆栈、访问密钥、完整 OAuth 响应或带密钥的 URL 展示给用户。
- 气泡不会遮挡重要操作；允许用户关闭，并在设置中配置停留时长。
- 后台新邮件提醒走 Electron `Notification`，桌宠气泡作为附加反馈。通知功能被 Windows 禁用时，应用仍应工作。

### 5.3 设置窗口

将设置划分为：

1. **常规：** 语言（第一版简体中文）、开机启动、启动时是否显示桌宠、置顶、动画、气泡时长、默认刷新策略。
2. **外观：** 导入 PNG、缩放、角色位置、重置位置。
3. **功能管理：** 每个模块有独立启用开关、配置状态和“设置/测试/清除配置”按钮。
4. **日期事件：** 事件 CRUD、重复规则、提醒规则。
5. **Gmail：** 连接/断开、测试连接、轮询频率、邮件通知开关。
6. **ESA：** AccessKey ID、AccessKey Secret、SiteId、今日时间范围、测试查询。
7. **DeepSeek：** API Key、测试余额查询；今日花费若不受官方 API 支持须明确显示限制。
8. **网站检测：** URL 列表、手动检测、超时、是否启用定时检测。
9. **数据和安全：** 清除密钥、删除模块数据、导出非敏感配置、重置设置。

密钥输入使用 password 类型，默认掩码。保存后仅显示“已保存”，不可通过读取配置接口取回明文；如需修改，用户重新输入。

---

## 6. 配置、存储与密钥保护

### 6.1 存储位置

所有可变数据都保存在 `app.getPath('userData')` 下，不写到安装目录。例如 Windows 上通常会落在用户 AppData 的应用目录中；实际路径以 Electron 返回为准。

建议结构：

```text
userData/
  config.json             # 普通配置，禁止包含明文密钥
  secrets.enc.json        # safeStorage 加密后的字符串，使用 Base64 存储密文
  data/
    dates.json            # 日期事件
    website-checks.json   # 用户配置的网站列表和非敏感状态
    gmail-state.json      # historyId、已通知消息 ID 等最小状态
  pets/                   # 用户导入的角色图片及元数据
  logs/                   # 脱敏日志；限制大小与保留天数
```

可使用成熟的本地 JSON 配置库，也可以实现小型文件存储。必须有 schema 版本和迁移函数。单文件写入采用临时文件 + rename 等方式降低中途关闭导致文件损坏的风险。

### 6.2 安全存储规则

- `safeStorage` 必须从主进程使用。优先用异步 `encryptStringAsync` / `decryptStringAsync`。
- 加密之前先检查加密是否可用；若失败，**禁止静默回退为明文保存**。提供明确提示，并允许用户取消保存或仅本次会话使用。
- 加密密文写入 `secrets.enc.json`；该文件本身不能包含明文备用字段。
- 对密钥使用独立 ID，如 `deepseek.apiKey`、`esa.accessKeySecret`、`gmail.refreshToken`。
- `config.json` 只保存 `hasCredential: true` 等状态，不保存密钥内容。
- 日志统一脱敏 `Authorization`、`x-acs-accesskey-secret`、token、API Key、用户邮件正文等内容。
- “断开 Gmail”应尽可能撤销 OAuth 授权，并删除本地 refresh token 与同步状态。若在线撤销失败，仍清除本地 token，并告知用户可到 Google 账号权限页手动撤销。
- “删除某服务配置”应提示用户将删除哪些本地数据，不影响其他模块。
- 配置导出默认只导出非敏感配置；密钥和 OAuth token 永不进入导出文件。
- 应用更新不得清空用户数据；卸载是否保留数据由安装/卸载说明明确写出。

> 重要限制：Windows `safeStorage` 使用操作系统 DPAPI，能保护磁盘上的密文免于其他 Windows 用户读取，但不能抵御已经在同一用户权限下运行的恶意程序。不要宣传为绝对防盗。

### 6.3 配置 schema 示例（只示意非敏感配置）

```json
{
  "schemaVersion": 1,
  "app": {
    "language": "zh-CN",
    "launchAtLogin": false,
    "alwaysOnTop": true,
    "bounceAnimation": true,
    "bubbleDurationMs": 5000
  },
  "pet": {
    "assetId": "default",
    "scale": 1,
    "position": { "x": 1200, "y": 720 }
  },
  "modules": {
    "dates": { "enabled": true },
    "gmail": { "enabled": false, "pollIntervalMinutes": 3, "notifyNewMail": true },
    "esa": { "enabled": false, "siteId": "" },
    "deepseek": { "enabled": false },
    "websiteCheck": { "enabled": true, "defaultTimeoutMs": 8000 }
  }
}
```

以上为默认配置示例，实际坐标和窗口大小必须根据显示器动态调整。示例中不允许出现任何密钥。

---

## 7. 功能模块规格

## 7.1 特殊日期与倒计时

### 数据结构

每个事件至少包含：

- `id`：本地生成的 UUID。
- `title`：事件名，如“结婚纪念日”。
- `date`：日期，建议存为 `YYYY-MM-DD`，不要用 UTC 时间戳直接存纯日期。
- `recurrence`：`none` 或 `yearly`。
- `category`：birthday / anniversary / overtime / custom。
- `notifyDaysBefore`：可选提醒天数数组，例如 `[7, 1, 0]`；第一版可先实现仅页面显示和到期当天提醒。
- `enabled`、`createdAt`、`updatedAt`。

### 业务规则

- 按系统/用户本地时区计算“今天”，显示距离事件的整天数。
- 今天发生显示“今天”，明天发生显示“还有 1 天”，昨天或更早的非重复事件不作为最近未来事件。
- 每年重复事件计算下一次未来发生日期。
- 闰年生日（2 月 29 日）的非闰年规则必须明确定义；第一版默认按 2 月 28 日处理，并在设置/帮助中写明。如需可配置，可留作后续迭代。
- 同一天有多个事件时均可展示；首页只展示最近 1–3 项，完整列表放在模块面板。
- 测试跨年、月末、闰年、本地时区和夏令时切换（如果系统时区支持）。

### 验收标准

- 可新增、编辑、删除、停用事件。
- 每年重复事件在跨年后能正确计算。
- 事件列表按距离日期升序。
- 无事件时显示友好的空状态。

## 7.2 Gmail 新邮件通知

### 认证与权限

- 使用 Gmail API + OAuth 2.0，不使用 SMTP 监听收件箱。
- 最小权限优先考虑 `https://www.googleapis.com/auth/gmail.readonly`，只读取邮件元数据和邮件列表，不申请发送邮件权限。
- 需要在 Google Cloud 项目启用 Gmail API、设置 OAuth consent screen 并配置 Desktop app OAuth client。
- **产品分发决策：** 对公开下载的正式版本，推荐开发者准备统一的 OAuth Client ID，用户只需要点击“连接 Gmail”并授权。Client ID 是应用标识，不是用户的邮箱密码或 API Key。OAuth 应用的审核/验证、测试用户限制和受限 scope 要求必须由发布者提前核实。可为高级用户保留覆盖 Client ID 的入口，但不应让普通用户必须创建自己的 Google Cloud 项目才能使用。
- 在应用尚未完成正式发布配置时，开发环境允许使用测试用户；README 应说明测试状态可能带来的使用限制。
- 使用本机 loopback 回调（127.0.0.1 随机可用端口）完成桌面 OAuth 流程；不要使用已废弃的 OOB 手工复制验证码方式。按选定 Google OAuth 库支持的流程实现 state 校验及安全回调。
- access token / refresh token 只在主进程处理，refresh token 加密存储。

### 轮询与去重

- 默认每 3 分钟轮询一次，可配置范围建议 1–15 分钟；设置最小值，避免频繁请求。
- 优先采用 Gmail History API 增量读取变化，并持久化 `historyId`。首次授权只建立同步基线，不把旧邮件全部提醒为新邮件。
- 收到新增邮件变化后仅请求展示所需的元数据：From、Subject、Date、Message ID。不获取或长期存储邮件正文。
- `historyId` 过期/失效时，安全回退到近期邮件列表以重建基线；不要将整份收件箱历史全部发出通知。
- 以 Message ID 去重。应用休眠后重新开始轮询时，不应重复发送已经通知的消息。
- 认证失效要停止密集重试，并在界面提示重新授权。
- Gmail 模块关闭或断开账号后必须停止轮询。

### 隐私

发件人和主题仍然可能是个人敏感信息，不写入一般日志。界面允许隐藏主题或仅显示“收到一封新邮件”。

### 验收标准

- OAuth 成功后显示已连接邮箱（可做部分隐藏）。
- 新邮件到达后，程序在下一轮轮询中产生系统通知。
- 关闭并重启程序不会反复提醒同一封邮件。
- 无效 token、网络断开、配额错误均有可理解的提示，且不会阻塞日期等其他模块。

## 7.3 阿里云 ESA 今日流量

### 凭据

- 用户创建具备最小读取权限的 RAM 身份，不使用阿里云主账号 AccessKey。
- 该模块至少需要 AccessKey ID、AccessKey Secret 和 SiteId。
- RAM 权限应限定到 ESA 查询所需操作，例如 `esa:DescribeSiteTimeSeriesData` 对目标站点的读取权限；如产品配置页还需要查询站点列表，才按需添加相应只读权限。
- 凭据经 `safeStorage` 加密保存，测试连接时不把签名、请求头或密钥写入日志。

### API 与时间范围

- 使用阿里云 ESA `ESA/2024-09-10` 官方 SDK / OpenAPI，不自行手写 RPC 签名。
- 今日流量使用 `DescribeSiteTimeSeriesData`，按所选 SiteId 查询字段 `Traffic`，常用维度为 `ALL`；实际参数以当前 API/SDK 文档为准。
- `StartTime` / `EndTime` 使用 ISO 8601 UTC 时间。界面的“今天”按用户选择的本地时区从当天 00:00 到当前时刻计算，再正确转换为 UTC；不能把本地午夜字符串直接附加 `Z`。
- 优先读取响应中的 `SummarizedData` 对应 Traffic 聚合值，若返回结构与预期不符则显示错误，不要静默将空值当 0。
- 流量显示提供 B / KB / MB / GB 单位，内部保留原始数值和响应的 `SamplingRate`、请求时间。默认显示“今日累计流量，截至 HH:mm 更新”。
- 不使用省略时间范围的“过去 24 小时”结果冒充“今天自然日”的统计。
- 官方文档注明高访问时结果可能经过采样。UI 应注明统计可能延迟/采样；不要称为精确账单。
- 查询频率建议手动优先，自动刷新默认 10–30 分钟；不得高频持续请求。

### 验收标准

- 配置正确时显示站点的今日流量和更新时间。
- 未设置 SiteId 或凭据时显示配置引导。
- 无权限、错误 SiteId、配额/采样说明和网络错误不会使应用崩溃。
- 今日范围跨 UTC 日期时结果仍与用户本地“今天”一致。

## 7.4 DeepSeek 余额与费用显示

### 余额接口

- 官方接口：`GET https://api.deepseek.com/user/balance`。
- 请求头使用 `Authorization: Bearer <API_KEY>`。
- 结果可展示 `is_available` 以及 `balance_infos` 里的 currency、total_balance、granted_balance、topped_up_balance。
- 请求只在主进程中发送。余额查询不是生成模型回复，不需要通过聊天接口发起提示词。
- 默认手动刷新；可提供低频自动刷新，如 15–60 分钟。余额变化提醒作为用户可关闭的选项。
- 将余额作为货币数值格式化，不应固定只支持 CNY；接口返回 USD 时也正确显示。

### 今日花费的准确边界

- 当前设计不能假设 `/user/balance` 提供历史消费或每日账单。余额变化不等于消费，因为充值、赠金和赠金到期等因素都可能改变余额。
- 第一版：显示实时余额；“今日 API 花费”区块必须清晰说明“当前未接入官方账号级每日消费统计”，或在功能开关中标记为尚未支持。不得填入固定数字或估算值冒充真实消费。
- 只有当后续核实官方有可用、受支持的账号级用量/账单 API 后，才实现账户级每日消费统计。
- 以后若应用自己代理模型请求并记录 usage，可以显示“本程序记录的预估花费”，但必须标明统计范围、价格表来源和不完整性；这不能覆盖 Codex 或其他客户端的调用。

### 验收标准

- 输入有效 DeepSeek API Key 后可获取余额。
- Key 无效、余额不足、限流、网络失败时显示可区分的错误状态。
- 任何时候不从余额差值计算“今日花费”。

## 7.5 网站可用性检查

### 用户配置

- 每条检查配置包括 id、显示名、URL、启用状态、timeoutMs、可选 pollingIntervalMinutes。
- 只接受合法 `http:` / `https:` URL；默认超时 8 秒，可配置为 3–30 秒。
- 初期提供手动“检测一次”；若实现定时监控，默认关闭，由用户单独启用。

### 检查逻辑

- 优先发起 HTTP(S) 请求，记录耗时、响应状态码和最终 URL（去除敏感 query 参数后再展示）。
- 可用性判定至少区分：连接成功（如 HTTP 2xx/3xx）、HTTP 错误状态（4xx/5xx）、DNS/连接失败、TLS 证书失败、请求超时。
- 不建议只使用 ICMP Ping，因为网站可能屏蔽 ICMP，但 HTTP 服务正常。
- 设置请求超时、合理的重定向上限和取消能力。不可执行响应中的脚本或把远程 HTML 注入应用界面。
- URL 在 renderer 中输入后必须由主进程再次解析与校验。
- 对私人内网 URL 可允许用户主动添加；应用不会把该 URL 提交给外部服务，但 UI 应明确这是本机网络检测。
- 结果措辞为“从本机网络检测成功/失败”，不可宣称全球可用性。

### 验收标准

- 可手动新增、编辑、删除并检查 URL。
- 区分 HTTP 状态错误、网络失败与超时。
- 单个 URL 错误不会影响其他 URL、托盘或桌宠。

---

## 8. 后台调度、请求状态与错误处理

### 8.1 调度要求

- 所有后台任务集中由 `TaskScheduler` 管理，模块不得私自创建无法清理的永久 interval。
- 应用启动后只启动 `enabled && configured` 的模块。
- 同一任务最多一个运行实例；重叠时跳过或取消前一次，不允许无限堆积请求。
- 网络请求支持 `AbortController` 或相应取消机制。
- 电脑从睡眠恢复后，重算下一次调度，不在恢复瞬间集中补发所有错过的请求。
- 应用退出前清理 timers、网络请求、loopback OAuth server 和临时资源。
- 自动轮询失败采用退避策略，并提供“立即重试”入口；不要无限高频重试。

### 8.2 错误分类

内部统一错误类别：

- `NOT_CONFIGURED`
- `AUTH_REQUIRED` / `AUTH_EXPIRED`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `NETWORK_ERROR`
- `TIMEOUT`
- `INVALID_RESPONSE`
- `REMOTE_SERVICE_ERROR`
- `CANCELLED`
- `UNKNOWN`

传给 renderer 的仅是安全的错误 code、经整理的用户说明、是否可重试和必要的 Request ID。不要传递原始 HTTP headers、令牌、SDK 内部对象或堆栈。

### 8.3 日志

- 记录模块启动/停止、耗时、状态码摘要、失败类别和 requestId。
- 日志不记录 API Key、AccessKey Secret、OAuth token、完整认证 URL、邮件正文。
- 默认保留最近 7 天或采用文件大小上限轮转。
- 在设置页提供“打开日志目录”和“复制脱敏诊断信息”，诊断信息不含凭据。

---

## 9. IPC 与安全实现约定

### 9.1 IPC 原则

- IPC channel 命名明确且有类型定义，按功能分组。
- 每个 handler 校验 `event.sender` 是本应用预期的 renderer，校验输入 shape、长度、枚举值和路径。
- renderer 不能传入任意命令、任意文件路径、任意 IPC channel、任意 headers 或任意代理请求。
- `preload` 不暴露 `ipcRenderer` 对象本身；仅包装固定方法。
- 关闭意外 `window.open`，限制导航到本地应用页面；打开官方 OAuth 页面时使用 `shell.openExternal` 前先严格匹配允许的 HTTPS 域名。
- 给本地内容设置 Content Security Policy；不执行远程脚本。

### 9.2 图片文件处理

- 通过 Electron `dialog.showOpenDialog` 选择 PNG 文件，不让 renderer 传任意系统路径进行复制。
- 校验文件类型和尺寸；为防止巨大图片占用内存，设置合理上限（例如 15 MB，之后可在设置中更改）。
- 将用户图片复制到 `userData/pets/`，保存稳定 assetId，而不是依赖原始路径。
- 默认保持原图宽高比；不把图片上传外部服务。
- 不将任何用户私有角色资产打包进公共版本。

### 9.3 防止密钥泄漏的检查项

每个阶段完成前搜索源码和构建文件：

- 是否有 API Key、AccessKey Secret、refresh token 被硬编码。
- 是否把敏感对象作为 IPC 返回值暴露给 renderer。
- 是否有 `console.log(headers)`、记录完整 request config 的日志。
- 是否将秘密放进 `.env` 中以 `VITE_` 开头的变量。
- 是否将开发者真实密钥、邮箱、SiteId 或个人网址写入示例文件。
- `.gitignore` 是否忽略 `.env*`（保留 `.env.example`）、本地配置、证书、release 临时凭据。

---

## 10. Windows 安装与发布

### 10.1 必须产物

每个正式版本最少输出：

1. **安装版：** `DesktopPetAssistant-Setup-<version>-x64.exe`（NSIS 安装程序，可选择安装路径，默认仅当前用户安装，尽量不要求管理员权限）。
2. **便携版：** `DesktopPetAssistant-Portable-<version>-x64.exe`，双击即可运行、不需要先安装。
3. **可选 ZIP：** 将便携版和 `README-使用说明.txt`、第三方许可清单放入同版本 ZIP。ZIP 解压后直接运行 portable exe。

名称可根据产品最终命名调整，但产物必须清楚标出版本与平台。

### 10.2 打包要求

- electron-builder 配置 NSIS 与 portable target。
- 目标架构第一版为 Windows x64；后续验证后再决定是否支持 ARM64。
- 配置应用名、版本、产品名、`.ico` 图标、快捷方式、开始菜单入口和卸载信息。
- 使用 `asar` 打包应用源码；用户配置和角色资产仍写在 `userData`，不能打进只读 `asar`。
- 正式安装/升级不覆盖用户配置。升级时运行 schema migration。
- 安装后可以通过开始菜单或桌面快捷方式启动；可配置开机启动，但默认选择需在常规设置中明确展示。
- 提供退出桌宠方式：托盘菜单的“退出”，关闭设置窗不应意外退出常驻进程。
- 第一次启动无需终端、npm、Node.js，也不能要求用户自己解压源码后运行脚本。
- 没有代码签名证书时，Windows 可能出现 SmartScreen 警告；README 需如实说明，不得声称安装包已签名。公开发布成熟后再评估代码签名。

### 10.3 发布构建与验收

- 优先在 Windows x64 环境完成打包并测试最终产物，避免只在其他操作系统上声称 Windows 包成功。
- CI 可以使用 GitHub Actions `windows-latest`，执行 lockfile 安装、lint、单测、生产构建、打包并上传 release artifacts。
- 构建完成后，在干净 Windows 用户环境中安装测试，验证首次启动、托盘、透明窗口、导入 PNG、配置保存、凭据加密和卸载行为。
- 必须在没有开发工具和 Node.js 的环境下做一次安装验证。
- 检查安装包与 portable exe 的哈希并记录发布版本。

### 10.4 README 必须包含

- 软件简介与截图。
- 安装版与便携版区别。
- 首次启动和角色图片导入说明。
- 每个模块的配置步骤与所需权限。
- Gmail OAuth 的应用发布/测试状态说明。
- DeepSeek 每日花费限制说明。
- 隐私说明、密钥存储方式和如何删除本地数据。
- 升级/卸载注意事项。
- 第三方依赖许可证清单与开源项目致谢（如果有实际复用代码）。

---

## 11. 测试与验收策略

### 11.1 自动化测试

至少覆盖：

- 日期倒计时：今天、明天、跨年、闰年、每年重复、无效日期。
- 时间范围：本地午夜转 UTC、跨时区日期、ESA StartTime / EndTime。
- 配置迁移：旧版无字段、未知字段、损坏 JSON、写入失败。
- Secret store：密钥加解密、加密不可用时不回退明文、密钥删除。
- DeepSeek：成功响应、多币种、空余额信息、401、429、超时、无效响应。
- ESA：聚合值存在/缺失、权限错误、采样率、时区边界、请求异常。
- 网站检测：HTTP 200、HTTP 404、TLS 错误、DNS 失败、超时、无效 URL。
- Gmail：首次建立基线、增量新邮件、重复消息去重、History ID 失效、refresh token 失效。
- 调度：停用模块后无进一步轮询、重试退避、并发去重。

所有单测使用 mock/fake response，不需要真实账号密钥。真实 API 验证作为可选人工 smoke test，由开发者自行配置测试账号完成。

### 11.2 人工回归清单

- [ ] 双击安装包可完成安装并启动，不需要终端。
- [ ] 托盘可打开设置，右键/托盘可退出。
- [ ] 桌宠可拖动，缩放无失真，重启后位置合理。
- [ ] 单张 PNG 导入成功，透明背景正常，角色文件保存在用户数据目录。
- [ ] 点击功能后出现 loading 状态；网络失败后出现 error 状态；UI 不会永久卡住。
- [ ] 关闭 Gmail / ESA / DeepSeek 模块后，不再自动请求对应服务。
- [ ] 用户密钥只在加密存储中，不出现在配置明文、renderer、日志或导出文件。
- [ ] 网站检测能区分请求超时和 HTTP 状态码错误。
- [ ] ESA 展示的是自然日的今日累计值，并注明更新时间和可能的数据采样/延迟。
- [ ] DeepSeek 不会将余额变化错误显示为今日消费。
- [ ] Gmail 不会在首次授权后把过去的历史邮件全部作为新邮件提醒。
- [ ] 电脑从睡眠恢复、网络中断后可正常恢复；某一模块出错不会关闭整个应用。
- [ ] portable 版本解压或直接运行符合说明，不依赖开发环境。

---

## 12. 分阶段开发计划与可直接复制的 Agent 任务

每阶段完成后由 Agent 先给出验收报告，再开始下一阶段。阶段之间不要求用户自行执行终端命令；如果 Agent 需要测试命令，可自行运行，并如实报告结果。

### 阶段 0：工程初始化与技术验证

**目标：** 建立稳定的 Electron + React + TypeScript 工程，不实现业务 API。

任务：

1. 创建项目、TypeScript 严格配置、格式化/lint、Vitest 和基础 README。
2. 按 main / preload / renderer 分开构建；建立初步目录结构。
3. 配置安全窗口选项：关闭 nodeIntegration、开启 contextIsolation 与 sandbox。
4. 添加 `npm run dev`、`npm run test`、`npm run build`、`npm run dist:win` 等明确脚本。
5. 配置 electron-builder NSIS + portable target 和 `release/` 输出目录。
6. 添加 `.gitignore`、非敏感 `.env.example`（如需要）和依赖许可证清单生成/检查策略。
7. 验证空白应用可开发运行，并能构建生产资源；若当前环境不是 Windows，记录需要在 Windows 环境完成的打包验证，不可声称 Windows 安装包已验证。

**不做：** Gmail、ESA、DeepSeek、日期业务、网站检测。

**验收：** 工程结构清晰；安全配置生效；测试/构建脚本可运行；开发和生产资源路径正确；README 说明开发者使用方法。

**Agent 提示词：**

```text
执行技术文档的阶段 0。项目从零创建。请先说明计划，然后创建 Electron + React + TypeScript 工程骨架、基础测试和 Windows 安装/便携打包配置。不要实现任何实际业务模块。确保最终用户无需 Node.js 和终端。完成后运行能运行的检查，并区分“已实测”和“尚需 Windows 环境实测”的项目。
```

### 阶段 1：桌宠窗口、外观和基础交互

**目标：** 在不接外部 API 的前提下，得到可日常使用的桌宠壳子。

任务：

1. 开始 UI 实现前，先阅读根目录 `DESIGN_SYSTEM.md` 并核对花墨设计规范网页的实际 token。
2. 建立全局设计 token 和最小公共组件基线，统一颜色、字体、间距、圆角、阴影、动效与控件状态。
3. 创建透明、无边框、始终置顶的桌宠窗口。
4. 支持 PNG 文件导入，图片存放在 userData；保留比例、缩放和拖动。
5. 实现单击菜单、简单弹跳动画、统一样式的思考/成功/失败气泡。
6. 创建符合设计规范的设置窗口、基础表单控件、系统托盘和安全退出路径。
7. 保存桌宠尺寸、位置、透明度（若支持）、置顶和动画配置。
8. 处理多显示器和分辨率变化，窗口重启后不跑出可见范围。
9. 添加单实例锁，避免用户重复启动多个常驻桌宠。
10. 在阶段验收中完成菜单、气泡、设置窗口及高 DPI 下的视觉检查；精确 token 的来源与未核实项需如实记录。

**验收：** 不填任何 API 配置，程序仍可正常运行；点击菜单功能按钮可演示 loading / success / error 状态；设置窗关闭不会意外退出整个应用。

**Agent 提示词：**

```text
执行阶段 1，只实现桌宠基础外壳和视觉基线。先阅读根目录 DESIGN_SYSTEM.md 并核对 https://flowersink.com/design/ 的实际 token，再落实统一 token、基础公共组件、透明窗口、置顶、拖动、导入单张 PNG、点击菜单、思考/成功/失败气泡、托盘、设置窗口与配置保存。将花墨设计语言适配到桌面 UI，不要复制博客布局，也不要凭感觉编造颜色或间距值。图片保存在 userData，不要打包用户图片。不要接入任何第三方 API。完成后跑测试/构建并检查实际界面，按功能与视觉验收条目逐一汇报。
```

### 阶段 2：配置中心、Secret Store、模块注册表和调度层

**目标：** 先搭好所有未来功能共用的基础设施。

任务：

1. 实现有 `schemaVersion` 的普通配置存储、验证和迁移。
2. 实现 safeStorage 异步 Secret Store。密钥不通过读取配置接口返回；保存和读取都在主进程。
3. 在加密不可用时拒绝明文持久化，并让用户知道原因。
4. 实现模块静态注册表：显示名称、启用状态、配置状态、启动/停止方法。
5. 实现统一 Scheduler：防止任务重叠、可取消请求、停用模块后停止轮询。
6. 实现安全 IPC 白名单、sender 校验、Zod 输入校验、脱敏 logger 和统一错误类型。
7. 为所有模块制作“未配置”的占位卡片，确保可以独立开关。

**验收：** 单测证明 secret 不会进入 config.json / renderer；模块开关影响 scheduler；密钥可清除；配置迁移在损坏文件时有备份/恢复提示。

**Agent 提示词：**

```text
执行阶段 2。建立安全的配置存储、Electron safeStorage Secret Store、模块注册表、统一调度器、类型化 IPC、输入校验、错误类型和脱敏日志。此阶段仍不接真实第三方 API。请增加测试，证明密钥不能以明文保存、不能通过 renderer API 读取，模块停用会停止任务。
```

### 阶段 3：日期事件与网站检测

**目标：** 完成两个不需要账号授权的功能，验证模块架构。

任务：

1. 完成日期事件 CRUD、一次性/每年重复、倒计时与空状态。
2. 完成网站 URL CRUD、手动 HTTP(S) 检测、耗时、状态码、错误分类。
3. 可选添加单个 URL 的后台定时检测，但默认关闭。
4. 增加配置验证、超时、取消、退避、错误提示和单测。

**验收：** 日期规则覆盖闰年/跨年/时区；网站检测可区分 HTTP 404 与网络超时；停用网站监控后 scheduler 不再触发请求。

**Agent 提示词：**

```text
执行阶段 3，仅实现日期事件和网站检测模块。日期支持一次性和每年重复；网站检测使用 HTTP(S) 请求，不以 Ping 作为唯一依据。必须处理超时、HTTP 错误、URL 校验与空状态；定时监控默认关闭。完成单测和手动验收说明。
```

### 阶段 4：DeepSeek 余额和阿里云 ESA 流量

**目标：** 实现两项使用 API Key / AccessKey 的数据查询。

任务：

1. DeepSeek：安全设置 API Key、测试连接、查询余额、多币种显示、手动刷新、更新时间与错误状态。
2. ESA：安全设置 RAM AccessKey ID / Secret / SiteId，使用官方 SDK，按本地自然日转换 UTC 查询 `Traffic` 聚合数据。
3. 凭据只传入主进程 service，禁止 renderer 发 API 请求。
4. 展示数据新鲜度和采样提示；自动刷新保持低频且可关闭。
5. DeepSeek“今日花费”明确显示为未支持，除非之后另有可验证的官方账号级接口；不可用余额差额估算。

**验收：** 使用 mock 测试不同 API 响应与异常；如果开发者提供测试凭据，再执行真实连接 smoke test。真实凭据不能写入仓库或交给 Agent 的长期记忆。

**Agent 提示词：**

```text
执行阶段 4，只实现 DeepSeek 余额和 ESA 今日流量。使用当前官方文档中的接口与 SDK。DeepSeek 余额通过 /user/balance 查询；不要把余额变化当作今日消费。ESA 使用 DescribeSiteTimeSeriesData，正确处理本地自然日转 UTC、Traffic 聚合值、SamplingRate 和更新时间。所有密钥走主进程 safeStorage，不得进 renderer 或日志。完成 mock 测试；没有真实密钥时请明确标注未进行真实 API 验证。
```

### 阶段 5：Gmail OAuth 与新邮件通知

**目标：** 完成需要授权和长期后台轮询的 Gmail 模块。

任务：

1. 建立 Gmail API / OAuth 连接流程、loopback 回调和 state 校验。
2. 凭据使用开发配置中的应用 Client ID；正式分发使用发布者准备并按要求完成配置/审核的 OAuth app。为高级用户预留覆盖 Client ID 的能力。
3. refresh token 加密存储，支持断开连接与本地删除。
4. 首次授权建立 baseline，不通知历史邮件；后续增量同步、消息 ID 去重、historyId 失效恢复。
5. 新邮件仅提取 From、Subject、Date、Message ID；不默认抓取邮件正文。
6. 实现 Windows 通知与气泡反馈；模块关闭后完全停止轮询。
7. 在 README 写清 Google Cloud 与 OAuth 发布要求。

**验收：** 使用测试邮箱完成新邮件通知；重启不重复通知；无效 token 能提示重新授权；退出/断开时关闭 OAuth listener 和 polling timers。

**Agent 提示词：**

```text
执行阶段 5，只实现 Gmail 新邮件提醒。使用 Gmail API + OAuth 2.0，不使用 SMTP 监听。采用安全的桌面 OAuth 回调、最小权限、加密保存 refresh token、增量同步和消息 ID 去重。首次授权不能把历史邮件全部推送。请将 Google Cloud/OAuth 应用需要发布者配置的事项记录在 README；不要在源码中提交真实凭据。
```

### 阶段 6：集成、可靠性、打包和发布验收

**目标：** 把所有已实现模块整合为可交付的 Windows 软件。

任务：

1. 逐项执行自动化测试、lint、生产构建与密钥扫描。
2. 检查应用启动、托盘、开机启动、休眠恢复、网络失败、无效凭据和模块停用。
3. 生成 Windows x64 NSIS 安装版和 portable 便携版；如条件允许，构建 ZIP。
4. 使用没有 Node.js 的 Windows 环境安装并验证最终产物。
5. 编写最终 README、隐私说明、配置教程、卸载说明和第三方许可清单。
6. 汇报构建产物的实际路径、版本、测试结果与已知限制。

**验收：** 安装版能直接安装运行；portable 版可按文档直接运行；最终用户不需要打开终端；用户配置在版本升级后保留；不含真实凭据。

**Agent 提示词：**

```text
执行阶段 6，对已完成的模块做集成与发布验收。运行现有 lint、测试、构建和 secret scan；修复问题后，在 Windows x64 环境构建 NSIS 安装版与 portable 便携版。不要只验证开发模式。检查没有 Node.js 的机器可以启动成品，保留用户配置，补齐 README、隐私说明和第三方许可清单。报告真实执行的测试和产物路径，区分未能验证的项目。
```

---

## 13. 交付定义（Definition of Done）

项目只有同时满足下列条件，才算完成第一版：

- [ ] 桌宠窗口与设置窗口稳定，托盘/退出入口可用。
- [ ] 用户能导入自己的透明 PNG，且图片不会被上传到外部服务。
- [ ] 日期事件与网站检测功能通过对应测试。
- [ ] DeepSeek 余额和 ESA 今日流量使用真实官方 API / SDK 逻辑，并通过 mock 测试。
- [ ] Gmail OAuth 和增量通知按阶段验收通过；若 OAuth 发布审核尚未完成，必须明确标记为未完成，不能宣传为所有用户开箱即用。
- [ ] 密钥不会以明文保存在配置、日志、导出文件或 renderer 中。
- [ ] 每个模块可以独立启用/停用，未配置模块不会影响程序启动。
- [ ] 应用遇到单模块错误时不会整体崩溃。
- [ ] Windows NSIS 安装版 `.exe` 已生成，并在 Windows x64 环境完成安装 smoke test。
- [ ] portable `.exe` 或 ZIP（至少其中一个）已生成并按说明验证。
- [ ] 最终用户不需要安装 Node.js、执行终端命令或手动复制源码。
- [ ] README、隐私说明、配置教程、限制说明与许可文件齐全。
- [ ] 发布产物不包含开发者个人 API Key、邮箱 token 或真实测试配置。

---

## 14. 关键决策与风险登记

| 风险 | 处理原则 | 第一版状态 |
|---|---|---|
| DeepSeek 账号级每日消费接口不存在或不公开 | 只显示官方余额；不伪造每日花费。持续核实官方接口后再决定是否实现 | 已明确边界 |
| Gmail OAuth 对公开分发有发布/验证要求 | 发布者负责准备 OAuth app；未完成时保留开发测试模式并明确标记 | 需要在发布前处理 |
| 阿里云 AccessKey 权限过大 | 使用最小权限 RAM 身份，限制 ESA 只读操作 | 实现时必须满足 |
| API Key 明文泄漏 | 主进程 + safeStorage + IPC 白名单 + 脱敏日志 + secret scan | 实现时必须满足 |
| 外部 API 不稳定或限流 | timeout、重试退避、低频轮询、模块隔离 | 实现时必须满足 |
| 用户升级丢配置 | 数据放 userData，配置 schema migration | 实现时必须满足 |
| 未签名安装包被 SmartScreen 警告 | 真实说明；若公开发行且有预算再做代码签名 | 第一版可未签名 |
| 参考仓库许可证不允许复用 | 默认仅参考设计；明确允许时才按条款复用 | 已明确边界 |

---

## 15. 官方文档与仓库链接

以下链接用于在开发阶段核对最新要求。第三方 API 的参数、权限、SDK 包名和 OAuth 政策可能变化，真正实现前必须重新读取对应官方页面。

### 参考仓库

- [yuqiangdede/desktop-pet](https://github.com/yuqiangdede/desktop-pet)
- [SeakMengs/WindowPet](https://github.com/SeakMengs/WindowPet)
- [Egger0/desk-pet](https://github.com/Egger0/desk-pet)
- [dengyie/OpenPet](https://github.com/dengyie/OpenPet)
- [louislam/Uptime Kuma](https://github.com/louislam/uptime-kuma)

### Electron 与 Windows 发布

- [Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [electron-builder NSIS](https://www.electron.build/nsis/)
- [electron-builder portable target](https://www.electron.build/nsis/#portable)

### Gmail 与 OAuth

- [Gmail API Node.js quickstart](https://developers.google.com/workspace/gmail/api/quickstart/nodejs)
- [Gmail API Push Notifications 与 history sync 说明](https://developers.google.com/workspace/gmail/api/guides/push)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google OAuth consent configuration](https://developers.google.com/workspace/guides/configure-oauth-consent)

### 阿里云 ESA

- [ESA API 概览与 SDK](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-overview)
- [DescribeSiteTimeSeriesData](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-describesitetimeseriesdata)
- [ESA RAM 权限策略参考](https://help.aliyun.com/zh/edge-security-acceleration/esa/security-and-compliance/edge-security-acceleration-system-permission-policy-reference)

### DeepSeek

- [DeepSeek 查询余额 API](https://api-docs.deepseek.com/zh-cn/api/get-user-balance/)
- [DeepSeek API 文档首页](https://api-docs.deepseek.com/zh-cn/)

---

## 16. 最终实施原则总结

本项目应当是一款可独立分发的 Windows 桌面软件，而不是一个只在开发者电脑上运行的代码示例。开发优先级始终是：

1. 先做稳定、安全的桌宠壳子；
2. 建立统一配置、加密凭据、IPC 和模块生命周期；
3. 按阶段添加日期、网站检测、DeepSeek、ESA、Gmail；
4. 严格区分“已实现”“接口不支持”“尚未完成 OAuth 发布配置”；
5. 最后在 Windows 环境验收 NSIS 安装版和便携版，确保非开发者双击即可使用。

不要为了赶进度把密钥交给 renderer，不要把不同仓库的代码硬拼在一起，不要为未验证的 API 编造数据，也不要把“本地成功构建”当作“Windows 安装包已验证”。
