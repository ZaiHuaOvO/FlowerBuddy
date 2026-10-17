# 文档归档区

> 状态：**只读归档**。本目录保存已完成或已退出日常使用流程的历史材料。
> 归档日期：2026-10-17。
> 当前规则与事实**不在本目录维护**：操作规则见 [`AGENTS.md`](../../AGENTS.md)，文档索引见 [`docs/README.md`](../README.md)，当前架构见 [`docs/architecture/overview.md`](../architecture/overview.md)。

## 归档规则

- 只有**任务已完成、内容已并入当前文档或已被源码取代**的材料才放入本目录。
- 归档文档不作为当前实现、当前规则或待办清单使用；仅在追溯设计意图、审计结论或历史决策时查询。
- 不重写归档正文来反映新实现；新结论写入当前权威文档或 `docs/OPEN_ITEMS.md`。
- 允许的修改仅限：补充归档状态说明、修正失效链接、移动文件位置。
- 归档文档中出现的路径、命令、版本号和测试结果均保留当时状态，可能已过期。

## 归档清单

| 文档 | 原位置 | 内容 | 当前替代入口 |
| --- | --- | --- | --- |
| [FlowerBuddy 文档体系初始化任务提示词.md](FlowerBuddy%20文档体系初始化任务提示词.md) | 仓库根目录 | 一次性的文档治理任务提示词，任务已完成 | [AGENTS.md](../../AGENTS.md)、[docs/README.md](../README.md) |
| [FlowerBuddy 架构与性能优化审计报告.md](FlowerBuddy%20架构与性能优化审计报告.md) | 仓库根目录 | 阶段 A–F 之前的静态审计与优化建议，建议已落实 | [docs/architecture/overview.md](../architecture/overview.md)、[docs/OPEN_ITEMS.md](../OPEN_ITEMS.md)、`docs/performance-*.md` |
| [Windows_桌宠个人助手_技术开发文档.md](Windows_桌宠个人助手_技术开发文档.md) | 仓库根目录 | 最初的完整产品/技术规划与阶段任务，阶段 0–6 已完成 | [docs/architecture/overview.md](../architecture/overview.md)、[README.md](../../README.md) |

## 不在此目录的材料

- `docs/performance-*.md`、`docs/refactor-*.md`、`docs/regression-report.md`：当前仍作为可追溯的执行记录保留在 `docs/`，不随本次归档移动。
- `docs/screenshots/`：视觉回归基线，继续供 UI 改动和视觉测试使用。
