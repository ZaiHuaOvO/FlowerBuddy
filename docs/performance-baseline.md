# FlowerBuddy 性能与构建基线

> 采集日期：2026-10-17
> 代码版本：`a782e0acf301b8fd5f0854cfe6c6292232b15a74`（`feat: add Gmail notifications and finalize Windows release`）
> 阶段：架构与性能优化阶段 A（只建立基线，未修改业务代码）

本文件记录优化前的真实测量结果。后续每个优化阶段都应在相同机器和相同方法下重新采集，并与本表逐项比较；无法复测的项目必须标注原因。

## 1. 环境

| 项目          | 值                                        |
| ------------- | ----------------------------------------- |
| 操作系统      | Windows 11 家庭中文版 10.0.26200          |
| CPU           | AMD Ryzen 7 8845H（8 核 / 16 逻辑处理器） |
| 内存          | 27.8 GB                                   |
| Node.js       | v22.22.2                                  |
| npm           | 12.0.2                                    |
| Electron      | 44.8.0                                    |
| electron-vite | 5.0.0                                     |
| Vite          | 7.3.7                                     |
| 应用版本      | 0.1.0                                     |

## 2. 依赖安装与质量命令

逐条执行，互不合并；耗时取整到秒。

| 命令                                   | 退出码 | 耗时 | 结果                                                                                            |
| -------------------------------------- | ------ | ---- | ----------------------------------------------------------------------------------------------- |
| `npm ci`                               | 0      | 21s  | 安装 523 个包；4 个包的安装脚本被 npm 12 的 allowScripts 策略拦截                               |
| `npm run typecheck`                    | 0      | 11s  | 通过（node + web）                                                                              |
| `npm run lint`                         | 0      | 4s   | 通过                                                                                            |
| `npm run format:check`                 | 1      | 2s   | 失败，仅因新增的 `FlowerBuddy 架构与性能优化审计报告.md` 未按 Prettier 格式化，属于既有文档问题 |
| `npm test`                             | 0      | 6s   | 24 个测试文件、184 个测试全部通过（Vitest 报告 4.44s）                                          |
| `npm run build`                        | 0      | 15s  | 通过，含一次 typecheck                                                                          |
| `npm run dist:win`                     | 1      | 18s  | 失败：`electronDist` 指向的 `node_modules/electron/dist` 不存在                                 |
| `npm run dist:win`（补装 Electron 后） | 1      | 18s  | 失败：`release\win-unpacked\resources\app.asar` 被外部句柄锁定（`EBUSY`）                       |

重复执行 `npm run build`（输出已存在）耗时 18s，与首次 15s 接近。

### 2.1 环境限制说明

- `npm ci` 成功，但 npm 12 默认拦截了 `electron` 等包的安装脚本，导致 Electron 运行时目录未生成。手动执行 `node node_modules/electron/install.js`（2s，命中本地缓存）后恢复。后续在干净环境复现基线时必须先补这一步，或显式批准对应安装脚本。
- `release\win-unpacked` 中旧的 `app.asar` / `default_app.asar` 在本次采集期间始终被一个外部进程（无对应 FlowerBuddy/Electron/node 进程可见，疑似系统索引或安全软件扫描）锁定，移动和删除均失败。因此完整打包改用等价命令输出到独立目录 `release-baseline/`，未覆盖被锁目录。
- 等价打包流程首次实测总耗时 **67s**：`npm run build` → `npm run licenses` → `electron-builder --win --x64 --config.directories.output=release-baseline` → `node scripts/make-portable-zip.mjs release-baseline`，四步退出码均为 0。
- 同流程重复执行一次总耗时 **79s**，产物字节数与首次基本一致（差异在个位数字节内）。重复打包没有变快，说明当前耗时不主要来自首次下载或缓存缺失。

## 3. 构建产物与分发体积

### 3.1 `out/` 产物（生产构建）

| 文件                                     |    字节数 | 说明                                                                                                        |
| ---------------------------------------- | --------: | ----------------------------------------------------------------------------------------------------------- |
| `out/main/index.js`                      | 1,492,998 | 主进程 bundle，仍通过 `require()` 在启动时加载 `@alicloud/esa20240910`、`google-auth-library`、`googleapis` |
| `out/preload/index.js`                   |     8,240 | preload 桥接                                                                                                |
| `out/renderer/index.html`                |       665 | 四个视图共用同一个入口                                                                                      |
| `out/renderer/assets/index-Bi0oG7Zj.css` |    15,850 | 全部视图样式合并为单个 CSS                                                                                  |
| `out/renderer/assets/index-QEcm0N5i.js`  |   256,621 | 全部视图代码合并为单个 JS chunk                                                                             |

