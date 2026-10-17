# FlowerBuddy

Windows 桌面宠物与个人信息助手。当前已完成 **阶段 1：桌宠窗口、外观和基础交互**，尚未接入任何第三方 API 或业务模块（日期、Gmail、ESA、DeepSeek、网站检测均未开始）。

## 最终用户须知

正式发布后，用户只需运行 `FlowerBuddy-Setup-<version>-x64.exe` 安装，或直接运行 `FlowerBuddy-Portable-<version>-x64.exe`。**最终用户不需要安装 Node.js，也不需要打开终端或执行任何命令。**

本仓库中的 `npm` 命令仅面向贡献者与 AI Agent。

> 当前构建产物未做代码签名，Windows SmartScreen 可能提示"未知发布者"。这是预期行为，不代表安装包已签名。

## 当前阶段已实现

- 透明、无边框、始终置顶的桌宠窗口，按住拖动不误判为点击。
- 单击桌宠打开快捷菜单，并播放约 220ms 的弹跳动画（可在设置中关闭）。
- 快捷菜单包含演示动作、打开设置、隐藏桌宠和退出；托盘提供设置、显示/隐藏桌宠和退出入口。
- 独立的气泡窗口，支持 `idle` / `loading` / `success` / `empty` / `error` 五种状态、自动消失与手动关闭。
- 设置窗口：始终置顶、弹跳动画、气泡停留时长、桌宠缩放、导入 PNG、重置位置。
- 单张 PNG 导入：校验格式与大小（≤15 MB），复制到用户数据目录，保留宽高比。
- 桌宠位置、尺寸和设置持久化到用户数据目录的 `config.json`，采用临时文件 + rename 原子写入并带 `schemaVersion`。
- 多显示器与分辨率变化时自动把桌宠移回可见区域；单实例锁避免重复启动。
- 安全基线：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、窄 preload 桥、IPC sender 校验、导航与 `window.open` 拦截、权限请求全部拒绝、严格 CSP。
- 桌宠图片通过自定义 `flowerbuddy-pet://` 协议提供；主进程只允许读取当前配置的形象和内置默认形象。
- Vitest 单元测试、ESLint、Prettier、TypeScript 类型检查。
- electron-builder 的 NSIS 安装版与 portable 便携版配置，产物输出到 `release/`。

## 开发者环境

- Windows x64（打包必须在 Windows 上验证）
- Node.js >= 22.12
- npm（本项目锁定 `package-lock.json`）

```bash
npm install
```

> 部分 npm 版本默认拦截依赖的 install 脚本。若 `node_modules/electron/dist` 不存在，首次执行 `npm run dev` 或 `npx electron --version` 时会自动下载 Electron 二进制。

> 打包使用 `electron-builder.yml` 中的 `electronDist: node_modules/electron/dist`，直接复用已安装的 Electron 发行目录，避免每次构建重复下载。

## 常用脚本

| 命令                                      | 作用                                                    |
| ----------------------------------------- | ------------------------------------------------------- |
| `npm run dev`                             | 启动开发模式（Vite HMR + Electron）                     |
| `npm run preview`                         | 以生产构建结果启动 Electron                             |
| `npm run typecheck`                       | 主进程/预加载与渲染进程两套 TypeScript 检查             |
| `npm run lint`                            | ESLint                                                  |
| `npm run format` / `npm run format:check` | Prettier 格式化 / 检查                                  |
| `npm test`                                | Vitest 单元测试                                         |
| `npm run build`                           | 类型检查 + 生产构建到 `out/`                            |
| `npm run icons`                           | 重新生成应用图标与托盘图标                              |
| `npm run pets`                            | 从 `assets/pet-source.webp` 重新生成默认桌宠 PNG        |
| `npm run assets`                          | 依次生成图标与默认桌宠图片                              |
| `npm run licenses`                        | 生成 `licenses/THIRD_PARTY_LICENSES.md`                 |
| `npm run dist:win`                        | 构建并打包 Windows x64 NSIS 安装版与便携版到 `release/` |
| `npm run dist:win:dir`                    | 只生成未打包的应用目录，便于排查打包问题                |

## 目录结构

```text
src/
  main/                  # 主进程：窗口、托盘、IPC、安全策略
    ipc/                 # IPC 注册与 sender 校验
    protocol/            # 桌宠图片自定义协议
    security/            # 安全窗口选项
    storage/             # 配置存储与图片导入
    tray/                # 系统托盘
    windows/             # 桌宠/菜单/气泡/设置窗口与几何计算
  preload/               # contextBridge 窄桥（按窗口分域）
  renderer/              # React UI（Vite 根目录，按 ?view= 分视图）
    src/components/      # 按设计规范实现的公共组件（Button 等）
    src/styles/          # tokens.css 与各视图样式
  shared/                # 主进程与渲染进程共享的类型/通道名
tests/unit/              # Vitest 单元测试
scripts/                 # 图标、默认形象与许可证生成脚本
assets/                  # 应用图标、托盘图标、默认桌宠与桌宠源文件
docs/screenshots/        # 视觉回归截图
out/                     # 构建输出（不入库）
release/                 # 安装包输出（不入库）
```

