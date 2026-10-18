# 花伴

Windows 桌面宠物与个人信息助手。第一阶段功能已全部完成：桌宠外壳、备忘录（含提醒与桌面锚点）、网站检测、DeepSeek 余额、阿里云 ESA 今日流量、Gmail 新邮件提醒，以及 Windows 安装包/便携版/ZIP 发布产物。

## 文档入口

- 贡献者与 AI Agent 的操作规则：[AGENTS.md](AGENTS.md)
- 文档索引、权威来源与改动影响矩阵：[docs/README.md](docs/README.md)
- 当前架构与数据流：[docs/architecture/overview.md](docs/architecture/overview.md)
- 开发约定：[docs/development/coding-guidelines.md](docs/development/coding-guidelines.md)
- 测试策略与手动验收清单：[docs/testing/strategy.md](docs/testing/strategy.md)、[docs/testing/manual-test-plan.md](docs/testing/manual-test-plan.md)
- 未完成项与已知限制：[docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)

## 最终用户须知

正式发布后，用户只需运行 `花伴-Setup-<version>-x64.exe` 安装，或直接运行 `花伴-Portable-<version>-x64.exe`。**最终用户不需要安装 Node.js，也不需要打开终端或执行任何命令。**

本仓库中的 `npm` 命令仅面向贡献者与 AI Agent。

> 当前构建产物未做代码签名，Windows SmartScreen 可能提示"未知发布者"。这是预期行为，不代表安装包已签名。

## 当前阶段已实现

- 透明、无边框、始终置顶的桌宠窗口，按住拖动不误判为点击。
- 单击桌宠只播放约 520ms 的“压低—回弹—收敛”弹簧反馈（可在设置中关闭），不会打开菜单；右键桌宠打开快捷菜单。
- 快捷菜单是透明背景上悬浮的 4 个白色图标按钮：功能、设置、隐藏桌宠、退出；鼠标移入显示棕色说明，移入“功能”按钮会在上方展开白色的模块动作按钮，移出菜单后自动收起。菜单优先出现在桌宠上方，上方空间不足时翻到下方。菜单打开时再次右键不会关闭；点击设置不会收起菜单，齿轮会显示选中反馈，移到设置窗口后菜单才按“离开菜单和桌宠约 0.8 秒”的规则关闭。
- 独立的气泡窗口，支持 `idle` / `loading` / `success` / `empty` / `error` 五种状态、自动消失与手动关闭。
- 设置窗口：常规页提供开机自启、始终置顶、抚摸效果、气泡停留时长（1–10 秒）、桌宠图片与缩放、新建备忘录快捷键；功能管理支持拖拽排序和启用/停用；左侧导航只列出已启用模块。
- 单张 PNG 导入：校验格式与大小（≤15 MB），复制到用户数据目录，保留宽高比。
- 桌宠位置、尺寸和设置持久化到用户数据目录的 `config.json`，采用临时文件 + rename 原子写入并带 `schemaVersion`。
- 多显示器与分辨率变化时自动把桌宠移回可见区域；单实例锁避免重复启动。
- 安全基线：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、窄 preload 桥、IPC sender 校验、权限请求全部拒绝、生产环境严格 CSP。导航与 `window.open` 拦截尚待核实，见 [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)。
- 桌宠图片通过自定义 `flowerbuddy-pet://` 协议提供；主进程只允许读取当前配置的形象和内置默认形象。
- Vitest 单元测试、ESLint、Prettier、TypeScript 类型检查。
- electron-builder 的 NSIS 安装版与 portable 便携版配置，产物输出到 `release/`。

### 阶段 2 新增

- 阶段 2 将配置 schema 升级到 `schemaVersion: 2`，新增五个模块的独立开关；旧配置自动迁移，迁移前与损坏/未来版本文件都会备份，恢复结果会在设置页提示。当前 schema 版本为 6，以 `src/main/storage/config-schema.ts` 为准。
- 使用 Electron `safeStorage` 异步 API 的 Secret Store：密文以 Base64 写入 `secrets.enc.json`，密钥只在主进程解密；加密不可用时拒绝保存并明确提示，绝不回退明文。
- 静态模块注册表（备忘录、Gmail、ESA、DeepSeek、网站检测）与生命周期管理；未配置的模块不会被启动。
- 统一任务调度器：同一任务不重叠、可取消、失败指数退避、系统睡眠恢复后从当前时间重新计时。
- 统一错误类型与 IPC 输入 Zod 校验；渲染进程只收到安全的错误码、用户说明和是否可重试。
- 脱敏日志写入用户数据目录的 `logs/app.log`，覆盖 Authorization、API Key、AccessKey、token、邮件正文等敏感字段，按大小轮转并保留 7 天。
- 设置窗口新增“功能管理”页面：模块状态标签、独立开关与安全存储可用性提示。

