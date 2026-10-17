# FlowerBuddy

Windows 桌面宠物与个人信息助手。当前处于 **阶段 0：工程初始化与技术验证**，只包含可运行的工程骨架、安全边界与打包流水线，**尚未实现任何业务模块**（日期、Gmail、ESA、DeepSeek、网站检测均未开始）。

## 最终用户须知

正式发布后，用户只需运行 `FlowerBuddy-Setup-<version>-x64.exe` 安装，或直接运行 `FlowerBuddy-Portable-<version>-x64.exe`。**最终用户不需要安装 Node.js，也不需要打开终端或执行任何命令。**

本仓库中的 `npm` 命令仅面向贡献者与 AI Agent。

> 当前构建产物未做代码签名，Windows SmartScreen 可能提示"未知发布者"。这是预期行为，不代表安装包已签名。

## 当前阶段已实现

- Electron + React + TypeScript（strict）+ electron-vite 工程，main / preload / renderer 分开构建。
- 安全窗口基线：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、`webSecurity: true`、禁用 `webview`。
- 窄 preload 桥：仅通过 `contextBridge` 暴露 `window.petApi`，不暴露 `ipcRenderer`、`fs`、`process` 等对象。
- IPC sender 校验：只接受本地 `index.html` 或开发服务器来源的帧。
- 导航与 `window.open` 拦截、权限请求全部拒绝、按开发/生产分别注入 CSP。
- Vitest 单元测试、ESLint、Prettier、TypeScript 类型检查。
- electron-builder 的 NSIS 安装版与 portable 便携版配置，产物输出到 `release/`。
- 自动生成的第三方依赖许可证清单与应用图标。

## 开发者环境

- Windows x64（打包必须在 Windows 上验证）
- Node.js >= 22.12
- npm（本项目锁定 `package-lock.json`）

```bash
npm install
```

> 部分 npm 版本默认拦截依赖的 install 脚本。若 `node_modules/electron/dist` 不存在，首次执行 `npm run dev` 或 `npx electron --version` 时会自动下载 Electron 二进制。

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
| `npm run icons`                           | 重新生成 `assets/app-icon.ico`                          |
| `npm run licenses`                        | 生成 `licenses/THIRD_PARTY_LICENSES.md`                 |
| `npm run dist:win`                        | 构建并打包 Windows x64 NSIS 安装版与便携版到 `release/` |
| `npm run dist:win:dir`                    | 只生成未打包的应用目录，便于排查打包问题                |

## 目录结构

```text
src/
  main/                  # 主进程：窗口、IPC、安全策略
    ipc/                 # IPC 注册与 sender 校验
    security/            # 安全窗口选项
  preload/               # contextBridge 窄桥
  renderer/              # React UI（Vite 根目录）
  shared/                # 主进程与渲染进程共享的类型/通道名
tests/unit/              # Vitest 单元测试
scripts/                 # 图标与许可证生成脚本
assets/                  # 应用图标等构建资源
out/                     # 构建输出（不入库）
release/                 # 安装包输出（不入库）
```

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

## 已知限制（阶段 0）

- 尚无桌宠窗口、托盘、设置界面等阶段 1 功能。
- `safeStorage` 加密存储、配置迁移、调度器、模块注册表属于阶段 2。
- 未配置代码签名；安装包哈希尚未纳入发布流程。
- 尚未在"无 Node.js 的干净 Windows 环境"中做安装验证（阶段 6 要求）。

## 许可证

本项目自有代码暂未声明开源许可证。第三方依赖的许可证见 `npm run licenses` 生成的清单。发布前需补全隐私说明与最终许可文件。
