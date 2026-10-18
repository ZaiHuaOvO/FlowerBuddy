# 测试策略

> 状态：**操作规范**。依据 2026-10-17（提交 `a635bb9`）的 `package.json`、`vitest.config.ts`、`tsconfig.json`、`src/renderer/tsconfig.json`、`.github/workflows/ci.yml` 与 `tests/unit/` 实际内容整理。
> 本文只说明测试分层和方法；本轮没有重新执行测试，不代表任何测试结果。
> 手动验收清单见 [manual-test-plan.md](manual-test-plan.md)。

## 1. 测试分层

| 层级           | 工具/入口                                  | 当前范围                                   | 能证明什么                         | 不能证明什么                      |
| -------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------------- | --------------------------------- |
| 格式检查       | Prettier（`format:check`）                 | 仓库文本格式                               | 格式一致                           | 行为正确性                        |
| 静态检查       | ESLint（`lint`）                           | 语法、Hooks、未使用变量等                  | 常见静态问题                       | 运行时行为                        |
| 类型检查       | `tsc --noEmit` 两套配置                    | 主进程/preload/shared/tests + renderer/TSX | 类型契约一致                       | 真实外部 API、窗口行为            |
| 单元测试       | Vitest（`test`）                           | `tests/unit/`，Node 环境                   | 纯逻辑、服务、存储、调度、错误映射 | 真实网络、真实凭据、系统托盘、DPI |
| 生产构建       | `build` / `electron-vite build`            | main/preload/renderer 到 `out/`            | 构建可完成、资源路径可解析         | 安装包行为                        |
| 打包           | `dist:win` / `dist:win:dir`                | NSIS + portable + ZIP                      | Windows 产物可生成                 | 干净环境安装、签名、SmartScreen   |
| CI             | `.github/workflows/ci.yml`                 | Windows 上的检查与可选打包                 | 托管环境可重复检查                 | 真实账户、物理显示器、人工交互    |
| 手动功能验收   | [manual-test-plan.md](manual-test-plan.md) | 安装、托盘、拖动、通知、休眠等             | 真实桌面行为                       | 全球可用性、跨平台                |
| 视觉回归       | 固定 fixture + 截图对比（人工或脚本）      | 12 个界面基线                              | 关键界面像素稳定性                 | 未覆盖的 DPI/主题/长文本          |
| 外部凭据 smoke | 用户自己的 Gmail/DeepSeek/ESA              | 真实账户联调                               | 真实认证与数据映射                 | 所有边界和异常                    |

## 2. 如何运行

先确认 `package.json` 中的脚本真实存在，再按改动范围运行：

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

涉及 Windows 安装行为时：

```bash
npm run dist:win:dir
npm run dist:win
```

说明：

- `npm run typecheck` = `typecheck:node` + `typecheck:web`。
- `npm test` 等价于 `vitest run`；`npm run test:watch` 用于开发时监听。
- `npm run build` 会先运行 `typecheck`，再执行 `electron-vite build`。
- `npm run dist:win` 会执行构建、生成许可证、运行 electron-builder（NSIS + portable）并生成便携 ZIP。
- 纯文档变更通常只需 `git diff --check` 和链接/格式检查；不需要无理由重跑全部业务构建。

## 3. 当前自动化覆盖范围

`tests/unit/` 现有 30 个测试文件，按实际文件名归类：

| 区域       | 测试文件                                                                                                              | 主要覆盖                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 备忘录     | `memo-service.test.ts`、`memo-reminder.test.ts`、`memo-module.test.ts`、`memo-images.test.ts`                         | 排序/完成/锚点、中文时间解析、到点提醒去重、图片校验与清理 |
| 网站检测   | `website-check.test.ts`、`website-service.test.ts`、`website-module.test.ts`                                          | HTTP 状态、超时、DNS/TLS 分类、URL 清洗、定时任务重建      |
| DeepSeek   | `deepseek-service.test.ts`、`deepseek-module.test.ts`                                                                 | 响应结构、多币种、错误码、余额格式化                       |
| ESA        | `esa-service.test.ts`、`esa-module.test.ts`                                                                           | 本地自然日转 UTC、Traffic 聚合、采样率、错误映射           |
| Gmail      | `gmail-headers.test.ts`、`gmail-service.test.ts`、`gmail-module.test.ts`                                              | 基线、增量、去重、historyId 失效、授权失效、轮询停止       |
| 调度       | `task-scheduler.test.ts`                                                                                              | 间隔、重叠跳过、退避、停止、恢复重新计时                   |
| 模块管理   | `module-manager.test.ts`、`module-action-runner.test.ts`                                                              | enabled/configured 生命周期、动作校验、请求失效、超时      |
| 配置与存储 | `config-store.test.ts`、`pet-assets.test.ts`、`memo-images.test.ts`、`assets.test.ts`                                 | 迁移/损坏修复、原子写入、PNG 校验、图片目录清理            |
| 安全       | `secret-store.test.ts`、`logger.test.ts`、`web-preferences.test.ts`、`validate-sender.test.ts`、`ipc-schemas.test.ts` | 加密不可用不回退、脱敏、窗口选项、sender 校验、Zod 边界    |
| 几何/窗口  | `geometry.test.ts`、`memo-card-geometry.test.ts`                                                                      | 尺寸、缩放、可见区域、overlay 定位、卡片四角缩放           |
| IPC 桥     | `preload-api.test.ts`                                                                                                 | 按视图暴露 API、通道调用                                   |
| 设置页     | `settings-formatters.test.ts`、`settings-tabs.test.ts`                                                                | 格式化、tab 渲染                                           |

