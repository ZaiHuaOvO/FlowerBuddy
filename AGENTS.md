# AGENTS.md — 花伴 操作规则入口

> 适用对象：在本仓库工作的 AI Agent 与贡献者。
> 本文是**操作规则入口**，不是架构、功能或设计百科。具体事实查阅 `docs/README.md` 指向的权威文档与源码。
> 基线核对：2026-10-17，提交 `a635bb9`。

## 0. Agent 如何读取本文件

- 支持 `AGENTS.md` 约定的工具可以直接读取本文。
- Claude Code 默认读取 `CLAUDE.md`；本仓库的 [`CLAUDE.md`](CLAUDE.md) 只负责指向本文和文档索引。
- 其他工具若不自动读取 `AGENTS.md`，请在任务提示中明确要求先读本文；不要假设所有 Agent 都会自动加载它。
- 本文只定义**怎么做**。当前实现细节以源码为准，规则依据以 [`docs/README.md`](docs/README.md) 中标明的权威文档为准。

## 1. 每个任务开始前

按顺序完成以下检查，再动手修改：

1. 检查 Git 状态、分支、远程和最近提交：
   ```bash
   git status --short --branch
   git branch --show-current
   git remote -v
   git log -5 --oneline --decorate
   ```
2. 识别工作区中已有的未提交修改。它们属于用户，必须保留；不要覆盖、丢弃、回滚或混入本任务无关的提交。
3. 阅读本文件与 [`docs/README.md`](docs/README.md)；`docs/archive/` 只在需要追溯原始规划、历史审计或已完成的一次性任务时读取。
4. 根据任务类型阅读下表中的具体文档。
5. 阅读相关源码调用链，确认现有行为、输入输出、错误路径和测试，再决定修改范围。
6. 如果任务与现有文档冲突，先查清事实与目标；不要盲从过期文档，也不要为了消除冲突而擅自改变产品行为。无法确认的内容标记“待核实”。

## 2. 任务分类与文档路由

| 任务类型            | 开始前必读                                                                                                                    | 通常需要同步更新                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 功能行为            | [架构概览](docs/architecture/overview.md)、相关模块源码、[测试策略](docs/testing/strategy.md)                                 | [README.md](README.md)、[手动测试计划](docs/testing/manual-test-plan.md)、[OPEN_ITEMS](docs/OPEN_ITEMS.md) |
| UI / 样式           | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)、[开发约定](docs/development/coding-guidelines.md)、`src/renderer/src/styles/tokens.css` | DESIGN_SYSTEM（规则变化时）、手动测试计划视觉清单、`docs/screenshots/`（仅在有意识地更新基线时）           |
| 窗口 / IPC          | [架构概览](docs/architecture/overview.md)、`src/shared/api.ts`、`src/preload/api.ts`、`src/main/ipc/`                         | 架构概览、开发约定、手动测试计划                                                                           |
| 业务模块 / 外部 API | 架构概览、对应 `src/main/modules/<module>/` 源码、测试                                                                        | README、PRIVACY（网络行为变化时）、手动测试计划、OPEN_ITEMS                                                |
| 配置 / 迁移         | `src/main/storage/config-store.ts`、`config-schema.ts`、架构概览                                                              | 架构概览、手动测试计划、OPEN_ITEMS                                                                         |
| 安全 / 隐私         | `src/main/security/`、`src/main/shared/logger.ts`、[PRIVACY.md](PRIVACY.md)                                                   | PRIVACY、架构概览、手动测试计划、OPEN_ITEMS                                                                |
| 测试                | [测试策略](docs/testing/strategy.md)、[手动测试计划](docs/testing/manual-test-plan.md)                                        | 两份测试文档；如测试策略变化，同步影响矩阵                                                                 |
| 构建 / 发布         | `package.json`、`electron-builder.yml`、`electron.vite.config.ts`、`.github/workflows/ci.yml`                                 | README、架构概览的构建数据流、OPEN_ITEMS                                                                   |
| 依赖升级            | `package.json`、`package-lock.json`、`licenses/` 生成脚本                                                                     | README（命令或行为变化时）、许可证清单、PRIVACY（新增网络/数据处理时）                                     |
| 纯文档修改          | 本文、[docs/README.md](docs/README.md)、被修改文档                                                                            | 文档索引；若改变规则归属，更新引用链接                                                                     |
| 历史追溯            | [docs/archive/README.md](docs/archive/README.md)、对应归档文档                                                                | 不重写归档正文；新结论写入当前权威文档或 OPEN_ITEMS                                                        |