## 使用说明

- 启动后桌宠出现在桌面右下角，默认高度约 160px（可在设置中按 0.5×–2× 缩放）；按住拖动可移动，单击打开快捷菜单，右键同样打开菜单。
- 单击托盘图标或双击托盘可打开设置；托盘菜单可显示/隐藏桌宠或退出。
- 设置中的“导入 PNG 图片”会把图片复制到用户数据目录，不会上传到任何外部服务。
- 关闭设置窗口不会退出程序；必须通过托盘或快捷菜单的“退出 FlowerBuddy”结束。
- 用户数据位于 Electron `userData` 目录（Windows 通常为 `%APPDATA%\FlowerBuddy`），包含 `config.json` 与 `pets/`。
- 快捷菜单中的两个“演示”动作仅用于验证 loading / success / error 状态，后续阶段会被真实功能替代。

## 设计系统与视觉基线

- 视觉规范以 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) 为准；设计 token 集中定义在 [tokens.css](src/renderer/src/styles/tokens.css)，业务样式不硬编码颜色、间距、圆角或阴影。
- Token 来源：花墨设计规范 <https://flowersink.com/design/>，核对日期 2026-10-17，直接读取其公开样式中的 `--fi-*` 自定义属性。
- 已核验并落地：颜色 token、间距标尺（4–52px）、圆角（8/10/14/18px 等）、三档阴影、字体栈与字号/字重/行高、动效时长（0.16/0.24/0.32s）与缓动、控件高度（28/36/44px）、表单默认/悬停/聚焦/禁用状态。
- 主按钮另按线上 `.fl-button--solid` 组件实测对齐：背景 `#8b5a2b`、白色文字、34px 高、10px 圆角、500 字重。
- 派生值：为适配 Windows 中文显示，在规范字体栈末尾追加了 Microsoft YaHei 回退。
- 已实测：按钮默认/hover/按下/focus-visible/禁用、下拉框 focus、气泡 success/error、快捷菜单与设置窗口；模拟 `prefers-reduced-motion: reduce` 后弹跳动画数量为 0 且过渡降至 0.01ms；托盘图标为有效的 64×64 PNG；在 640/780/960px 宽度与 100%/125%/150%/200% 缩放下无横向溢出。
- 截图（200% 缩放下采集，桌宠/菜单/气泡保留透明通道）：[桌宠](docs/screenshots/pet.png)、[快捷菜单](docs/screenshots/quick-menu.png)、[成功气泡](docs/screenshots/bubble-success.png)、[失败气泡](docs/screenshots/bubble-error.png)、[设置窗口](docs/screenshots/settings.png)。

## 安全设计

- 凭据只允许在主进程中处理；渲染进程永远不持有 API Key、AccessKey Secret 或 OAuth token。
- `config.json`、日志、导出文件不得包含明文密钥；敏感值将使用 Electron `safeStorage` 加密（阶段 2 实现）。
- 所有窗口统一使用 `src/main/security/web-preferences.ts` 中的安全选项。
- 每个 IPC handler 先校验 `event.senderFrame.url`，只接受本应用渲染内容。
- 生产环境渲染进程只加载本地文件，并注入严格 CSP；开发环境额外允许 React Refresh 内联脚本与本地 HMR WebSocket。

## 打包

```bash
npm run dist:win
```

产物（`release/`）：

- `FlowerBuddy-Setup-<version>-x64.exe`：NSIS 安装程序，默认按当前用户安装，可选择安装目录。
- `FlowerBuddy-Portable-<version>-x64.exe`：便携版，双击运行。

用户数据将保存在 Electron `userData` 目录，升级不会覆盖；不会写入安装目录。

## 已知限制（阶段 1）

- 尚无任何业务功能；快捷菜单中的演示动作不是真实数据。
- `safeStorage` 加密存储、配置迁移、调度器、模块注册表属于阶段 2。
- 全局快捷键、开机启动、点击穿透、多角色管理尚未实现。
- 未配置代码签名；安装包哈希尚未纳入自动发布流程。
- 尚未在“无 Node.js 的干净 Windows 环境”中做安装验证（阶段 6 要求）。

完整的待办与限制清单见 [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)，每阶段验收时更新。

## 许可证

本项目自有代码暂未声明开源许可证。第三方依赖的许可证见 `npm run licenses` 生成的清单。发布前需补全隐私说明与最终许可文件。