基线事实：renderer 只有 1 个 JS chunk 和 1 个 CSS 文件，`?view=pet/menu/bubble/settings` 仅决定运行时渲染哪个组件，没有形成按视图的加载边界。

### 3.2 安装包与解包体积

| 对象                                 |      字节数 | 备注                           |
| ------------------------------------ | ----------: | ------------------------------ |
| `FlowerBuddy-Setup-0.1.0-x64.exe`    | 116,827,782 | NSIS 安装版                    |
| `FlowerBuddy-Portable-0.1.0-x64.exe` | 116,606,566 | 便携版                         |
| `FlowerBuddy-0.1.0-x64.zip`          | 116,627,911 | 便携版 + README + 许可证       |
| `release-baseline/win-unpacked/`     |   约 467 MB | 解包目录（含 Electron 运行时） |
| `resources/app.asar`                 | 102,273,225 | 应用代码与生产依赖             |
| `node_modules/electron/dist/`        |   约 369 MB | Electron 运行时（本地缓存）    |

### 3.3 `app.asar` 内依赖构成

将 `app.asar` 解包到临时目录后按目录统计（表观大小）：

| 目录                 |              解包后大小 | 备注                                                            |
| -------------------- | ----------------------: | --------------------------------------------------------------- |
| `node_modules/` 合计 |               约 111 MB |                                                                 |
| `googleapis`         | 约 55 MB（1288 个文件） | 安装目录本身约 235 MB，打包时被 electron-builder 过滤掉部分文件 |
| `@alicloud`          | 约 10 MB（3192 个文件） | ESA SDK 及传递依赖                                              |
| `zod`                |                  7.1 MB |                                                                 |
| `react-dom`          |                  7.8 MB |                                                                 |
| `react`              |                  235 KB |                                                                 |
| `out/`               |                  1.8 MB | 编译产物                                                        |

`googleapis` 与阿里云 ESA SDK 合计占解包后 `node_modules` 的约 59%，是当前分发体积和主进程启动加载的首要候选热点。

## 4. 运行时测量

### 4.1 方法

- 使用 `release-baseline/win-unpacked/FlowerBuddy.exe`（生产构建）启动。
- 通过 `--user-data-dir=<独立目录>` 隔离用户数据；每次冷启动使用全新目录，避免污染真实配置。
- 基线配置关闭全部模块（`dates`、`websiteCheck`、`gmail`、`esa`、`deepseek` 均为 `enabled: false`）。
- 启动耗时定义为：`CreateProcess` 到该进程第一个可见顶层窗口（Win32 `EnumWindows` + `IsWindowVisible`）的时间；用外部 PowerShell 脚本轮询，间隔 20ms。
- 冷启动 = 每次全新用户数据目录；热启动 = 同一目录连续重启。各跑 3 次，取中位数。
- 启动计时运行不开启远程调试端口；交互测量运行开启 `--remote-debugging-port` 并通过 CDP 调用 `petApi.openMenu()`、`menuApi.openSettings()`、`menuApi.runAction('dates:upcoming')`。
- 内存与 CPU：按可执行文件路径汇总全部 Electron 子进程；CPU 为 10 秒采样窗口内的增量（1 核百分比与整机百分比）。
- 四种窗口（pet / menu / settings / bubble）均在 `win-unpacked` 生产构建中通过 CDP 成功打开，页面上下文可访问且 IPC 调用成功；气泡由日期模块动作触发。

### 4.2 启动耗时

| 场景                   | 第 1 次 | 第 2 次 | 第 3 次 |      中位数 |
| ---------------------- | ------: | ------: | ------: | ----------: |
| 冷启动（全新用户数据） | 1553 ms | 1600 ms | 1633 ms | **1600 ms** |
| 热启动（复用用户数据） | 1530 ms | 1565 ms | 1576 ms | **1565 ms** |

冷/热差距约 35ms，说明本机文件缓存对启动影响有限；主要耗时仍在进程初始化、主进程依赖加载和窗口创建。

### 4.3 运行中内存与空闲 CPU（模块全关）