完整的影响矩阵见 [`docs/README.md`](docs/README.md#4-改动类型--必读文档--需要同步的文档)。

## 3. 先调查，再修改

- 先读调用链和相关实现，不凭文件名或旧文档猜测行为。
- 优先复用现有组件、工具、服务和存储层。不要为单个页面复制一套公共组件，也不要创建职责相同的第二个工具或服务。
- 不要把项目改造成由孤立页面、重复逻辑或临时脚本拼接的结构。
- 模块通过 `src/main/modules/registry.ts` 的静态注册表接入；不要引入从文件系统加载任意代码的动态插件机制。
- 修改公共类型、IPC 通道或存储结构时，先搜索所有使用点，避免只改一侧。
- 不确定的行为、平台限制或外部 API 约束，标注“待核实”并给出核实办法，不要写成既定事实。
- `docs/archive/` 是只读归档：只保存已完成或已被当前文档取代的材料，不作为当前实现、规则或待办来源；只在追溯历史时查询。

## 4. 代码质量约定（摘要）

详细规则与示例见 [`docs/development/coding-guidelines.md`](docs/development/coding-guidelines.md)。

- **TypeScript**：保持 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax` 等现有检查通过；新增类型优先放在 `src/shared/api.ts` 或对应模块的 `types.ts`。
- **进程职责**：业务请求、凭据、文件系统和调度只在主进程；preload 只暴露按窗口划分的窄 API；renderer 只负责展示与收集输入。
- **IPC 安全**：每个 handler 必须经过 sender 校验与 Zod 输入校验；新增通道要同时更新 `IPC_CHANNELS`、preload API、类型定义和 handler。不要向 renderer 返回原始错误、请求头、令牌或堆栈。
- **模块边界**：模块只依赖共享类型、存储、安全、调度等下层；窗口、IPC、托盘和 `AppController` 负责编排，不要把外部 API 调用塞进窗口类。
- **错误处理**：主进程内部抛 `AppError`，对外只返回 `PublicError`（code、message、retryable）。
- **日志**：使用 `Logger`，不要把密钥、token、完整认证 URL 或个人数据写入日志；日志元数据会脱敏，但不要依赖脱敏兜底。
- **配置与迁移**：普通配置写入 `ConfigStore`，文档数据写入 `JsonStore`；修改 schema 时提升 `CURRENT_CONFIG_SCHEMA_VERSION` 并保证旧文件可修复或迁移。敏感值只能进入 `SecretStore`。
- **异步生命周期**：定时任务统一注册到 `TaskScheduler`；停止时清理 timer、AbortController 和订阅；取消/超时必须有明确路径。
- **公共组件**：UI 复用 `src/renderer/src/components/` 与 `styles/components.css`；不得在业务组件中另建一套硬编码设计值。

## 5. 设计约束

- 任何 UI 工作开始前必须阅读 [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) 与 `src/renderer/src/styles/tokens.css`。
- 颜色、间距、圆角、阴影、字体和动效使用现有 token；新增 token 必须先说明原因并更新设计规范。
- 样式改动要考虑视觉回归：至少检查默认、hover、pressed、focus-visible、disabled、loading、error、empty 状态，以及长文本、窄窗口、高 DPI 和减少动态效果。
- 不要给桌宠透明窗口添加不必要的背景、边框或装饰卡片；保持角色图片为主视觉。
- 视觉基线截图位于 `docs/screenshots/`，不要在本任务中随意移动或删除。

## 6. 测试约束

- 先查看 `package.json` 中的真实 scripts，不要假设命令存在。
- 根据改动运行适用的检查：`npm run typecheck`、`npm run lint`、`npm test`、`npm run build`；涉及打包时运行 `npm run dist:win` 或 `npm run dist:win:dir`。
- 单元测试位于 `tests/unit/`，使用 Vitest 的 Node 环境；优先使用依赖注入、fake timers 和模拟响应，不使用真实凭据。
- 必须如实报告运行了哪些检查、结果如何、哪些未运行及原因。没有真实运行记录时，不得声称测试通过。
- 依赖系统鼠标位置或真实输入时序的自动化/半自动化测试（悬停、拖拽、菜单移出延时关闭、原生窗口定位等）必须在用户未操作鼠标的前提下执行。若观察到光标位置、移动轨迹、焦点或关停时序与脚本预期不符，立即判定该次结果不可信、拒绝将其报告为通过，说明可疑原因并重新测试。
- 真实 DeepSeek / 阿里云凭据测试需要外部条件，按 [`docs/testing/manual-test-plan.md`](docs/testing/manual-test-plan.md) 的前置条件执行，不得把密钥写入仓库或报告。

## 7. 规则与文档同步机制

每次任务都按以下六步执行：

1. **接任务前**：检查 Git 状态，阅读本文、文档索引和任务相关规范。
2. **开发前**：确认现有行为、调用链、验收条件，以及预计受影响的文档。
3. **实施时**：代码、测试和文档一起考虑；不要把文档更新留到“以后”。
4. **完成前**：逐条核对文档是否与最终代码一致；检查链接、标题、代码块和列表格式。
5. **提交前**：代码与文档放在同一逻辑变更中；运行适用检查并审阅完整 diff。
6. **提交后**：按 [GIT_WORKFLOW.md](GIT_WORKFLOW.md) 推送、验证远程状态，并只报告真正完成的事项。

影响矩阵不是“记得更新文档”的口号：改动类型对应的必读与同步文档见 [`docs/README.md`](docs/README.md)。

## 8. Git 约束

- 严格遵守 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)。
- 提交前审查完整 diff，确认没有无关代码、临时文件、构建产物、用户数据或秘密。
- 一个提交聚焦一个可解释的改动主题；代码与相关文档应放在同一逻辑提交中。
- 完成独立更新后按现有规范提交并推送；推送后验证本地与远程状态。
- 未经用户明确同意，不得执行 `git push --force`、`git reset --hard`、删除远程分支或重写已推送历史。
- 不得把真实 API Key、AccessKey Secret、token、个人配置或 `.env` 提交到仓库。

## 9. 明确禁止

- 未经授权的大范围重构、技术栈替换或目录重组。
- 擅自改变产品行为、默认值或用户可见文案来“顺带修复”问题。
- 伪造测试结果、截图、性能数字或外部账户验证结论。
- 把计划功能、建议或推测写成“已实现”。
- 在文档、截图、测试夹具或 Git 中保存秘密信息或真实用户数据。
- 未经同意执行破坏性 Git 操作或删除用户未提交的修改。

## 10. 结束任务时的报告格式

```text
一句话总结：本次完成了什么，以及是否已推送。

详细改动：
- 每条用一句完整的话说明一个具体改动及其目的。

验证结果：
- 列出真实运行的检查及结果；未运行的说明原因。

未解决事项：
- 逐条列出；无则写“无”。

Git 状态：
- 分支、提交短哈希、远程同步/推送验证状态；无法确认时明确说明。
```
