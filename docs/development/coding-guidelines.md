# 开发约定

> 状态：**操作规范**，其中“已存在的约定”来自 2026-10-17（提交 `a635bb9`）的源码、TypeScript/ESLint/Prettier/Vitest 配置与测试风格。
> 本文区分“当前已存在”与“建议未来采用”。建议不代表当前代码已经这样实现。
> 架构边界见 [架构概览](../architecture/overview.md)；视觉规则见 [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md)。

## 1. 工具与格式

当前配置（以仓库文件为准）：

- TypeScript `strict: true`，并启用：
  - `noUncheckedIndexedAccess`
  - `noImplicitOverride`
  - `noFallthroughCasesInSwitch`
  - `noUnusedLocals` / `noUnusedParameters`
  - `exactOptionalPropertyTypes`
  - `isolatedModules` / `verbatimModuleSyntax`
  - `moduleResolution: "Bundler"`，`noEmit: true`
- Prettier：不加分号、单引号、每行 100 字符、不加尾逗号、箭头函数参数始终加括号、LF 换行。
- ESLint：`@eslint/js` recommended + `typescript-eslint` recommended；renderer 额外启用 React Hooks 与 react-refresh 规则。
- Vitest：Node 环境，`restoreMocks: true`，只收集 `tests/**/*.test.ts`。

实践要求：

- 使用 `import type { ... }` 导入纯类型（`verbatimModuleSyntax` 会强制）。
- 注意 `exactOptionalPropertyTypes`：可选属性不能显式赋 `undefined`，需要省略该键或调整类型。
- 注意 `noUncheckedIndexedAccess`：数组下标和 `Record` 取值可能为 `undefined`，先收窄再使用。
- 不新增未使用的变量或参数；确需保留时用下划线前缀并确认规则允许。
- 新增测试若导入 `.tsx`，参考现有 `tests/unit/settings-tabs.test.ts` 的配置方式：主进程 `tsconfig.json` 排除它，`src/renderer/tsconfig.json` 纳入它。

## 2. 文件组织与命名（已存在）

- 目录按进程和职责分层：`src/main`、`src/preload`、`src/renderer/src`、`src/shared`。
- 文件名使用 kebab-case：
  - `app-controller.ts`、`task-scheduler.ts`、`config-store.ts`
  - 模块内使用 `<name>-service.ts`、`<name>-module.ts`、`types.ts`
- React 组件文件使用 PascalCase（`Button.tsx`、`GeneralSettingsTab.tsx`）；组件本身使用命名导出。
- 唯一的 default export 是 `settings/SettingsApp.tsx`，用于 `React.lazy(() => import(...))`；新增公共组件默认使用命名导出。
- Hook 以 `use` 开头（`useDatesSettings.ts`）。
- 常量使用 SCREAMING_SNAKE_CASE（`MENU_SIZE`、`MAX_MESSAGES_PER_POLL`）；普通函数和变量使用 camelCase。
- CSS 类统一 `fl-` 前缀表示公共组件（`fl-button`、`fl-select`）；视图类名按视图组织（`menu-panel`、`settings-*`）。
- 测试文件为 `tests/unit/<topic>.test.ts`，测试描述使用英文短语（如 `describe('task scheduler', ...)`），与现有风格保持一致。

## 3. 类型与模块边界（已存在）

- 主进程、preload、renderer 共享的公共类型和 IPC 通道名放在 `src/shared/api.ts`；该文件不得包含凭据。
- 模块私有类型放在对应目录的 `types.ts`（如 `modules/memo/types.ts`）。
- 主进程内部错误使用 `AppError`（`src/main/shared/errors.ts`），其 `code` 来自 `src/shared/api.ts` 的 `AppErrorCode`。
- 对 renderer 只暴露 `PublicError`：`{ code, message, retryable }`。
- 依赖方向：
  - `shared` 不依赖 main/preload/renderer。
  - `main` 可依赖 `shared`；`storage`、`security`、`shared` 不反向依赖窗口/IPC/托盘/协调器。
  - 业务模块不依赖 `windows/`、`tray/`、`ipc/` 或 `app-controller.ts`。
  - `preload` 只依赖 `shared` 和 Electron。
  - `renderer` 只通过 `window.*Api` 与主进程交互，只使用共享类型和 `preload/index.d.ts` 声明。
- 不建议新增 `any`；当前 ESLint 配置未单独强制该规则，但新代码应优先使用具体类型、联合类型或 `unknown` 后收窄。

## 4. 主进程约定（已存在）

