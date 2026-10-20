# 花伴 文档索引

> 本文件是文档体系的**单一入口**。
> 显示名称：**花伴**。内部包名、可执行文件名、`userData` 目录、`flowerbuddy-pet://` 协议与部分历史记录仍保留 `FlowerBuddy`/`flower-buddy` 标识，以兼容升级和现有数据。
> 最后核对：2026-10-17，基线提交 `a635bb9`。
> 操作规则入口是 [`AGENTS.md`](../AGENTS.md)；本文件负责说明“每份文档回答什么问题、什么时候必须读、什么时候必须同步”。

## 1. 权威来源与优先级

出现冲突时，按以下顺序确认事实，而不是按文档新旧程度猜测：

1. **当前源码与配置**：描述“现在实际怎么运行”。关键入口包括 `package.json`、`electron.vite.config.ts`、`electron-builder.yml`、`src/` 与 `tests/`。
2. **操作规范**：`AGENTS.md`、`GIT_WORKFLOW.md`、`DESIGN_SYSTEM.md`、`docs/development/coding-guidelines.md`、`docs/testing/strategy.md`。
3. **当前架构事实**：`docs/architecture/overview.md`（必须随代码同步）。
4. **用户文档**：`README.md`、`PRIVACY.md`、`docs/README-使用说明.txt`。
5. **历史/归档材料**：`docs/archive/`（原始规划、已完成的一次性任务提示词、历史审计报告）、`docs/performance-*.md`、`docs/refactor-*.md`、`docs/regression-report.md`、`docs/screenshots/`。

同一规则只在一个地方详细维护；其他文档通过链接引用。发现冲突时先查源码和目标，再修正文档或登记待办，不擅自改变产品行为。

## 2. 文档清单

状态标记含义：

- **当前事实**：描述当前实现，代码变化时必须同步。
- **操作规范**：约束后续工作，规则变化时必须同步。
- **用户文档**：面向使用者或贡献者，用户可见行为变化时必须同步。
- **历史/规划**：保留背景与原始约束，不是当前实现清单。
- **归档/只读**：已完成或已退出日常流程的材料，保留当时状态，只在追溯历史时查询。
- **记录**：某次执行的结果快照，原则上不重写；新结果另建记录或追加日期。

