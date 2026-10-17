# FlowerBuddy 架构与性能优化审计报告

> 报告版本：1.0
> 审计日期：2026-10-17
> 审计对象：`ZaiHuaOvO/FlowerBuddy` 当前公开仓库与本次上传的 `FlowerBuddy-main.zip` 源码快照
> 当前目标：先完成架构与性能层面的优化，再进入全面的功能与视觉回归测试。
> 重要声明：本报告是基于源码、项目配置、测试文件和官方技术文档完成的静态审计；不会把未经运行测量的性能猜测写成已证实的瓶颈。
>
> **归档状态（2026-10-17）**：审计已完成，建议已落实到阶段 A–F；本文仅作为历史审计记录保留，不是当前实现清单或待办列表。当前架构见 [`docs/architecture/overview.md`](../architecture/overview.md)，未完成项见 [`docs/OPEN_ITEMS.md`](../OPEN_ITEMS.md)。

---

## 1. 结论先行

**不建议推倒重写，也不建议为了“架构优化”一次性重构整个项目。** FlowerBuddy 已经有一套相对清晰的底层结构：Electron 主进程、preload 桥接、React 渲染界面、独立业务模块、统一调度器、配置迁移与密钥存储、输入校验和一批单元测试。这些基础值得保留。

当前最值得优先处理的并不是把每个文件都拆得更碎，而是以下四件事：

1. **先建立可比较的性能基线。** 当前 ZIP 没有包含 `out/` 或 `release/` 构建产物；本次审计环境尝试安装依赖时，访问 npm 镜像遇到 DNS `EAI_AGAIN`，因此不能诚实地给出当前启动耗时、真实 bundle 大小、安装包大小或测试通过结果。项目 README/OPEN_ITEMS 中的既有验证记录是项目自身报告，本次没有在当前环境独立重跑。
2. **优先给四种窗口做真正的 renderer 代码分割，并按窗口拆分样式加载。** 目前 `App.tsx` 静态导入了宠物、菜单、气泡、设置四种视图；`main.tsx` 一次性导入了全部 CSS。即使窗口的查询参数只选择一个视图，该 renderer 入口仍会把所有视图代码及样式纳入加载路径。
3. **延迟加载可选服务的重型 SDK。** 主进程在启动入口静态导入 Gmail/ESA 模块，其中 `gmail-service.ts` / `gmail-auth.ts` 顶层导入 `googleapis`，`esa-service.ts` 顶层导入阿里云 ESA SDK。关闭功能开关可以阻止模块调度，但并不会自动阻止这些 JavaScript 包在应用启动时被加载。
4. **拆分两个责任过于集中的文件。** `SettingsApp.tsx` 约 1,735 行，混合了各设置页的状态、请求、表单事件与完整 JSX；`app-controller.ts` 约 956 行，集中处理窗口生命周期、模块动作、气泡、托盘、配置更新和桌宠拖动等行为。拆分应以职责为依据、逐步进行，重构期间保持界面与业务行为不变。

这些改动解决的是不同问题，不能混为一谈：视图代码分割和延迟 SDK 加载可能改善启动、内存或包体；拆分大型文件主要改善可读性、复用性、可测试性和后续改动成本。**代码变整齐不一定更快，包更小也不一定让运行中的 CPU 更低；这两类收益都要分开测量。**

## 2. 项目现状：哪些基础应该保留

### 2.1 当前结构与 Angular 概念对照

| FlowerBuddy 当前部分 | 主要职责 | 用 Angular 思路理解 |
|---|---|---|
| `src/main/` | Electron 生命周期、窗口、IPC、系统能力、数据和外部 API | 更像运行在桌面应用里的应用宿主与一组全局服务，不是普通 Angular 页面模块 |
| `src/preload/` | 使用 `contextBridge` 向 renderer 暴露有限 API | 类似一个权限很窄的 Facade / Adapter；不应把所有底层能力直接暴露给组件 |
| `src/renderer/` | React 页面、桌宠交互、设置 UI 与 CSS | 类似 Angular 的组件层与页面层 |
| `src/shared/api.ts` | 窗口类型、IPC channel、共享数据契约 | 类似跨层共享的接口与类型定义 |
| `src/main/modules/` | 日期、网站检测、Gmail、ESA、DeepSeek 业务实现与模块生命周期 | 类似按业务领域组织的服务/功能模块 |
| `src/main/scheduler/` | 定时执行、取消、退避与休眠恢复 | 类似统一后台任务服务，而不是让每个页面各自创建定时器 |
| `src/main/storage/` 与 `security/` | 配置、迁移、文件数据和密钥保护 | 类似共享数据层与安全基础设施 |

Electron 与 Angular 并不是同一种运行模型。Angular 的懒加载通常围绕路由、`loadComponent` 或 `loadChildren`；当前项目用 `?view=pet/menu/bubble/settings` 选择 Electron 窗口内容，所以更接近“按入口视图动态加载组件”。不能把 Angular 的 NgModule 机械照搬到 React/Electron。

### 2.2 当前已经具备的良好做法