### 阶段 3 新增

- 原“特殊日期”模块已由“备忘录”模块整体替换；旧日期数据在升级启动时删除，配置文件自动迁移模块开关与排序。
- 备忘录支持文本与本地粘贴图片、完成/删除、提醒时间（文本自然语言或日期选择器）以及桌面锚点卡片。
- 网站检测模块：新增/编辑/删除/停用 URL，手动检测单个或全部启用网站，显示状态码、耗时和错误类型。
- 网站检测区分 HTTP 错误（如 404）、超时、DNS/连接失败与 TLS 证书错误，并去除敏感 query 参数后再展示最终 URL。
- 可选定时检测默认关闭；启用后由统一调度器按 5/10/15/30 分钟执行，停用模块会立即停止对应任务。
- 设置窗口使用左侧导航；核心页为“常规 / 功能”，其余页面按已启用模块动态出现。
- 新增公共 Tag、Field、EmptyState 组件，全部使用设计 token。

### 阶段 4 新增

- DeepSeek 余额模块：调用官方 `GET https://api.deepseek.com/user/balance`，展示多币种总额、赠送与充值余额。
- DeepSeek 支持手动刷新与 15/30/60 分钟可选自动刷新；“今日花费”明确显示为官方账号级统计未接入，不使用余额差额估算。
- 阿里云 ESA 今日流量模块：使用官方 `@alicloud/esa20240910` SDK 调用 `DescribeSiteTimeSeriesData`，字段 `Traffic`、维度 `ALL`。
- ESA 的“今天”按本机时区 00:00 至当前时刻换算为 UTC 查询，展示累计流量、采样率、统计区间与更新时间，并注明可能延迟/采样。
- DeepSeek/ESA 设置分页提供密码输入、保存并测试、刷新、清除配置与自动刷新间隔；密钥保存后无法回显明文。
- API Key、AccessKey ID/Secret 全部经 IPC 进入主进程并用 `safeStorage` 加密写入 `secrets.enc.json`；SiteId 作为非敏感配置写入 `config.json`。
- 模块状态与快捷菜单动作会随凭据配置联动：未配置时不出现动作，配置并启用后分别出现“查询余额”“今日流量”。

### 阶段 5 新增

- Gmail 模块：Gmail API + OAuth 2.0，最小只读权限，系统浏览器 + `127.0.0.1` 随机端口回环回调，PKCE 与 state 校验。
- 首次授权只建立同步基线，不把历史邮件当作新邮件；之后使用 History API 增量读取并按 Message ID 去重。
- `historyId` 失效时自动重建基线，不补发历史提醒；授权失效会停止轮询并提示重新连接。
- 只读取发件人、主题、日期与消息 ID 等元数据，不读取或存储邮件正文；通知可隐藏发件人与主题。
- 新邮件通过 Windows 系统通知与桌宠气泡反馈；模块停用或断开账号后立即停止轮询。
- 设置页新增 Gmail 分页：OAuth 客户端配置、连接/断开、立即检查、轮询间隔、系统通知与隐藏主题开关。
- 新增“开机启动”与“启动时显示桌宠”设置项；打包版本会同步 Windows 登录启动项。

### 阶段 6 / 发布

- 自动生成 NSIS 安装版、portable 便携版，以及包含便携版、使用说明和第三方许可证清单的 ZIP。
- 新增 [PRIVACY.md](PRIVACY.md) 隐私说明与安装包内的 `README-使用说明.txt`。
- 完成启动、托盘、模块隔离、无效凭据、网络错误、休眠恢复调度、安装/卸载与密钥扫描验证。
- 在关闭 Node.js 路径的环境下启动便携版做运行验证（详见最终报告）。

### 设置页更新（2026-10-17）

