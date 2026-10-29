<p align="center">
  <img src="assets/brand/app-icon/flowerbuddy-icon-transparent-256.png" width="96" height="96" alt="花伴 app icon">
</p>

# 花伴 (FlowerBuddy)

面向 Windows 的桌面宠物与个人信息助手。桌宠常驻桌面，提供备忘录与定时提醒、网站检测，以及 DeepSeek 余额和阿里云 ESA 流量查询。

> 当前版本 `0.2.0` 已发布：[GitHub Releases](https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest)。安装包未做代码签名，Windows SmartScreen 可能提示“未知发布者”。
>
> v0.2.0 主要更新：系统页“功能/设置/关于”、官方 app-icon、备忘卡片右键编辑与逐行打勾、官网与安装版应用内更新。完整说明见 [v0.2.0 Release Notes](docs/releases/v0.2.0.md)。

## 核心功能

- **桌面宠物**：透明、无边框、始终置顶，可拖动和点击互动；右键打开快捷菜单，结果与提醒通过气泡展示；气泡支持小 / 中 / 大 / 超级四档尺寸，超级档改为屏幕顶部的常驻大提示框。
- **形象管理**：内置 4 个预设形象，支持导入 PNG/JPEG 图片、切换、重命名和删除；所有图片仅保存在本机。
- **备忘录**：记录文本、粘贴图片、设置提醒时间，支持中文自然语言时间和日期选择器，并可将备忘锚定为桌面卡片；卡片标题栏提供新建、锁定、完成与关闭操作，锁定后其余区域鼠标穿透；右键卡片正文或标题可在原位编辑正文并自动保存；逐行打勾可在新建/编辑弹窗或备忘录列表中按条开启，设置中的开关只作为新建默认值。
- **定时提醒**：管理多个重复提醒，支持分钟/小时间隔、多段生效时间、± 随机值和常驻气泡提示。
- **网站检测**：从本机检查 HTTP(S) 状态、耗时与错误类型，可手动检测或按 5/10/15/30 分钟定时检测。
- **DeepSeek 余额与阿里云 ESA 流量**：需要自行提供 API 凭据；DeepSeek 显示账户余额，ESA 显示过去 24 小时、7 天、30 天的流量。

## 获取与运行

官网与使用说明：<https://zaihuaovo.github.io/FlowerBuddy/>（站点位于独立 `website/` 目录，部署配置见 [website/README.md](website/README.md)）。自定义域名 `https://tool.flowersink.com/flowerbuddy/` 需要服务器按该文档同时转发 `/flowerbuddy/` 与 `/FlowerBuddy/` 后才能正常显示样式和导航。

从 [GitHub Releases](https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest) 下载对应版本：

- `FlowerBuddy-Setup-<version>-x64.exe`：安装版，默认按当前用户安装，可选择安装目录。
- `FlowerBuddy-Portable-<version>-x64.exe`：便携版，双击运行。

最终用户不需要安装 Node.js、打开终端或执行任何命令。安装程序会检测旧版本安装目录并在原位置覆盖升级，用户数据不会被清空。安装与卸载都不会自动删除 `%APPDATA%\FlowerBuddy` 中的个人数据。

## 隐私与安全

- 应用没有账号体系，也没有遥测；不会上传用户数据用于分析或广告。
- 设置、备忘录、定时提醒、网站检测配置与结果、粘贴图片、导入的桌宠图片和日志保存在 `%APPDATA%\FlowerBuddy`。
- API Key、AccessKey 等凭据只在主进程中处理，并通过 Electron `safeStorage`（Windows DPAPI）加密保存为 `secrets.enc.json`。
- 仅在相应模块已启用并配置后访问外部服务：DeepSeek 余额接口、阿里云 ESA API，以及你自行添加的网站 URL；安装版在用户手动检查更新时访问 GitHub Releases。
- 渲染进程启用沙箱、上下文隔离和严格 CSP；IPC 请求经过发送方校验与 Zod 输入校验。
- 退出应用后删除 `%APPDATA%\FlowerBuddy` 即可清除全部本地数据；自动更新下载缓存可能位于 `%LOCALAPPDATA%`，需要单独清理。卸载程序不会自动删除这些目录。

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
- 安装版已接入 GitHub 源应用内更新，但仍需真实 Windows 双版本升级验证；便携版保持手动下载。不提供云端同步、macOS 或 Linux 版本。
- 多显示器、真实 DeepSeek/ESA 账户以及干净 Windows 环境的完整安装验收仍需在具备条件的环境中执行。

完整的待办与限制清单见 [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)。

## 想法与待办

以下与 [docs/TODO.md](docs/TODO.md) 同步：展示全部待开发、搁置和已完成条目；已明确取消的需求不再列出。

### 待开发

- [ ] 安装程序样式优化（欢迎页、侧边栏、完成页、深色与高 DPI）
- [ ] 有新版本时在页面显示“有新版本”标签（并核实“配置来自更高版本”提示的出现场景）
- [ ] 更新公告弹窗（入口在关于页，更新后自动弹出，最新版本在最顶部）
- [ ] 滚动条样式优化（统一设置页、弹窗与形象条的滚动条方案）

### 搁置

- [ ] 安装包签名（暂缓，优先评估免费开源签名渠道）
- [ ] 模块设置页与功能管理页的启用开关重复（待定，尚未考虑清楚）

### 已完成

以下条目已完成，仅作归档。

- [x] ~~锚定卡片直接编辑~~
- [x] ~~锚定卡片逐行打勾~~
- [x] ~~软件官网（VitePress）~~
- [x] ~~自动更新~~
- [x] ~~快捷功能增加“新建备忘录”~~
- [x] ~~设置与功能页面重新划分~~
- [x] ~~气泡重新设计（四档尺寸）~~
- [x] ~~锚定备忘卡片：锁定、添加与取消置顶~~

## 许可证

- 源代码、脚本、测试和文档文本采用 **MIT 许可证**，完整文本见根目录 [LICENSE](LICENSE)。
- 图案、角色形象、应用图标、托盘图标、安装器插图、桌宠预设/源图片和界面截图等美术素材**保留所有权利**，不随 MIT 许可授权；见 [ASSETS-LICENSE.md](ASSETS-LICENSE.md)。
- 第三方依赖遵循各自许可证，清单可通过 `npm run licenses` 生成。
- 如需商用或再分发美术素材，请先取得版权持有人的书面授权。