- **进程边界清楚。** `main`、`preload`、`renderer` 分开，渲染进程没有直接获得 Node.js API。
- **Electron 窗口安全基线集中管理。** `src/main/security/web-preferences.ts` 统一设置 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true` 等选项。
- **IPC 输入有校验。** `src/main/ipc/register-handlers.ts` 检查发送方，并使用 `src/main/ipc/schemas.ts` 中的 Zod schema 校验输入；错误通过统一格式返回。
- **preload API 按窗口分域。** `src/preload/api.ts` 根据 `pet/menu/bubble/settings` 暴露不同接口，比向所有 renderer 暴露完整 `ipcRenderer` 安全得多。
- **业务模块有注册表和生命周期。** `ModuleManager`、`registry.ts` 与 `TaskScheduler` 已将功能开关、配置状态、开始/停止和定时任务集中管理。不要为了性能改成从任意目录动态执行未知插件代码。
- **定时器具有取消与退避机制。** `TaskScheduler` 使用单次 `setTimeout` 链、防止同一任务重叠、允许 `AbortSignal` 取消，并在失败后进行退避。
- **持久化考虑了损坏与升级。** 配置带 schema 版本，存在迁移与备份；JSON 数据以临时文件写入后 rename；密钥单独保存并使用 Electron `safeStorage`，无法加密时不回退为明文。
- **TypeScript 检查较严格。** `tsconfig.json` 开启 `strict`、`noUncheckedIndexedAccess`、`noUnusedLocals`、`exactOptionalPropertyTypes` 等检查。
- **已有较多单元测试。** 上传的源码包含 24 个 `tests/unit/*.test.ts` 文件，覆盖存储、模块、IPC、调度器和若干数据服务。
- **构建链路已经比较完整。** `electron-vite` 负责 main/preload/renderer 构建，`electron-builder` 配置了 Windows NSIS 安装版、portable 便携版、asar 与 ZIP 脚本。没有理由仅为“更专业”而换掉当前构建工具。

以上是代码结构与文件存在性检查得出的判断，并不等于本次已经执行了所有测试或证明生产版没有缺陷。

## 3. 优化项优先级总表

优先级解释：

- **P0：先做基线与安全边界确认。** 不先收集基线，无法知道改动是否真正带来性能提升。
- **P1：建议优先完成。** 当前源码中有直接证据，且对启动加载或长期维护有现实影响。
- **P2：在 P1 稳定后处理。** 可能有收益，但应通过数据决定实施程度。
- **P3：有明确需求再做。** 不应该为了“看起来高级”提前引入。

| 优先级 | 事项 | 主要收益 | 是否直接提升运行速度 |
|---|---|---|---|
| P0 | 建立启动、idle CPU/内存、bundle、打包耗时与产物体积基线 | 让后续优化有证据 | 本身不提升，但决定优化方向 |
| P1 | `App.tsx` 视图懒加载，CSS 按视图拆分 | 减少不需要的 renderer 代码加载 | **有机会改善**首屏解析、初始化与内存 |
| P1 | Gmail 与 ESA 的 SDK 延迟导入 | 未使用可选模块时避免加载相关 SDK | **有机会改善**冷启动与基础内存 |
| P1 | 拆分 `SettingsApp.tsx` 与 `app-controller.ts` | 降低耦合，提升测试与改动可控性 | 主要改善维护性，不保证更快 |
| P1 | 增加 CI 质量门禁与最小 renderer/打包 smoke test | 防止优化引入构建和加载回归 | 不直接提升运行速度 |
| P2 | 评估 Gmail SDK 是否可从聚合包换成 Gmail 专用包 | 有机会减少分发文件/包体 | 主要影响安装包/启动依赖加载；需实测 |
| P2 | 按需加载设置页数据 | 减少设置初次打开的 IPC 和无用请求 | 可能改善设置页就绪时间，幅度预计有限 |
| P2 | 降低主进程大文件同步读取/每次日志同步写入的阻塞机会 | 提升极端场景的响应性 | 需性能测量确认 |
| P2 | 按领域整理共享契约和格式化工具 | 降低跨层维护成本 | 通常不是直接性能优化 |
| P3 | 换状态管理库、引入通用插件框架、全面异步化、改换 Electron 工具链 | 增加复杂度 | 当前没有证据证明有必要 |

---

## 4. P0：先建立性能基线，不要盲目优化

Electron 的官方性能指南把“测量”作为首要原则，并建议关注主进程阻塞、renderer 阻塞、不必要的模块导入、过早加载和不必要的网络请求。参考：[Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)。

### 4.1 为什么必须先测？

把代码拆成 20 个文件，并不会自动让程序运行得更快；给 Vite 加更多插件，也不一定会让构建更快。只有先测出启动慢在哪里、哪个进程占用高、哪个文件真正被打包，才知道应该优化什么。

可以把它类比成 Angular 项目：在没有看 bundle analyzer、网络 waterfall 和 Angular profiler 前，不能因为某个页面 TS 文件很长，就断定它是 LCP 慢的根因。

### 4.2 基线采集项目

请在**自己的 Windows 开发环境**中执行。当前审计容器无法通过 `registry.npmmirror.com` 完成 `npm ci`（DNS `EAI_AGAIN`），所以此处给出可复现流程，不谎称命令已经通过。

先固定代码状态：

```powershell
git status --short
git rev-parse HEAD
node --version
npm --version
```

然后分别记录每个命令的耗时和退出码：

```powershell
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run dist:win
```

请不要将所有命令混成一条长命令；否则某一步失败后不容易看清哪个检查真正通过。若 `format:check` 在当前分支已经失败，先记录已有失败，不要把它和后续架构修改造成的新失败混为一谈。

记录至少以下数据：

| 指标 | 怎么测 | 备注 |
|---|---|---|
| 从进程启动到桌宠可见 | 在 main bootstrap、宠物窗口 `ready-to-show` 和 renderer 首次 mount 处添加仅开发模式启用的时间戳，或用外部录屏/秒表辅助 | 记录冷启动和再次启动，分别跑 3 次取中位数 |
| renderer JS/CSS 大小 | 检查 `out/renderer/` 内生成的 JS/CSS 文件，记录文件名与字节数 | 当前 ZIP 没有 `out/`，必须实际构建后才能得出 |
| main/preload 输出大小 | 检查 `out/main/` 和 `out/preload/` | 与 renderer 统计分开 |
| 安装版、便携版、ZIP 大小 | 对 `release/` 里的成品记录字节数 | 这是分发体积，不等同于 JS bundle 体积 |
| 完整 Windows 打包耗时 | 单独计时 `npm run dist:win` | 冷构建与重复构建分开记录 |
| 空闲 CPU 与内存 | 启动应用、等待模块安静下来后，在任务管理器或 `app.getAppMetrics()` 中观察所有应用进程 | 至少记录桌宠刚启动、打开过设置/菜单后、空闲 5 分钟后的状态 |
| 功能启用前后差异 | 所有可选服务关闭作为基线，再单独启用 Gmail/ESA 等 | 外部轮询和网络波动要与本地 CPU 开销分开判断 |

建议保存一份 `docs/performance-baseline.md`，包含日期、机器配置、Node/npm/Electron 版本、每条命令的耗时、包体积和内存数据。优化后沿用同一张表比较。

### 4.3 不要预先设置虚假的“极致”目标

在没有基线之前，不要承诺“启动必须小于 300ms”或“安装包必须压缩到 20MB”。Electron 自身包含 Chromium 与 Node.js 运行时，安装包不可能简单地和纯网页 bundle 相提并论。先得到实际基线，再根据使用体验定改善目标。

---

## 5. P1：为不同 renderer 视图做代码分割

### 5.1 源码证据

`src/renderer/src/App.tsx` 开头直接静态导入了四个视图：

- `./bubbles/BubbleView`
- `./pet/PetView`
- `./quick-menu/QuickMenu`
- `./settings/SettingsApp`

然后只根据 `window.location.search` 选择真正渲染哪个组件。换句话说，`?view=pet` 只决定显示哪个组件，并没有形成按窗口视图的动态导入边界。

`src/renderer/src/main.tsx` 又在入口一次性导入 `tokens.css`、`base.css`、`components.css`、`pet.css`、`menu.css`、`bubble.css` 和 `settings.css`。因此宠物、菜单、气泡窗口也会加载设置页样式。

### 5.2 这和 Angular 懒加载有什么关系？

可以类比为 Angular 应用在根组件里静态导入所有页面，再用条件显示某个页面。页面没有显示，不代表其代码自动从首屏 bundle 中消失。

React 里对应的方向是 `React.lazy(() => import(...))` 和 `Suspense`。React 官方文档：[lazy](https://react.dev/reference/react/lazy)。Vite 会围绕动态 `import()` 创建异步 chunk，参考：[Vite Features](https://vite.dev/guide/features.html)。

### 5.3 建议修改方式

1. 将 `App.tsx` 中四个视图切换成懒加载导入，并用轻量 `Suspense` fallback 包裹。
2. 将每个视图专属 CSS 从 `main.tsx` 移到相应视图组件或其样式入口。建议全局仅保留确实跨视图共用的 `tokens.css`、基本 reset 与少量公共组件样式。
3. 不要为了代码分割而把共享的 CSS 复制成四份。共享 token 仍保留一份，窗口独有的样式再按需加载。
4. 先沿用现有 `?view=` 路由方式，不必为了懒加载引入 React Router。
5. 每一次改动都生成生产构建，分别验证 `pet/menu/bubble/settings` 四种窗口。不能只验证 Vite dev server；动态 chunk 在 `file://` 加载的生产环境路径必须真正测试。
6. 确认 CSP 没有被为了动态 chunk 而放宽，也没有使用远程 CDN 加载 JS/CSS。

### 5.4 验收标准

- 生产构建后，`App.tsx` 入口只需先载入公共代码与当前视图所需 chunk。
- 仅启动宠物窗口时，不应因静态导入而立即请求/执行设置页组件代码。
- 每个窗口在安装版与便携版中均可显示，无 chunk 路径 404、白屏或 `file://` 加载错误。
- 记录改造前后的 `out/renderer/` 文件列表、大小和启动时间。不要只凭“生成了多个 chunk”就认定优化成功。

**预期收益：** 把当前视图没有用到的 React/JSX/CSS 延后加载，可以减少每个 renderer 的无效工作，尤其是占比最大的设置页面。但具体幅度要以构建结果与启动测量为准。

---

## 6. P1：把 Gmail 与 ESA 的 SDK 延迟到实际需要时再加载

### 6.1 源码证据

- `src/main/index.ts` 在模块顶层静态导入 `GmailService`、`EsaModule` 等。
- `src/main/modules/gmail/gmail-service.ts` 顶层导入 `google-auth-library` 与 `googleapis`。
- `src/main/modules/gmail/gmail-auth.ts` 顶层导入 OAuth 客户端及 `googleapis`。
- `src/main/modules/esa/esa-service.ts` 顶层导入 `@alicloud/esa20240910`、`@alicloud/openapi-core` 和 Darabonba runtime。
- `ModuleManager` 的启用/配置检查能决定是否启动模块调度，但不能撤销这些静态 import 在主进程初始化时已经发生的加载。

### 6.2 为什么对桌面常驻程序有意义？

网站服务可能长期运行在服务器上，启动时载入所有依赖有时可接受；桌宠则可能每天开机常驻，只使用日期与网站检测，却依然为从未启用的 Gmail / ESA 加载外部 SDK。Electron 官方性能指南特别提醒不要随意载入大模块，也不要过早执行不必要的代码。

### 6.3 建议的改法

- 把 Gmail 的实际 OAuth/API SDK 使用放在异步函数边界内动态导入。可以保留轻量的 `GmailService` 类和类型定义，但不要在文件模块初始化阶段就加载完整 Google API 客户端。
- 把 ESA SDK 的运行时导入放进 `fetchEsaTraffic` 等真实请求路径。类型定义尽可能用 `import type`，确保不被编译成运行时依赖。
- 对动态导入结果采用单例 Promise 缓存，避免每次轮询重复创建/加载 SDK；错误要由现有统一错误机制处理。
- 保留测试所使用的 client factory/依赖注入模式。不要让动态导入变成无法 mock 的全局硬依赖。
- 明确：Gmail 在启用且已配置时需要开始同步，它可以在第一次真实同步时加载 SDK；ESA 可以到用户首次查询或开启自动刷新时加载。停用并未配置的服务不应触发相关 SDK 初始化。

### 6.4 延迟加载和减小安装包不是同一件事

动态 `import()` 可以减少启动时加载和执行的依赖，但如果 `electron-builder` 仍按生产依赖把整个 npm 包放进应用，安装包体积不一定会减少。

针对 `googleapis`，可评估将聚合 Google API 客户端改为 Google 团队发布的 Gmail 专用包 [`@googleapis/gmail`](https://www.npmjs.com/package/@googleapis/gmail)。它仅面向 Gmail API，当前 npm 页面标注 Apache-2.0 许可。但这不是未经测试即可直接替换的承诺：必须验证 API 调用方式、类型、授权客户端兼容性、许可证清单与真实安装产物大小。

建议把这个候选优化做成单独提交：

1. 先记录现有 `googleapis` 在 `node_modules`、`app.asar`、便携版与 ZIP 中占用的体积。
2. 建一个小分支验证 Gmail 专用包能否完全覆盖当前使用的 `google.gmail(...)` 等调用。
3. 重跑 Gmail 相关单元测试和 OAuth smoke test。
4. 对比压缩后的安装包/ZIP 与主进程首次启动耗时；若差异不明显或兼容性风险大，就不换。

**预期收益：** 未启用的服务减少不必要的启动加载；如果再将聚合客户端换为专用客户端，可能进一步减少应用分发体积。两个结果都应独立测量。

---

## 7. P1：拆分 `SettingsApp.tsx`，但不要把它切成一堆无意义小文件

### 7.1 当前问题

`src/renderer/src/settings/SettingsApp.tsx` 约 1,735 行、约 59 KB。一个组件中同时包含：

- 多个页面共用的初始配置、模块状态、错误/成功提示与选项卡状态；
- 日期和网站表单的数据结构、编辑/删除状态；
- Gmail、ESA、DeepSeek 的密钥输入、连接/查询状态；
- 多个 API 调用及异步错误处理；
- 格式化/状态文案 helper；
- 常规、功能、日期、网站、Gmail、DeepSeek、ESA、外观等整个设置界面的 JSX。

这会造成：修改一个页面时需要在巨大文件中定位；本来只属于某个 tab 的状态与函数也常驻组件；异步错误和 loading 状态不易隔离；测试时难以只测一个功能页。

### 7.2 建议目标结构

以下是建议方向，不要求一次性严格照搬目录名：

```text
src/renderer/src/settings/
  SettingsApp.tsx              # 设置窗口整体布局、当前 tab、全局提示
  tabs/
    GeneralSettingsTab.tsx
    ModulesSettingsTab.tsx
    DatesSettingsTab.tsx
    WebsitesSettingsTab.tsx
    GmailSettingsTab.tsx
    DeepSeekSettingsTab.tsx
    EsaSettingsTab.tsx
    AppearanceSettingsTab.tsx
  hooks/
    useSettingsBootstrap.ts     # 少量全局初始数据与状态
    useDatesSettings.ts         # 如果日期页状态足够复杂
    useWebsiteSettings.ts       # 如果网站页状态足够复杂
    useGmailSettings.ts
    useDeepSeekSettings.ts
    useEsaSettings.ts
  utils/
    formatters.ts               # 时间、字节数、余额、状态文案等纯函数
```

不要为了凑目录强制每个 tab 都同时拆成组件、hook、service 三层。一个表单足够简单时，一个 `XxxSettingsTab.tsx` 完全可以包含本页状态与事件处理。

### 7.3 状态如何划分

- **设置窗口共享状态：** `config`、模块摘要、安全状态、全局错误/成功 banner、活动 tab 等。
- **页面私有状态：** 日期草稿与编辑 ID 放在日期页；网站检测中的 ID 放在网站页；API Key 草稿、查询 loading 和余额结果放在相应 API 页。
- **跨页共享的数据/API：** 先通过 props 或一个小型 `SettingsContext` 传递。只有确实出现多处跨页共享、导致 props 复杂时才引入 context。
- **不要现在加 Redux/Zustand。** 目前是一个桌宠和一个设置窗口，项目没有显示出需要全局状态管理框架的证据。先把状态归属拆清楚。
- **纯函数单独放置。** 日期标签、流量大小、余额金额格式化等与 React 无关的逻辑，适合提取为可独立单测的函数。

### 7.4 初次加载也可以顺手理清，但别过度优化

当前设置窗口 mount 时会并行调用多个 IPC 方法，包括配置、应用信息、模块、安全状态、启动提示、Gmail 状态、日期列表和网站列表。这些本地调用大多不重，但拆页后可以考虑：

1. 先载入设置骨架、配置、模块摘要和安全状态。
2. 当前打开日期页时再读取日期列表；打开网站页时读取网站列表；Gmail 页再读取 Gmail 连接状态。
3. 若测量后发现 IPC 数量或初始状态复杂度值得简化，再提供一个明确的“设置窗口初始快照”接口，统一返回确实需要一起初始化的轻量数据。

不要为了减少几个 IPC 调用而建立复杂缓存框架。IPC 本身是进程间边界，最先要保证的是职责、数据和错误处理清楚。

### 7.5 重构验收

- 页面文字、交互、样式和 API 行为与重构前一致。
- 每个 tab 的状态不再堆在同一个巨型组件里。
- 通用表单组件继续复用已有 `Button`、`EmptyState`、`Field`、`Tag`，不要每个 tab 再造一套。
- 各格式化函数可独立测试；主要 tab 至少有 render/交互 smoke test。
- 每次只迁移一个 tab，先 typecheck、lint、相关测试，再迁移下一页。

**收益：** 主要是可维护性和故障隔离。代码拆分本身不会自动减小 renderer bundle；只有配合动态导入，才可能把某些设置页代码拆成按需下载的 chunk。

---

## 8. P1：拆分 `app-controller.ts`，把它从“什么都管”变成协调器

### 8.1 当前问题

`src/main/app-controller.ts` 约 956 行。它目前同时处理应用信息/配置、业务服务调用、日期与网站 CRUD、密钥更新、Gmail 通知、桌宠图片导入、拖动与缩放、窗口创建与定位、菜单动作、请求超时、气泡状态、开机启动、显示器变化和退出清理。

大控制器在最初阶段很常见，也并非一定错误；但当每个新功能都继续加进来，它会逐渐变成修改风险集中的地方。一个功能引入回归时，也难判断责任属于窗口、模块、持久化还是呈现逻辑。

### 8.2 推荐目标：保留协调器，不要完全重写

可以逐步形成以下分工：

```text
src/main/
  app-controller.ts                 # 生命周期入口与少量跨层协调
  windows/
    pet-window-controller.ts        # 桌宠窗口、尺寸、位置、拖动、显示状态
    overlay-window-manager.ts       # 菜单/气泡窗口创建、摆放、显示和清理
  actions/
    module-action-runner.ts         # 执行动作、requestId、超时、结果/错误气泡状态
  services/
    app-settings-service.ts         # 配置更改后需要同步的系统动作
  modules/                          # 现有业务模块与 module manager 保留
```

以上名字只是建议，关键是每个对象有清楚所有权：

- 谁创建并销毁 `BrowserWindow`？
- 谁拥有气泡的 `requestId` 与超时计时器？
- 谁更新配置并执行开机启动等副作用？
- 谁只负责把模块结果变成界面反馈？

不要让同一个窗口对象同时被多个 manager 各自维护一份状态，也不要把每一个 20 行方法都抽成一个 class。

### 8.3 推荐迁移顺序

1. 先将 `runModuleAction`、气泡 timeout/隐藏相关状态和方法抽成 `ModuleActionRunner` 或类似对象；用 fake window / presenter 测试 loading、success、error、超时与取消。
2. 再将菜单与气泡窗口的创建、定位和销毁整理到一个 overlay 管理类。
3. 再整理桌宠的位置、缩放、拖动和图片状态。
4. 最后让 `AppController` 保留启动顺序、少量对外门面方法和跨模块协调。

每一步都保持 IPC 的输入/输出不变，避免主进程架构重构与 UI 重构混成一个大 PR。

**收益：** 更容易验证生命周期和定时器清理，不同系统事件造成的回归更容易定位；未来添加窗口、快捷键或新模块时，不必继续把所有代码塞进一个巨型控制器。运行性能提升不是此项的主要目标。

---

## 9. P2：包体、启动加载与构建速度要分开优化

### 9.1 Renderer bundle 与 Electron 安装包是不同的东西

| 对象 | 包含什么 | 应用什么方式优化 |
|---|---|---|
| renderer JS/CSS | React UI、样式及 renderer 依赖 | 动态导入、去掉未用代码、样式按视图拆分 |
| main/preload JS | 窗口管理、IPC、安全与业务协调代码 | 减少昂贵的启动期 import；检查外部依赖加载；保持 bundle 边界 |
| `app.asar` / 已解包资源 | 编译输出及生产依赖、应用资源 | 检查实际依赖占用、替换不必要的大包、避免打入测试/开发资源 |
| NSIS 安装包 / portable / ZIP | Electron 运行时、应用文件与发布附加内容的最终打包结果 | 检查生产依赖、压缩和发布文件列表；先确认体积热点 |
| 构建耗时 | typecheck、Vite 编译、生成许可证、electron-builder、ZIP 等阶段 | 分阶段计时；只优化真正占时的步骤 |

`electron-vite` 将 main、preload、renderer 分开构建，输出默认位于 `out/`，官方构建说明见 [electron-vite Build](https://electron-vite.org/guide/build)。当前 `electron.vite.config.ts` 已为 renderer 配置 `minify: 'esbuild'`。不建议为了追求极致而先加混淆、多个压缩插件或更换 bundler。

### 9.2 当前打包配置值得保留的部分

- `electron-builder.yml` 已配置 `asar: true`。
- 已排除 `*.map`，不会把 source map 默认作为发布文件。
- `dist:win` 使用同一套构建脚本输出 NSIS 和 portable，再生成 ZIP。
- 已通过 `electronDist` 指向本地 Electron distribution，意图避免打包时重复下载 Electron 运行时。
- 只配置 Windows x64 发布目标，与当前目标用户环境一致。

因此，当前没有证据证明“打包策略完全有问题”。需要先记录实际 `npm run dist:win` 耗时，再决定是否要调整任务并发、依赖体积或许可证脚本。

### 9.3 生产依赖应以功能必要性为导向

当前 `package.json` 的顶层生产依赖是 6 个：阿里云 ESA SDK、`google-auth-library`、`googleapis`、React、React DOM、Zod。锁文件包含 599 个 package entry，但这包括开发依赖与传递依赖，**不能理解成应用实际打包 599 个直接生产依赖**。

处理依赖时按以下顺序：

1. 测量应用实际打包后的生产依赖文件大小。
2. 优先检查“一个功能只用到一个 API，却安装了整个服务集合”的包（当前 `googleapis` 是最值得评估的候选）。
3. 检查依赖的生产/开发分类、实际 import 使用和许可证。
4. 更换依赖后重新跑相关测试、许可证清单和真实 Windows 打包。

不要只根据 npm 包在磁盘上的大小，就估算它会给压缩后的安装包增加同样大小；也不要认为动态 import 一定会让安装包变小。

---

## 10. P2：主进程同步 I/O、日志与图片处理

### 10.1 目前有哪些同步文件操作？

代码中可以看到 `readFileSync`、`writeFileSync`、`appendFileSync` 和同步目录/文件检查，主要位于：

- `src/main/storage/config-store.ts`
- `src/main/storage/json-store.ts`
- `src/main/security/secret-store.ts`
- `src/main/shared/logger.ts`
- `src/main/storage/pet-assets.ts`
- `src/main/app-controller.ts`

Electron 官方性能文档建议避免在 main process 中执行会长时间阻塞 UI 线程的同步 I/O。不过这不代表项目里每一个 sync 调用都必须立刻改成 async。

### 10.2 应如何处理

- **小型配置 JSON：** 当前数据量预计较小，且有延迟合并写入；先保留其简单可靠的实现。只有在测量到写入明显阻塞、文件规模增长或高频保存时，再考虑异步队列。
- **自定义桌宠图片：** 图片允许最大 15 MB。当前导入过程同步读取并写入，启动阶段也会同步读取当前图片来解析 PNG 尺寸。对于接近上限的大图，理论上可能暂时阻塞主进程。可以把导入和校验转为异步 I/O，并在导入时保存已验证的宽高元数据，减少每次启动重新读完整图片的需要。
- **日志：** `Logger.write()` 使用 `appendFileSync()`，之后还做文件大小检查。正常轮询频率下可能影响不大，但在多个错误集中发生时，每条日志都会阻塞调用它的事件循环。若基线显示日志开销值得处理，再使用带队列的异步写入/stream，并明确退出前 flush 的策略。
- **不要做全面“同步转异步”大改。** 同步小 JSON 的修改很容易扩大代码复杂度，却没有可测收益。每类 I/O 单独改、单独验证。

---

## 11. P1/P2：测试质量、CI 与开源工程维护

### 11.1 现有测试的覆盖重心

目前有 24 个单元测试文件，覆盖不少纯逻辑、服务、IPC、存储、调度器和模块生命周期。这一层值得保留，也适合支持本次重构。

但从源码布局看，测试几乎都位于 `tests/unit/`；当前没有明显的 React 组件测试目录或端到端测试。设置页拆分与 renderer 懒加载恰好是容易出现“TypeScript 通过但打包打开白屏”的改动，因此需要一点 renderer/打包验证保护，不必一开始追求庞大的自动化系统。

### 11.2 建议新增的最小保护

- `App` 的四种 `?view=` 分支测试或 renderer smoke test。
- SettingsApp 外壳能读取配置、切 tab、显示错误/加载状态的基础组件测试。
- 生产 build 后每个窗口入口都能加载，控制台没有 chunk 加载错误。
- Windows CI 执行 typecheck、lint、format check、unit tests、build；发布标签或手动触发时生成 installer/portable artifacts。
- 在 GitHub Actions 中避免注入真实 Gmail、DeepSeek 和阿里云密钥；需要真实 API 测试时单独人工执行。

**源码快照中没有找到 `.github/workflows/` 文件。** 建议增加 CI，以后每次架构优化提交后自动执行检查。仓库页面可访问并不代表当前已启用 CI。

### 11.3 许可证也属于工程质量的一部分

`package.json` 当前使用 `"private": true` 与 `"license": "UNLICENSED"`，README 也注明项目自有代码尚未声明开源许可证。如果你最终希望其他人自由下载并复用代码，需要先决定项目许可证并添加 `LICENSE` 文件；只公开 GitHub 仓库并不会自动授予他人复用权利。这个问题不影响本轮性能指标，但应该在公开分发前处理。

---

## 12. 共享契约与公共组件：整理方向，不要过度设计

### 12.1 `src/shared/api.ts`

该文件目前集中保存窗口类型、IPC channel、业务数据类型和四种 renderer API 接口。它的优点是跨层契约集中，main/preload/renderer 可以共享类型；缺点是随着模块增多，接近 400 行后所有领域类型会持续聚集。

建议未来按领域拆成 `shared/ipc-channels.ts`、`shared/contracts/dates.ts`、`shared/contracts/websites.ts`、`shared/contracts/gmail.ts`、`shared/contracts/esa.ts` 等，再从一个轻量 barrel 重新导出。不要现在为了拆文件导致 50 个跨层 import 大幅修改。应先完成 renderer 和 controller 的主要分层，再单独处理。

### 12.2 公共 UI 组件

目前已有 `Button`、`EmptyState`、`Field`、`Tag`，并使用统一的 `tokens.css`。这足以作为一个小型桌面应用的公共组件起点。

建议公共组件遵循这些边界：

- 组件负责稳定的视觉和交互约定；
- 具体日期/网站/Gmail 业务逻辑留在对应 tab；
- 只把至少两个地方真正重复、且语义稳定的 UI 抽成公共组件；
- 不要建立过于抽象的“万能表单控件”来覆盖所有特殊情况；
- 把视觉大改留到本次架构重构之后的专门测试/样式阶段，不要让架构重构和视觉重设计同时发生。

### 12.3 模块接口

现有 `ModuleDefinition`、`ModuleManager` 和 `TaskScheduler` 是很好的模块边界。新增功能继续实现 `isConfigured/start/stop/runAction` 等已有契约，不要由 renderer 页面自己创建后台轮询，也不要把外部 API 直接从 renderer 发出。

第一版不需要通用的动态插件加载框架：这会引入插件签名、版本兼容、权限沙箱、依赖隔离等更复杂问题，而当前静态 registry 足以满足“用户选择启用哪些内置功能”的需求。

---

## 13. 建议实施顺序

尽量一项一个分支或一个可独立审阅的 PR；遵循项目里的 `GIT_WORKFLOW.md`，每项完成后检查、测试、提交和推送。架构优化期间不要同时做功能增强和视觉改版。

### 阶段 A：性能与构建基线（不改业务代码）

- [ ] 在 Windows 上重新安装锁定依赖。
- [ ] 记录 typecheck、lint、format、unit test、build、dist:win 的耗时与结果。
- [ ] 记录 renderer/main/preload 产物文件清单、安装版/便携版/ZIP 体积。
- [ ] 记录桌宠冷启动、warm start、所有模块关闭时的内存/CPU，以及打开设置/菜单/气泡后的变化。
- [ ] 将真实数字保存为 `docs/performance-baseline.md`。

### 阶段 B：视图懒加载与 CSS 按需加载

- [ ] 用 `React.lazy` 和 `Suspense` 拆分四种视图的运行时加载。
- [ ] 把视图专属 CSS 移入各自的视图入口。
- [ ] 保留公共 token 与必要的全局基础样式。
- [ ] 验证四种窗口的生产 `file://` 加载路径。
- [ ] 对比基线，写明各视图 JS/CSS 体积与启动变化。

### 阶段 C：外部 SDK 延迟加载与依赖体积评估

- [ ] 将 Gmail OAuth/API SDK 的运行时导入移入异步调用路径。
- [ ] 将 ESA SDK 的运行时导入移入实际查询路径。
- [ ] 保留注入式 client factory 和现有单元测试能力。
- [ ] 单独评估 `@googleapis/gmail`，不直接盲替换。
- [ ] 对比应用启动时间、安装包体积与 Gmail/ESA 测试结果。

### 阶段 D：设置页拆分

- [ ] 从纯格式化函数开始提取。
- [ ] 一次只迁移一个 tab。
- [ ] 区分设置页共享状态与 tab 私有状态。
- [ ] 保持原有 UI 与业务结果不变。
- [ ] 增加少量组件测试或 smoke test，确认所有 tab 能加载。

### 阶段 E：主进程控制器拆分

- [ ] 先拆出模块动作执行与气泡状态协调。
- [ ] 再整理 overlay 窗口管理。
- [ ] 再整理桌宠窗口与位置/拖动管理。
- [ ] 让 AppController 继续担任薄协调层，不一次性重写全部启动流程。
- [ ] 每步执行现有模块、调度器、几何计算与 IPC 相关单元测试。

### 阶段 F：按测量结果处理 I/O、CI 和最终回归

- [ ] 只有基线显示值得优化时，才将图片读写/日志写入改成异步策略。
- [ ] 增加 GitHub Actions 检查和 Windows 打包工件流程。
- [ ] 重新执行全量质量命令和打包命令。
- [ ] 比较优化前后指标，未提升的改动要如实记录，必要时撤回。
- [ ] 完成这些架构工作后，再进入你计划中的完整功能与样式测试。

---

## 14. 每次交给 AI Agent 的操作约束

将下面提示词发给 AI Agent，可作为本次架构优化的总约束；每次实际执行时再明确指定阶段。

```text
请阅读项目根目录的技术开发文档、DESIGN_SYSTEM.md、GIT_WORKFLOW.md 和 FlowerBuddy_架构与性能优化审计报告.md。

这轮任务的目标是先优化架构和性能，再做完整的功能和视觉回归。请严格按审计报告的阶段顺序执行，每次只处理一个阶段或一个可独立验收的子项，不要一次性重写整个工程。

执行要求：
1. 开始前检查当前分支、工作区和最近提交，先说明本次会改哪些文件、预期收益与风险。
2. 不要把静态代码推测描述为已测得的性能瓶颈；先建立基线，并在每个优化后用同样环境重新测量。
3. 除非当前任务明确要求，不改变现有用户可见功能、业务结果、设计 token、窗口交互与 API 数据格式。
4. 不引入 Redux、React Router、通用插件系统或新的构建工具，除非先提供清楚的证据说明现有方案无法满足需求。
5. 保留 Electron 的 main/preload/renderer 安全边界、IPC sender 验证、Zod 输入校验、safeStorage 和严格 CSP；不得让 renderer 访问 Node.js 或直接保存密钥。
6. 一次只拆分一个责任边界。拆分 SettingsApp 或 AppController 时先保留原有行为与接口，并添加/更新对应测试。
7. 完成后运行可用的 typecheck、lint、format check、单元测试与生产 build；Windows 包必须在 Windows 环境实际验证。不能声称执行过没有执行的检查。
8. 用实际结果比较优化前后 renderer/main/preload 文件大小、安装包体积、启动时间、CPU/内存和构建耗时；没有数据就标注未测。
9. 按 GIT_WORKFLOW.md 提交并推送每个完成的更新；推送后验证远程同步状态。汇报使用“一句话总结 + 下方逐条一句话说明具体改动”的格式，并说明测试与测量结果。
10. 不得顺手做功能扩展或视觉重设计，避免同一次改动中混合架构、功能和样式问题。
```

---

## 15. 不建议现在做的事

- **不要推倒重写。** 当前已有模块边界、安全 IPC、配置迁移、调度器与测试，应该在既有基础上改良。
- **不要为每个小组件新建一层 class/service。** 抽象必须减少责任混杂，而不是单纯增加文件数量。
- **不要因为 Angular 有懒加载就给 React 项目引入路由库。** 现有 Electron 窗口由 `?view=` 选择，动态 import 足以实现视图级分割。
- **不要同时进行视觉大改。** 这次应以行为不变为目标；完整视觉测试和样式优化放到后续阶段。
- **不要默认每个配置 JSON 都应该异步化。** 小文件的同步实现可能完全够用；先处理有证据的大 I/O 或高频调用。
- **不要因 599 个 lock entry 就认为依赖太多。** 这是生产与开发依赖、传递依赖的整体记录；应查看实际生产依赖和打包产物。
- **不要把动态 import 当成安装包体积优化的全部。** 动态 import 影响加载时机；包的实际纳入与生产依赖裁剪是另一个问题。
- **不要仅凭代码行数或生成了多个 chunk 就宣称性能变好。** 必须测量。
- **不要更换 bundler、Electron 版本或一口气升级全体依赖来顺带“优化”。** 版本升级应有单独风险评估和测试。

---

## 16. 可以参考的项目与官方文档

参考重点是架构做法，而不是把这些项目的源码拼进 FlowerBuddy。实际复制代码前应自行核对各仓库当下的许可证与版本。

### 16.1 最值得参考的仓库

1. [electron-vite/electron-vite-react](https://github.com/electron-vite/electron-vite-react)
   适合参考 React + Electron + Vite 的工程组织、多窗口扩展、Vitest 与 Playwright 测试结构。它是工程结构参考，不要求把它替换成 FlowerBuddy 的底座。

2. [electron/electron-quick-start-typescript](https://github.com/electron/electron-quick-start-typescript)
   适合对照 Electron 最基本的 main/renderer 生命周期和 TypeScript 入口。它本身是最小示例，不适合作为完整业务架构。

3. [SeakMengs/WindowPet](https://github.com/SeakMengs/WindowPet)
   用来对照桌宠窗口、透明叠层、拖动和 Windows 交互；FlowerBuddy 现有窗口实现不需要仅因为参考仓库而推倒重来。

4. [yuqiangdede/desktop-pet](https://github.com/yuqiangdede/desktop-pet)
   用来对照桌宠外观、设置和窗口交互等产品设计。

5. [Egger0/desk-pet](https://github.com/Egger0/desk-pet)
   用来了解桌宠场景里的 DeepSeek 余额接口使用与信息呈现。不要将其整体源码直接合并进本项目；需要复用源码时另行核对许可。

6. [louislam/uptime-kuma](https://github.com/louislam/uptime-kuma)
   它不是 FlowerBuddy 同类型的 Electron 桌宠，适合参考监控功能的结果模型、状态表达与失败处理，不应该作为桌面窗口底座。

### 16.2 官方文档

- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)：性能测量、模块加载、主进程/renderer 阻塞建议。
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)：context isolation、sandbox、CSP、IPC sender 验证、窗口导航边界。
- [Electron `app.getAppMetrics()`](https://www.electronjs.org/docs/latest/api/app)：可用于观测应用相关进程的 CPU 使用情况等指标。
- [electron-vite Build](https://electron-vite.org/guide/build)：main、preload、renderer 的生产构建输出结构。
- [React `lazy`](https://react.dev/reference/react/lazy)：基于动态导入的组件懒加载。
- [Vite Features](https://vite.dev/guide/features.html)：动态 `import()` 与异步 chunk 等功能。
- [Google 官方维护的 Gmail API 专用 npm 包](https://www.npmjs.com/package/@googleapis/gmail)：评估聚合 `googleapis` 的替代选择时使用。

---

## 17. 最终验收清单

在结束“架构与性能优化阶段”之前，请逐项确认：

- [ ] 有一份可复现的优化前性能基线，包含代码版本、命令结果、启动耗时、构建耗时、renderer 产物与最终包大小。
- [ ] `pet/menu/bubble/settings` 四种窗口在生产安装版中均正常加载。
- [ ] 不使用的 renderer 视图不再经静态 import 全量进入每一个窗口的初始加载路径；具体分割由构建产物验证。
- [ ] 可选外部 SDK 的加载时机被推迟到真实需要时；关闭/未配置模块时不触发不需要的网络轮询或 SDK 初始化。
- [ ] `SettingsApp.tsx` 按设置页职责拆分，页面私有状态回到相应组件/Hook。
- [ ] `app-controller.ts` 的窗口、动作呈现和生命周期职责有清晰边界，没有重复维护同一窗口状态。
- [ ] 现有模块生命周期、IPC 与存储单元测试仍然通过。
- [ ] 增加基本 renderer/打包 smoke test，或清楚记录暂时无法自动化验证的范围。
- [ ] GitHub CI 可以自动运行基础检查；Windows 发布任务在 Windows runner 或开发者 Windows 机上实际验证。
- [ ] 优化后的指标与基线可对比，报告实际有改善的项目和没有改善的项目。
- [ ] 没有在重构中更改用户可见业务行为、API 契约或设计规范。
- [ ] 完成此阶段后再进入全面功能与视觉测试，而不是把本阶段的结构性测试当成全部功能验收。

**最终原则：先测量、再做最有依据的优化；先建立边界、再拆分代码；每次只改一个问题，并且用测试和实测数据证明没有退步。**