| 状态                                     | 进程数 |   工作集 | 私有内存 | 空闲 CPU（1 核） | 整机 CPU |
| ---------------------------------------- | -----: | -------: | -------: | ---------------: | -------: |
| 启动后稳定（约 8s）                      |      4 | 523.5 MB | 346.2 MB |            0.00% |    0.00% |
| 打开快捷菜单                             |      5 | 632.3 MB | 385.7 MB |            0.00% |    0.00% |
| 再打开设置页                             |      6 | 696.0 MB | 391.8 MB |            0.00% |    0.00% |
| 再打开气泡（设置页仍打开、日期模块启用） |      7 | 811.2 MB | 434.3 MB |            0.00% |    0.00% |

启动后各进程工作集拆分为：主进程 286.3 MB、GPU 进程 100.5 MB、utility 进程 54.6 MB、宠物 renderer 78.6 MB。

- 每个新窗口会增加一个 renderer 进程：菜单约 +109 MB 工作集，设置约 +64 MB，气泡约 +117 MB。
- 10 秒空闲采样中 CPU 增量低于 0.005s，因此显示为 0.00%；这表示空闲时没有明显轮询开销，不代表启动阶段 CPU 为零（启动 CPU 本轮未测）。
- 所有模块关闭时的配置与仅启用日期/网站检测时的稳定内存基本一致（522.2 MB vs 523.5 MB），本阶段没有观察到这两个轻量模块带来显著常驻内存差异。

### 4.4 5 分钟稳态空闲

模块全关、未打开额外窗口，启动后 15s 与再等待 5 分钟各采样一次：

| 时间点            | 进程数 |   工作集 | 私有内存 | 空闲 CPU（1 核） | 整机 CPU |
| ----------------- | -----: | -------: | -------: | ---------------: | -------: |
| 启动后约 15s      |      4 | 520.0 MB | 342.5 MB |            0.00% |    0.00% |
| 稳定空闲 5 分钟后 |      4 | 454.8 MB | 274.1 MB |            0.00% |    0.00% |

5 分钟内工作集约下降 65 MB、私有内存约下降 68 MB，CPU 无持续占用，说明应把 Chromium/JS 引擎的 GC 与内存回收纳入对比；后续优化若只测启动后十几秒的内存，会把这类自然回落误判为优化收益。对比优化前后时应同时记录“启动后”和“5 分钟后”两个时间点。

## 5. 本阶段确认的代码级事实

以下结论来自源码与构建产物检查，不是性能推测：

1. `App.tsx` 静态导入四个视图，renderer 只有一个 JS chunk；`main.tsx` 一次性导入全部 CSS。
2. 主进程 bundle 顶部存在 `require("@alicloud/esa20240910")`、`require("google-auth-library")`、`require("googleapis")`，即使模块未启用，启动时也会执行这些包的模块初始化。
3. `app.asar` 为 102 MB，其中 `googleapis` 约 55 MB、`@alicloud` 约 10 MB（解包后）。
4. `SettingsApp.tsx` 与 `app-controller.ts` 的体积与职责集中问题仍然存在，本阶段未修改。
5. 仓库当前没有 `.github/workflows/`，CI 门禁尚未建立。

## 6. 未测量与限制

- Gmail / ESA 启用后的启动、内存、CPU 与网络开销：没有可用凭据，未启用，不做推测。
- 安装版与便携版 GUI 逐窗口点击验收：本阶段只对 `win-unpacked` 生产构建做了外部启动与 CDP 驱动测量，未在安装后的系统中逐一点击四个窗口。
- 启动阶段 CPU 峰值、GPU 显存、磁盘 I/O 未采集。
- `npm run dist:win` 因外部文件锁未能端到端跑通；等价命令产物已生成，但该锁需要在后续阶段重新确认。
- 冷启动受操作系统文件缓存影响，本方法只能保证“全新用户数据”，不能完全模拟开机后首次启动。

## 7. 后续对比规则

- 每次优化后复用本文件的表格和环境，记录同样的命令、同样的冷/热启动次数与同样的窗口打开顺序。
- renderer 代码分割后，除总体积外还要记录每个视图窗口实际加载的 JS/CSS 文件清单。
- SDK 延迟加载后，除启动时间外还要确认模块未启用时主进程不再顶层 `require` 对应 SDK。
- 没有改善或出现退步的改动必须如实记录；不以“生成了多个 chunk”作为性能改善的证据。

阶段 B（视图懒加载与 CSS 按需加载）的对比结果见 [performance-phase-b.md](performance-phase-b.md)。