| 文档                                                                                              | 负责回答什么问题                                                         | 状态                      | 什么时候必须读                             | 什么变化要求同步                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| [AGENTS.md](../AGENTS.md)                                                                         | Agent 如何开始任务、如何路由文档、编码/测试/安全/文档同步/Git 规则       | 操作规范                  | 每个任务开始前                             | 规则或流程变化时；同步本索引                             |
| [CLAUDE.md](../CLAUDE.md)                                                                         | Claude Code 的入口指针                                                   | 操作规范                  | Claude Code 会话开始时                     | `AGENTS.md` 或索引路径变化时                             |
| [README.md](../README.md)                                                                         | 项目简介、快速上手、常用命令、功能概览、已知限制、安装与隐私入口         | 用户文档                  | 涉及用户可见行为、命令、安装或发布时       | 功能、命令、使用方式、限制、发布产物变化时               |
| [website/README.md](../website/README.md)                                                         | 独立 VitePress 官网的本地构建、`/flowerbuddy/` base、部署与代理要求      | 用户文档                  | 修改官网内容、构建或部署时                 | 官网路由、base、部署方式或内容边界变化时                 |
| [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)                                                           | UI 设计来源、token、组件、窗口与无障碍约束                               | 操作规范                  | 任何 UI/样式工作前                         | 设计 token、组件规则、视觉验收标准变化时                 |
| [GIT_WORKFLOW.md](../GIT_WORKFLOW.md)                                                             | 分支、提交、推送、验证、失败处理与汇报格式                               | 操作规范                  | 每次提交/推送前                            | Git 流程或汇报格式变化时                                 |
| [LICENSE](../LICENSE)                                                                             | 源代码、脚本、测试与文档文本的 MIT 许可范围                              | 操作规范                  | 分发、复用或发布前                         | 许可策略变化时                                           |
| [ASSETS-LICENSE.md](../ASSETS-LICENSE.md)                                                         | 图案、角色形象、图标、安装器插图与截图等美术素材的权利范围               | 操作规范                  | 复用或分发美术素材前                       | 美术素材权利或授权策略变化时                             |
| [PRIVACY.md](../PRIVACY.md)                                                                       | 对用户公开的数据保存、网络访问、日志与删除方式                           | 用户文档                  | 涉及网络、凭据、存储或日志时               | 数据位置、网络目标、凭据处理或删除方式变化时             |
| [docs/archive/Windows_桌宠个人助手_技术开发文档.md](archive/Windows_桌宠个人助手_技术开发文档.md) | 项目最初的完整产品/技术规划与阶段任务                                    | 归档/历史                 | 仅在追溯原始设计意图时读取                 | 不在归档中更新；新结论写入当前架构、README 或 OPEN_ITEMS |
| [docs/OPEN_ITEMS.md](OPEN_ITEMS.md)                                                               | 工程阻塞项、已知限制、需要外部条件的验证与明确不做的事项                 | 记录（工程/发布待办入口） | 开始任务前、结束任务前                     | 任何工程/发布待办或限制状态变化时                        |
| [docs/TODO.md](TODO.md)                                                                           | 待开发、搁置和已完成归档的产品想法；已明确取消的需求不保留               | 记录（产品想法池）        | 规划新功能、整理需求、收到 TODO 编号列表时 | 新增、完成、搁置或取消想法时；完成项划线移入文末归档区   |
| [docs/architecture/overview.md](architecture/overview.md)                                         | 当前进程边界、目录职责、IPC、模块生命周期、存储、构建与依赖方向          | 当前事实                  | 任何代码改动前                             | 架构、IPC、存储、构建或依赖方向变化时                    |
| [docs/development/coding-guidelines.md](development/coding-guidelines.md)                         | 当前实际采用的代码组织、命名、类型、错误、日志、配置、测试与新增模块约定 | 操作规范                  | 编写或审查代码前                           | 约定或工具配置变化时；区分“已存在”与“建议”               |
| [docs/development/release-process.md](development/release-process.md)                             | 版本号、标签、Release 工作流与草稿发布审核流程                           | 操作规范                  | 准备发布或修改发布工作流时                 | 版本策略、标签触发、产物或 Release 流程变化时            |
| [docs/testing/strategy.md](testing/strategy.md)                                                   | 测试分层、现有测试范围、如何运行、自动化与人工边界                       | 操作规范                  | 修改测试或评估验证范围时                   | 测试分层、脚本、CI 或覆盖范围变化时                      |
| [docs/testing/manual-test-plan.md](testing/manual-test-plan.md)                                   | 可逐条勾选的功能验收与视觉检查清单                                       | 操作规范                  | 每轮功能/样式测试前                        | 用户可见功能、交互、设置项或视觉状态变化时               |
| [docs/README-使用说明.txt](README-使用说明.txt)                                                   | 随发布包分发的最终用户说明                                               | 用户文档                  | 打包发布前                                 | 运行方式、功能、数据位置或卸载方式变化时                 |
| [docs/regression-report.md](regression-report.md)                                                 | 2026-10-17 完整回归与 2026-10-18 发布前自动化验收的执行结果              | 记录                      | 需要查看回归或自动化验收证据时             | 不重写；新一轮执行另建记录或在文末追加日期               |
| [docs/performance-baseline.md](performance-baseline.md) 等 `performance-*.md`                     | 架构/性能优化各阶段的测量与结论                                          | 记录                      | 需要历史性能数据时                         | 不重写；新测量另建记录                                   |
| [docs/refactor-*.md](refactor-app-controller.md)                                                  | 两次重构的范围、验证与结果                                               | 记录                      | 需要了解重构边界时                         | 不重写                                                   |
| [docs/screenshots/](screenshots/)                                                                 | 视觉回归基线截图                                                         | 记录                      | UI 改动前、视觉回归时                      | 仅在有意识地更新视觉基线时替换，并说明日期与范围         |
| [docs/archive/](archive/README.md)                                                                | 已完成、已退出日常流程的历史材料                                         | 归档/只读                 | 仅追溯历史时                               | 不重写正文；只补充归档说明或修正失效链接                 |

### 归档区

- `docs/archive/` 保存已完成的一次性任务提示词、历史审计报告和已被当前文档取代的初始规划。
- 归档材料不是当前实现、当前规则或待办清单；日常任务不需要读取，只有追溯设计意图或历史决策时才查询。
- 新结论、新规则和未完成项必须写入当前权威文档或 [OPEN_ITEMS.md](OPEN_ITEMS.md)，不得只更新归档正文。
- 归档清单和规则见 [docs/archive/README.md](archive/README.md)。
- **名称说明**：`docs/archive/`、`docs/performance-*.md`、`docs/regression-report.md` 等历史记录保留了当时的名称 `FlowerBuddy`，仅作为历史快照，不代表当前显示名称。当前产品名称为 **花伴**。

