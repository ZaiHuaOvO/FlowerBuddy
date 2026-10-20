<p align="center">
  <img src="assets/brand/app-icon/flowerbuddy-icon-transparent-256.png" width="96" height="96" alt="花伴 app icon">
</p>

# 花伴 (FlowerBuddy)

面向 Windows 的桌面宠物与个人信息助手。桌宠常驻桌面，提供备忘录与定时提醒、网站检测，以及 DeepSeek 余额和阿里云 ESA 流量查询。

> 当前版本 `0.1.0` 已发布：[GitHub Releases](https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest)。安装包未做代码签名，Windows SmartScreen 可能提示“未知发布者”。

## 核心功能

- **桌面宠物**：透明、无边框、始终置顶，可拖动和点击互动；右键打开快捷菜单，结果与提醒通过气泡展示。
- **形象管理**：内置 4 个预设形象，支持导入 PNG/JPEG 图片、切换、重命名和删除；所有图片仅保存在本机。
- **备忘录**：记录文本、粘贴图片、设置提醒时间，支持中文自然语言时间和日期选择器，并可将备忘锚定为桌面卡片。
- **定时提醒**：管理多个重复提醒，支持分钟/小时间隔、多段生效时间、± 随机值和常驻气泡提示。
- **网站检测**：从本机检查 HTTP(S) 状态、耗时与错误类型，可手动检测或按 5/10/15/30 分钟定时检测。
- **DeepSeek 余额与阿里云 ESA 流量**：需要自行提供 API 凭据；DeepSeek 显示账户余额，ESA 显示过去 24 小时、7 天、30 天的流量。
- **老板键与模块管理**：默认 `Alt+Z` 隐藏/恢复桌宠、通知、设置窗口、桌面卡片和托盘图标；各模块可独立启用、停用和排序。
- **系统页**：顶部固定“功能 / 设置 / 关于”。功能页展示备忘录、提醒、网站、DeepSeek 与 ESA 的真实业务内容；设置页只放软件设置、功能开关和模块配置；关于页显示版本、作者“再花”、GitHub 仓库与反馈入口。
- **快捷新建**：快捷菜单“功能”动作列表在备忘录启用时提供“新建备忘录”，与 `Alt+A` 共用同一流程，直接打开功能页并弹出新建编辑器。

## 获取与运行

从 [GitHub Releases](https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest) 下载对应版本：

- `FlowerBuddy-Setup-<version>-x64.exe`：安装版，默认按当前用户安装，可选择安装目录。
- `FlowerBuddy-Portable-<version>-x64.exe`：便携版，双击运行。

最终用户不需要安装 Node.js、打开终端或执行任何命令。安装程序会检测旧版本安装目录并在原位置覆盖升级，用户数据不会被清空。安装与卸载都不会自动删除 `%APPDATA%\FlowerBuddy` 中的个人数据。

## 隐私与安全

- 应用没有账号体系，也没有遥测；不会上传用户数据用于分析或广告。
- 设置、备忘录、定时提醒、网站检测配置与结果、粘贴图片、导入的桌宠图片和日志保存在 `%APPDATA%\FlowerBuddy`。
- API Key、AccessKey 等凭据只在主进程中处理，并通过 Electron `safeStorage`（Windows DPAPI）加密保存为 `secrets.enc.json`。
- 仅在相应模块已启用并配置后访问外部服务：DeepSeek 余额接口、阿里云 ESA API，以及你自行添加的网站 URL。
- 渲染进程启用沙箱、上下文隔离和严格 CSP；IPC 请求经过发送方校验与 Zod 输入校验。
- 退出应用后删除 `%APPDATA%\FlowerBuddy` 即可清除全部本地数据。卸载程序不会自动删除该目录。

详细说明见 [PRIVACY.md](PRIVACY.md)。

## 技术栈

Electron、React、TypeScript、Vite、Vitest、electron-builder。

## 开发者快速开始

以下命令仅面向贡献者和开发者，最终用户不需要执行。

环境要求：Windows x64、Node.js >= 22.12、npm。Windows 安装包必须在 Windows 上构建。

```bash
npm install
npm run dev
```

运行检查：

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

构建 Windows 安装版、便携版和 ZIP：

```bash
npm run dist:win
```

产物输出到 `release/`。仅生成未打包目录用于排查问题时，使用 `npm run dist:win:dir`。

正式发布通过版本标签触发 `Release` 工作流，版本号由维护者在本地决定；步骤见 [docs/development/release-process.md](docs/development/release-process.md)。

## 文档

- [AGENTS.md](AGENTS.md)：Agent 与贡献者的操作规则
- [docs/README.md](docs/README.md)：文档索引、权威来源与改动影响矩阵
- [docs/architecture/overview.md](docs/architecture/overview.md)：架构、进程边界与数据流
- [docs/development/coding-guidelines.md](docs/development/coding-guidelines.md)：编码与模块约定
- [docs/development/release-process.md](docs/development/release-process.md)：版本发布与自动打包流程
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)：设计 token、组件与视觉规范
- [docs/testing/strategy.md](docs/testing/strategy.md)：测试分层与运行方式
- [docs/testing/manual-test-plan.md](docs/testing/manual-test-plan.md)：手动功能与视觉验收清单
- [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)：未完成项与已知限制
- [PRIVACY.md](PRIVACY.md)：隐私说明

## 已知限制

- 安装包未签名，SmartScreen 可能提示未知发布者。
- DeepSeek 只显示余额；官方未提供账号级每日消费接口，因此不显示“今日花费”。
- ESA 数据可能被采样并存在统计延迟，接入点目前固定为国内 `esa.cn-hangzhou.aliyuncs.com`。
- 备忘录与定时提醒仅通过桌宠气泡展示，不发送 Windows 系统通知。
- 不提供自动更新、云端同步、macOS 或 Linux 版本。
- 多显示器、真实 DeepSeek/ESA 账户以及干净 Windows 环境的完整安装验收仍需在具备条件的环境中执行。

完整的待办与限制清单见 [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)。

## 想法与待办

以下为想法池，不代表已承诺实现；详细说明和待确认问题见 [docs/TODO.md](docs/TODO.md)。

- [ ] 锚定卡片拖拽合并（含提醒时间选择与二次确认）
- [ ] 锚定卡片直接编辑（先评估技术可行性与性能）
- [ ] 锚定卡片逐行完成勾选（可在设置中开启）

## 许可证

- 源代码、脚本、测试和文档文本采用 **MIT 许可证**，完整文本见根目录 [LICENSE](LICENSE)。
- 图案、角色形象、应用图标、托盘图标、安装器插图、桌宠预设/源图片和界面截图等美术素材**保留所有权利**，不随 MIT 许可授权；见 [ASSETS-LICENSE.md](ASSETS-LICENSE.md)。
- 第三方依赖遵循各自许可证，清单可通过 `npm run licenses` 生成。
- 如需商用或再分发美术素材，请先取得版权持有人的书面授权。
