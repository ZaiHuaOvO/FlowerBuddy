# 主进程控制器拆分记录（阶段 E）

> 完成日期：2026-10-17
> 对应审计阶段：阶段 E（拆分 `app-controller.ts`）
> 约束：不改变 IPC 输入/输出、启动顺序、窗口交互、气泡时序与用户可见行为。

## 1. 拆分结果

`src/main/app-controller.ts` 从 956 行减少到 490 行，保留为生命周期入口与跨层协调器。

新增职责类：

| 文件                                         | 行数 | 职责                                                                      |
| -------------------------------------------- | ---: | ------------------------------------------------------------------------- |
| `src/main/actions/module-action-runner.ts`   |  139 | 菜单动作执行、requestId 失效、45s 超时、气泡隐藏计时、后台邮件气泡        |
| `src/main/windows/overlay-window-manager.ts` |  153 | 菜单与气泡窗口的创建、加载、定位、显示/隐藏、失焦关闭、菜单重开保护       |
| `src/main/windows/pet-window-controller.ts`  |  338 | 桌宠窗口、PNG 资产、尺寸/缩放、位置、拖动、导入、状态推送、多显示器可见性 |

`AppController` 仍然负责：

- 应用启动顺序、托盘、屏幕事件、设置窗口；
- 配置与模块服务调用、日期/网站 CRUD、密钥与 Gmail 操作；
- Gmail 系统通知与后台气泡触发；
- 退出清理。

所有权现在明确：

- `PetWindowController` 独占 `petWindow`、资产、拖动偏移和宠物位置持久化。
- `OverlayWindowManager` 独占 `menuWindow`、`bubbleWindow`、菜单重开时间戳。
- `ModuleActionRunner` 独占当前请求 ID、安全超时和气泡隐藏计时器。
- `AppController` 不再直接维护上述窗口或计时器状态。

## 2. 行为验证

在 `release-phasee/win-unpacked` 生产构建上执行：

- 四个窗口全部正常打开：pet、menu、settings、bubble。
- 通过菜单执行日期动作，气泡首次动作即显示内容，第二次动作也正常。
- 设置页 8 个 tab 全部渲染；日期草稿切换 tab 后保留；新增日期事件成功；无错误 banner。
- 冷启动宠物内容挂载中位数 468 ms（阶段 C 为 477 ms），没有回归。
- 直接进程探测：启动后 4 个进程，主进程 138.7 MB、GPU 94.8 MB、utility 50.4 MB、renderer 75.6 MB，合计约 359 MB，与阶段 C 一致。

构建产物变化：

| 对象                |        阶段 D |        阶段 E |     变化 |
| ------------------- | ------------: | ------------: | -------: |
| `out/main/index.js` |     147,480 B |     149,481 B | +2,001 B |
| `app.asar`          | 102,283,189 B | 102,285,190 B | +2,001 B |
| NSIS Setup          | 116,825,979 B | 116,826,548 B |   +569 B |
| Portable            | 116,604,766 B | 116,605,336 B |   +570 B |
| ZIP                 | 116,626,180 B | 116,626,699 B |   +519 B |

`out/main` 的三个按需 SDK chunk 在阶段 C 已存在，本次未变化；它们只在第一次使用 ESA 时加载，不在启动路径。

## 3. 新增测试

`tests/unit/module-action-runner.test.ts` 使用 fake presenter 与 fake module manager，配合 Vitest fake timers 覆盖：

- loading → success → 到时隐藏；
- 动作抛错；
- 未知 action；
- 45s 超时并忽略迟到结果；
- 取消后忽略在途结果；
- 桌宠隐藏或已有请求时不显示后台气泡。

测试数量从 193 增加到 199，27 个测试文件全部通过。

## 4. 限制

- 没有引入 Electron 窗口 mock 测试；窗口创建、定位和多显示器行为仍通过生产构建冒烟验证。
- 拖动、缩放和 PNG 导入未做自动化交互验证；相关纯几何逻辑已有单元测试。
- Gmail 系统通知与真实 OAuth 流程仍需外部条件验证。
- 未在安装版/便携版中逐窗口验收。

阶段 F（I/O 决策、CI 与最终回归）的结果见 [performance-phase-f.md](performance-phase-f.md)。