- 左侧导航分为“常规 / 功能”与已启用模块两组，中间用分割线分隔；模块入口只显示已启用功能，顺序与功能管理页面一致。
- 常规页整合为 5 项：开机自启、始终置顶、抚摸效果、气泡停留时长（1–10 秒滑块）和桌宠图片选择，每项提供悬浮说明。
- 功能管理改为左右两列：左侧拖拽排序已启用功能，右侧启用已停用功能；重新启用的功能追加到左侧列表底部。
- 保存结果、恢复提示与错误信息改为窗口右上角的小字状态；错误使用深红色，其余使用棕色。

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
    ipc/                 # IPC 注册、sender 校验与 Zod 输入校验
    modules/             # 静态模块注册表、备忘录/网站/DeepSeek/ESA/Gmail
    protocol/            # 桌宠与备忘录图片自定义协议
    scheduler/           # 统一任务调度器
    security/            # 安全窗口选项与 Secret Store
    shared/              # 统一错误类型与脱敏日志
    storage/             # 配置 schema/迁移、数据文件与图片导入
    tray/                # 系统托盘
    windows/             # 桌宠/菜单/气泡/设置/备忘卡片窗口与几何计算
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

- 启动后桌宠出现在桌面右下角，默认高度约 80px（可在设置中按 0.5×–2× 缩放）；按住拖动可移动，单击播放反馈动画，右键打开快捷菜单。
- 双击托盘图标或通过托盘菜单可打开设置；托盘菜单可显示/隐藏桌宠或退出。
- 设置中的“导入 PNG 图片”会把图片复制到用户数据目录，不会上传到任何外部服务。
- 关闭设置窗口不会退出程序；必须通过托盘或快捷菜单的红色电源图标结束。
- 用户数据位于 Electron `userData` 目录（Windows 通常为 `%APPDATA%\FlowerBuddy`），包含 `config.json`、`secrets.enc.json`、`data/`、`pets/`、`memo-images/` 与 `logs/`。显示名称已改为“花伴”，为兼容升级，数据目录继续沿用 `FlowerBuddy`。
- 设置中的“功能管理”可以独立启用/停用每个模块；未配置或尚未实现的模块不会发起后台请求。
- “备忘录”分页管理文本备忘、粘贴图片与提醒时间，可把备忘锚定成桌面卡片；“网站”分页管理 URL、超时与可选定时检测。
- 备忘录提醒到点后通过桌宠气泡提示；默认快捷键 `Alt+A` 打开设置并聚焦新建备忘录，可在常规页修改。
- 桌面备忘卡片始终置顶，可拖动标题栏移动、拖动四角调整大小，并提供完成与取消锚点按钮。
- 快捷菜单鼠标移入“功能”后会列出已启用模块的可用动作（例如“检测网站”），结果显示在桌宠气泡中。
- DeepSeek/ESA 凭据只在设置中输入的瞬间经过主进程，之后以密文保存；应用不提供读取明文密钥的接口。
- ESA 请使用只授予 `esa:DescribeSiteTimeSeriesData` 权限的 RAM 子账号，不要使用主账号 AccessKey；清除配置会同时移除 AccessKey 与 SiteId。
- Gmail 只申请 `gmail.readonly`，仅读取邮件元数据，不读取正文；refresh token 加密保存，断开时会尽力在线撤销并删除本地 token。

## Gmail 配置（发布者或高级用户）

1. 在 Google Cloud Console 创建项目并启用 Gmail API。
2. 配置 OAuth consent screen；开发阶段可添加测试用户，公开发布需要按 Google 要求完成验证。
3. 创建 OAuth 客户端 ID，应用类型选择“桌面应用”。
4. 在应用“设置 → Gmail”中填写 Client ID 与 Client Secret，保存后点击“连接 Gmail”，在系统浏览器中完成授权。
5. 未发布的 OAuth 应用可能只允许测试用户登录；这是 Google 侧限制，不是应用错误。

> 公开分发版本建议由发布者准备统一的 OAuth 客户端，避免要求普通用户自行创建 Google Cloud 项目。

- 快捷菜单的“功能”面板只显示已实现、已配置且已启用模块的动作；没有任何可用动作时显示空状态。

## 设计系统与视觉基线