- `src/main/index.ts` 只负责启动装配和全局事件；业务逻辑放在 service/module、窗口控制器或 `AppController`。
- `AppController` 是协调者：它对 renderer 暴露用例方法，组合模块、窗口、托盘、存储和安全组件；不要把某个模块的网络细节写进协调器。
- 窗口创建集中在 `src/main/windows/`：
  - 所有窗口必须使用 `createSecureWebPreferences()`。
  - 导航与 `window.open` 防护由 `security/navigation-guards.ts` 统一安装，新增窗口或页面不得绕过允许列表。
  - 几何计算放在 `geometry.ts`，保持纯函数，便于单元测试。
  - 窗口类负责创建、定位、显示/隐藏和清理，不发起外部 API 请求。
- 托盘、overlay、动作执行器各自独立；新增全局 UI 能力时优先在这些职责类中扩展，而不是继续膨胀 `AppController`。
- 主进程不得把 `ipcRenderer`、`fs`、`process` 或任意命令执行能力暴露给 renderer。

## 5. IPC 约定（已存在）

新增或修改 IPC 时，按下述顺序完成，避免只改一侧：

1. 在 `src/shared/api.ts` 的 `IPC_CHANNELS` 增加通道名，并在对应的 `PetApi` / `MenuApi` / `BubbleApi` / `SettingsApi` 中增加方法类型。
2. 在 `src/preload/api.ts` 增加包装方法；不要在 renderer 直接使用 `ipcRenderer`。
3. 在 `src/main/ipc/schemas.ts` 增加 Zod schema：
   - 对象使用 `.strict()`；
   - 字符串做 `trim`、长度和枚举约束；
   - ID 使用 UUID；
   - URL 只允许 http/https，并拒绝带账号密码的 URL。
4. 在 `src/main/ipc/register-handlers.ts` 使用 `register(channel, schema, handler)` 注册；无输入的 channel 传 `null` schema。
5. 由 `AppController` 提供具体用例方法；handler 只做参数适配和调用。
6. 更新测试、[架构概览](../architecture/overview.md) 和 [手动测试计划](../testing/manual-test-plan.md)。

固定规则：

- 每个 handler 先经过 `assertTrusted`（sender URL 校验），再解析输入。
- 不向 renderer 返回原始异常、HTTP 头、令牌、SDK 对象或堆栈。
- 主进程推送事件只通过已定义的 channel；新增推送事件要同时更新 preload 的 `on` 包装和 renderer 的订阅清理逻辑。

## 6. 存储、配置与密钥（已存在）

- 普通配置使用 `ConfigStore`（`config.json`，当前 `schemaVersion: 5`）：
  - 修改结构时提升 `CURRENT_CONFIG_SCHEMA_VERSION`；
  - 保持 `migrateConfig` / `parseConfig` 的修复能力；
  - 不为旧版本添加临时兼容分支而不提升版本号。
- 文档型数据使用 `JsonStore<T>`（`data/*.json`）：
  - `sanitize` 必须“永不抛错、修复输入”；
  - 写入使用临时文件 + rename；
  - 需要立即持久化时调用 `flush()`。
- 敏感值只能使用 `SecretStore`：
  - 通过 `secret-ids.ts` 中的固定 ID 访问；
  - `safeStorage` 不可用时抛 `SECRET_STORAGE_UNAVAILABLE`，不得回退明文；
  - 不把密钥写入 `config.json`、renderer、日志、测试夹具或 Git。
- 用户导入资源（桌宠 PNG）使用 `storage/pet-assets.ts` 的校验与复制逻辑；不要接受 renderer 传入的任意路径。
- 新增存储位置时，同步更新 [PRIVACY.md](../../PRIVACY.md)、架构概览的数据表和维护清理逻辑。

## 7. 错误处理与日志（已存在）

- 内部错误使用 `AppError(code, message, { retryable, cause })`；`message` 是面向用户的中文说明。
- 外部错误在 service 边界映射为稳定的 `AppError` 分类，不把第三方错误结构泄漏到 UI。
- 可重试错误设置 `retryable: true`（如超时、限流、网络错误、5xx）。
- 日志使用 `LoggerLike` / `Logger`：
  - 记录模块启动/停止、动作开始、失败分类、耗时等可诊断信息；
  - 不记录密钥、token、完整认证 URL 或个人数据；
  - 元数据会脱敏，但不要依赖脱敏作为唯一保护。
- 不要用 `console.log` 记录业务数据；启动失败等无法使用 Logger 的场景除外。

## 8. 调度与异步生命周期（已存在）

- 后台任务统一通过 `ModuleContext.scheduler` 注册到 `TaskScheduler`。
- 每个任务必须有唯一 `id` 和 `owner`；模块 `stop()` 时调用 `scheduler.stopByOwner(id)`。
- 长时间请求使用 `AbortController` 或带超时的包装；超时映射为 `TIMEOUT`。
- 不创建无法取消的永久 `setInterval`；不并发运行同一任务。
- 有意忽略的 Promise 使用 `void` 前缀，表明是 fire-and-forget；否则应 `await` 或显式处理错误。
- 新增计时器、订阅或 loopback server 时，必须在 `stop()` / `dispose()` / `finally` 中清理。
- 系统休眠恢复后由 `handleResume()` 重新计时；不要在恢复时补发所有错过任务。