> `docs/regression-report.md` 记录 2026-10-17 的一次执行结果（27 个文件、199 项通过）。这是历史记录，不是本轮测试结果；不要在新文档中把它写成“当前已通过”。

## 4. CI

`.github/workflows/ci.yml`：

- 触发：推送到 `main`、`v*` tag、Pull Request、手动触发。
- `check` job（`windows-latest`）：`npm ci` → `typecheck` → `lint` → `format:check` → `test` → `build`。
- `package` job：仅在 tag 或手动触发时运行，执行 `dist:win` 并上传 `.exe`、`.zip`、`.blockmap`。

CI 不能替代真实账户、真实显示器、原生对话框、系统托盘和安装/卸载的人工验收。

## 5. 单元测试约定

- 测试文件位于 `tests/unit/`，使用 Vitest，环境为 `node`。
- 显式导入 `describe` / `it` / `expect` / `vi`。
- 外部依赖通过注入替换：
  - 网络：`fetchImpl`；
  - Gmail：`clientFactory`；
  - ESA：`clientFactory`；
  - 时间：`now`；
  - 加密：`SafeStorageBackend`；
  - 文件系统：使用临时目录或在测试中构造输入。
- 不访问真实网络，不使用真实 API Key、AccessKey 或 OAuth token。
- 新增测试后运行 `npm test`；涉及 renderer 类型时运行 `npm run typecheck`。
- 若新增导入 `.tsx` 的测试，需要同时维护两套 tsconfig：
  - `tsconfig.json` 的 `exclude`；
  - `src/renderer/tsconfig.json` 的 `include`。
    参考 `settings-tabs.test.ts` 的现有处理方式。

## 6. 手动与视觉测试

使用 [manual-test-plan.md](manual-test-plan.md) 逐条执行。建议：

- 使用隔离的 user data 目录启动，避免读写真实用户配置：
  ```bash
  # 仅示例；实际参数以当前 Electron/构建方式为准
  # 可执行文件名保留 FlowerBuddy.exe；显示名称为“花伴”
  FlowerBuddy.exe --user-data-dir=<临时目录>
  ```
- 网站检测使用本机临时 HTTP 服务构造 200/404/500/超时，不依赖外网。
- 视觉回归使用固定配置和固定日期 fixture，在相同窗口尺寸、相同缩放比例下截图。
- 截图基线位于 `docs/screenshots/`，最近一次完整回归记录见 `docs/regression-report.md`。
- 视觉对比应记录：变化像素数、占比、平均差、最大差；不要只写“看起来一样”。
- 依赖系统鼠标位置或真实输入时序的测试（例如快捷菜单的悬停展开、移出延时关闭、拖拽、原生窗口定位）必须独占鼠标：执行前确认用户不再移动鼠标；测试过程中若光标位置、移动轨迹、焦点或时序与脚本预期不符，应判定本次结果无效、拒绝采信并向用户说明，重新执行，不得把受干扰的运行记为通过。
- CDP/页面级合成事件不会移动系统光标；涉及 `screen.getCursorScreenPoint()` 等主进程逻辑时，必须使用真实系统光标移动来验证，并记录预期位置与实际行为；发现不一致时以“受干扰”处理。

## 7. 外部凭据测试的前置条件

以下测试只能在用户自己的环境执行；不得把真实凭据写入仓库、文档、截图、测试夹具或聊天记录。

### Gmail

- Google Cloud 项目已启用 Gmail API。
- 已配置 OAuth consent screen；未发布应用需把测试账号加入测试用户。
- 已创建“桌面应用”类型的 OAuth 客户端。
- 在应用“设置 → Gmail”中填写 Client ID / Client Secret，并在系统浏览器完成授权。
- 只验证 `gmail.readonly` 范围内的元数据读取。

### DeepSeek

- 用户自己的 DeepSeek API Key。
- 在应用设置中保存后查询余额；不要提供“今日花费”，官方账号级接口不在当前范围。

### 阿里云 ESA

- 建议使用只授予 `esa:DescribeSiteTimeSeriesData` 权限的 RAM 子账号。
- 站点 ID 与 AccessKey 在应用设置中填写。
- 国内站端点固定为 `esa.cn-hangzhou.aliyuncs.com`；国际站账号可能无法查询，属于已知限制。

## 8. 当前不自动化或无法自动化的部分

- 系统托盘图标、托盘菜单点击、双击打开设置。
- 桌宠真实拖动、点击与拖动区分、多显示器物理移动。
- 原生文件选择对话框中的 PNG 导入。
- Windows 安装/卸载向导、开始菜单/桌面快捷方式、SmartScreen。
- 系统通知的实际显示与点击。
- 真实休眠/唤醒后的调度恢复。
- 不同 Windows DPI、主题、减少动态效果设置下的视觉表现。
- 真实 Gmail/DeepSeek/ESA 账户数据。

这些项目必须在 [manual-test-plan.md](manual-test-plan.md) 中人工确认，或明确标记为待测/已知限制。

## 9. 失败与结果记录

- 测试失败时先判断是否由本次改动引入；不要通过跳过、删除或放宽断言来“修复”。
- 环境限制或既有问题必须记录命令、错误摘要和影响范围。
- 没有实际运行记录时，不得在报告、README 或提交信息中写“测试通过”。
- 测试策略或 CI 变化时，同步更新本文、[manual-test-plan.md](manual-test-plan.md) 和 [文档索引](../README.md)。