## 3. 文档状态标签

新增或修改文档时，在顶部或相关章节明确使用以下词汇，避免把提议写成事实：

- **当前已实现**：已存在于源码并有对应入口，可按文档路径直接核对。
- **待验证 / 待核实**：文档或推断尚未被源码、真实运行或平台环境确认。
- **计划 / 建议**：尚未实现，不代表当前行为。
- **已知限制**：当前版本明确不做或无法完成的事项，统一登记到 `docs/OPEN_ITEMS.md`。

没有真实运行记录，不得写“测试通过”；没有真实测量，不得写具体性能百分比。

## 4. 改动类型 → 必读文档 → 需要同步的文档

| 改动类型            | 开始前必读                                                                                    | 需要同步更新                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 功能行为            | `AGENTS.md`、架构概览、相关模块源码、测试策略                                                 | `README.md`、手动测试计划、`OPEN_ITEMS.md`；如入口或模块生命周期变化，同步架构概览                     |
| React UI / 样式     | `DESIGN_SYSTEM.md`、开发约定、`tokens.css` 与现有组件                                         | `DESIGN_SYSTEM.md`（规则或 token 变化时）、手动测试计划视觉清单、`docs/screenshots/`（基线有意更新时） |
| 窗口 / IPC          | 架构概览、`src/shared/api.ts`、`src/preload/api.ts`、`src/main/ipc/`                          | 架构概览、开发约定、手动测试计划                                                                       |
| 业务模块 / 外部 API | 架构概览、对应模块源码、测试策略                                                              | `README.md`、`PRIVACY.md`（网络或数据处理变化时）、手动测试计划、`OPEN_ITEMS.md`                       |
| 配置 / 迁移         | 架构概览、`storage/config-store.ts`、`storage/config-schema.ts`                               | 架构概览、手动测试计划、`OPEN_ITEMS.md`（兼容性或迁移限制）                                            |
| 隐私 / 安全         | 架构概览、`src/main/security/`、`shared/logger.ts`、`PRIVACY.md`                              | `PRIVACY.md`、架构概览、手动测试计划、`OPEN_ITEMS.md`                                                  |
| 测试策略            | 测试策略、手动测试计划、`package.json` scripts                                                | 两份测试文档；测试命令或 CI 变化时同步 `README.md`                                                     |
| 依赖                | `package.json`、`package-lock.json`、许可证生成脚本                                           | `README.md`（命令或行为变化时）、许可证清单、`PRIVACY.md`（新增外部服务时）、`OPEN_ITEMS.md`           |
| 构建 / 打包 / 发布  | `package.json`、`electron-builder.yml`、`electron.vite.config.ts`、`.github/workflows/ci.yml` | `README.md`、架构概览的构建数据流、`docs/README-使用说明.txt`、`OPEN_ITEMS.md`                         |
| Git / Agent 规则    | `AGENTS.md`、`GIT_WORKFLOW.md`、本索引                                                        | 对应规则文档、本索引、`CLAUDE.md` 指针                                                                 |
| 纯文档修改          | `AGENTS.md`、本索引、被修改文档                                                               | 本索引；若改变权威归属，更新所有引用链接                                                               |

## 5. 规则与文档同步流程

1. **接任务前**：检查 Git 状态，读 `AGENTS.md`、本索引和任务相关文档。
2. **开发前**：确认现有行为、调用链、验收条件和预计影响的文档。
3. **实施时**：同时考虑代码、测试与文档，不把同步留到不确定的未来。
4. **完成前**：逐条核对文档与最终代码一致；检查链接、标题、代码块和列表格式。
5. **提交前**：代码与文档在同一逻辑变更内；运行适用检查并审阅完整 diff。
6. **提交后**：按 `GIT_WORKFLOW.md` 推送并验证远程结果；只报告真正完成的事项。

## 6. 维护原则

- **源码反映当前行为，文档负责解释和约束。** 冲突时先查证据，不盲从旧文档，也不默默改变产品行为。
- **区分事实与提议。** 使用“当前已实现 / 待验证 / 计划”标记。
- **单一权威来源。** 同一规则只在一份文档中详细维护，其他位置链接引用。
- **规模从简。** 优先写操作流程、边界、职责和验收标准；不复制大段源码，不把实现细节塞进 `AGENTS.md`。
- **不存秘密。** 文档、截图、测试夹具和示例中不得出现真实 API Key、AccessKey、token 或个人配置。
- **不引入额外工具。** 文档治理不新增文档生成框架、静态站点或检查器；使用现有 Markdown 与仓库脚本即可。