## 9. Renderer 与样式约定（已存在）

- 视图由 `App.tsx` 根据 `?view=` 选择：`pet`、`menu`、`bubble`、`settings`。
- `pet`、`menu`、`bubble` 静态导入以降低首次显示延迟；`settings` 通过 `React.lazy` 按需加载。
- 每个视图只使用 preload 暴露的对应 API（`window.petApi` 等）；不要假设其他视图的 API 存在。
- 公共组件位于 `src/renderer/src/components/`，通过命名导出使用：
  - `Button` 支持 `primary` / `secondary` / `danger` / `ghost`；
  - `Field`、`Tag`、`EmptyState` 等按现有 props 复用；
  - 新增公共组件前先搜索是否已有等价实现。
- 样式：
  - 颜色、间距、圆角、阴影、字体、动效必须使用 `tokens.css` 中的 CSS 变量；
  - 业务组件不得硬编码新的设计值；
  - 公共组件样式在 `styles/components.css`，视图样式在对应 CSS 文件；
  - 避免依赖样式加载顺序解决优先级问题（参考 2026-10-17 快捷菜单对齐回归）。
- 交互与可访问性：
  - 可交互元素使用语义化 HTML 或明确的按钮/输入控件；
  - 保留键盘焦点可见样式；
  - 尊重 `prefers-reduced-motion`；
  - 状态不要只用颜色表达，配合文字或图标。
- UI 改动完成后必须实际运行界面并检查，而不是只通过类型检查。

## 10. 测试约定（已存在）

- 测试位于 `tests/unit/`，使用 Vitest，Node 环境。
- 显式导入 `describe` / `it` / `expect` / `vi`，不使用全局测试 API。
- 通过依赖注入替换外部依赖（`fetchImpl`、`clientFactory`、`now`、`safeStorage` backend），不访问真实网络或真实凭据。
- 时间相关逻辑使用 fake timers 或注入 `now()`。
- 每个测试文件聚焦一个模块/服务；覆盖成功、空结果、错误分类和边界条件。
- 新增测试后运行 `npm test`；涉及 renderer 类型时同时运行 `npm run typecheck`。

## 11. 新增功能模块的最小清单

1. 在 `src/shared/api.ts` 增加模块 ID、状态、动作和公开类型（如适用）。
2. 在 `src/main/modules/<id>/` 实现 service（外部请求、错误映射）和 module（生命周期、动作、配置判断）。
3. 在 `src/main/modules/registry.ts` 注册；在 `src/main/index.ts` 装配依赖。
4. 在 `AppController` 暴露用例方法；需要 renderer 调用时按 IPC 约定增加通道、schema、handler 和 preload API。
5. 在 `ConfigStore` / `config-schema.ts` 增加配置和默认值；提升 schema 版本并提供迁移/修复。
6. 在设置页增加 tab 或设置项，复用现有组件与 token。
7. 增加单元测试，并更新 [测试策略](../testing/strategy.md)、[手动测试计划](../testing/manual-test-plan.md)、[README.md](../../README.md) 和 [PRIVACY.md](../../PRIVACY.md)（如涉及网络/隐私）。
8. 更新 [架构概览](../architecture/overview.md) 的模块、数据流和网络访问表。

不要在 `Main` 中动态加载模块代码；当前设计是静态注册表。

## 12. 文件拆分判断

不以最大行数作为唯一质量标准。判断是否拆分时看：

- 是否承担了多个可独立描述的职责；
- 是否与具体窗口/模块产生不必要的耦合；
- 是否能通过纯函数或依赖注入更容易测试；
- 修改某一职责时是否频繁影响其他职责；
- 拆分后是否减少实际变更风险，而不是只增加文件数量。

当前已经按职责拆分的例子：`AppController` 协调器、`ModuleActionRunner`、`OverlayWindowManager`、`PetWindowController`、设置页 tab/hook。新代码优先沿用这些边界。

## 13. 建议的未来改进（不是当前现状）

以下事项尚未实现，不要写成已完成；如需实施，先登记/更新 [OPEN_ITEMS.md](../OPEN_ITEMS.md)：

- 增加 IPC handler 与窗口生命周期的集成测试；当前以单元测试为主。
- 对托盘单击/双击、系统通知点击、原生文件对话框等进行自动化或可重复的手动验收。
- 增加可访问性专项检查（键盘全流程、对比度、读屏标签）。
- 如 IPC 通道继续增长，再评估拆分 `docs/architecture/ipc-contracts.md`，现阶段无需为文档数量而拆。