- 视觉规范以 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) 为准；设计 token 集中定义在 [tokens.css](src/renderer/src/styles/tokens.css)，业务样式不硬编码颜色、间距、圆角或阴影。
- Token 来源：花墨设计规范 <https://flowersink.com/design/>，核对日期 2026-10-17，直接读取其公开样式中的 `--fi-*` 自定义属性。
- 已核验并落地：颜色 token、间距标尺（4–52px）、圆角（8/10/14/18px 等）、三档阴影、字体栈与字号/字重/行高、动效时长（0.16/0.24/0.32s，桌宠弹簧为 0.52s）与缓动、控件高度（28/36/44px）、表单默认/悬停/聚焦/禁用状态。
- 主按钮另按线上 `.fl-button--solid` 组件实测对齐：背景 `#8b5a2b`、白色文字、34px 高、10px 圆角、500 字重。
- 派生值：为适配 Windows 中文显示，在规范字体栈末尾追加了 Microsoft YaHei 回退。
- 已实测：按钮默认/hover/按下/focus-visible/禁用、下拉框 focus、气泡 success/error、快捷菜单与设置窗口；模拟 `prefers-reduced-motion: reduce` 后弹跳动画数量为 0 且过渡降至 0.01ms；托盘图标为有效的 64×64 PNG；在 640/780/960px 宽度与 100%/125%/150%/200% 缩放下无横向溢出。
- 截图（200% 缩放下采集，桌宠/菜单/气泡保留透明通道）：[桌宠](docs/screenshots/pet.png)、[快捷菜单](docs/screenshots/quick-menu.png)、[成功气泡](docs/screenshots/bubble-success.png)、[失败气泡](docs/screenshots/bubble-error.png)、[设置窗口](docs/screenshots/settings.png)、[网站检测](docs/screenshots/settings-websites.png)、[Gmail](docs/screenshots/settings-gmail.png)、[DeepSeek](docs/screenshots/settings-deepseek.png)、[ESA](docs/screenshots/settings-esa.png)。

## 安全设计

- 凭据只允许在主进程中处理；渲染进程永远不持有 API Key、AccessKey Secret 或 OAuth token。
- 敏感值使用 Electron `safeStorage` 异步 API 加密后写入 `secrets.enc.json`；加密不可用时拒绝保存，不回退明文。密钥读取没有渲染进程接口。
- 日志统一脱敏，且不记录密钥、完整认证信息或邮件正文；日志按大小轮转并保留 7 天。
- 所有窗口统一使用 `src/main/security/web-preferences.ts` 中的安全选项。
- 每个 IPC handler 先校验 `event.senderFrame.url`，再用 Zod 校验输入，只向渲染进程返回安全的错误码与说明。
- 生产环境渲染进程只加载本地文件，并注入严格 CSP；开发环境额外允许 React Refresh 内联脚本与本地 HMR WebSocket。

## 打包

```bash
npm run dist:win
```

产物（`release/`）：

- `花伴-Setup-<version>-x64.exe`：NSIS 安装程序，默认按当前用户安装，可选择安装目录。
- `花伴-Portable-<version>-x64.exe`：便携版，双击运行。
- `花伴-<version>-x64.zip`：便携版 + 使用说明 + 第三方许可证清单。

用户数据将保存在 Electron `userData` 目录，升级不会覆盖；不会写入安装目录。隐私与删除方式见 [PRIVACY.md](PRIVACY.md)。

## 已知限制（第一版）

- 真实 Gmail OAuth 与真实账户数据尚未验证：需要发布者/用户提供 Google OAuth 客户端并在应用内完成授权。
- 真实 DeepSeek/ESA 账户数据需在应用内输入凭据后查看；仓库不包含真实凭据。
- DeepSeek 官方没有可用的账号级每日消费接口，因此只显示余额，不显示今日花费。
- ESA 流量可能被官方采样且存在统计延迟；接入点目前固定为国内 `esa.cn-hangzhou.aliyuncs.com`。
- 备忘录提醒仅通过桌宠气泡展示，不发送系统通知；自然语言时间识别覆盖常见中文表达，无法识别时会要求改用日期选择器。
- 桌面锚点卡片为只读预览，编辑需回到设置页；粘贴图片会统一转存为 PNG。
- 网站检测只代表本机网络结果，不代表全球可用性。
- 安装包未做代码签名，SmartScreen 可能提示未知发布者。
- 多显示器物理验证与完全干净 Windows 环境的安装测试仍需在具备条件的环境复验。

完整的待办与限制清单见 [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md)，每阶段验收时更新。

## 许可证

本项目自有代码暂未声明开源许可证。第三方依赖的许可证见 `npm run licenses` 生成的清单。发布前需补全隐私说明与最终许可文件。
