# 阶段 C：外部 SDK 延迟加载结果

> 完成日期：2026-10-17
> 对比基线：[docs/performance-baseline.md](performance-baseline.md)（代码版本 `a782e0a`）
> 阶段 B 结果：[docs/performance-phase-b.md](performance-phase-b.md)
> 测量环境：与基线相同的 Windows 11、Ryzen 7 8845H、Node 22.22.2、Electron 44.8.0

## 1. 实施内容

- `gmail-service.ts` 不再在模块顶层导入 `google-auth-library` 与 `googleapis`，改为 `loadAuthLibrary()` / `loadGoogleApis()` 单例 Promise 缓存，只在真正轮询 Gmail 时加载。
- `gmail-auth.ts` 在 OAuth 授权与令牌撤销函数内部动态导入 Google SDK，输入校验失败时不会触发 SDK 加载。
- `esa-service.ts` 将 `@alicloud/esa20240910`、`@alicloud/openapi-core`、`@darabonba/typescript` 移入 `loadEsaSdk()`，只有执行 ESA 查询时才加载；失败时清空缓存以允许下次重试。
- 保留 `GmailClientFactory`、`EsaClientFactory` 注入方式，现有单元测试与依赖注入模式不变。
- 未修改 IPC 契约、业务结果、错误映射或任何用户可见功能。
- 没有替换 `googleapis` 依赖；`@googleapis/gmail` 仅做了独立评估，见第 6 节。

## 2. 主进程 bundle 与包体

| 对象                   |          基线 |        阶段 C |                   变化 |
| ---------------------- | ------------: | ------------: | ---------------------: |
| `out/main/index.js`    |   1,492,998 B |     147,480 B | -1,345,518 B（-90.1%） |
| `out/preload/index.js` |       8,240 B |       8,240 B |                   不变 |
| `app.asar`             | 102,273,225 B | 102,278,967 B |               +5,742 B |
| NSIS Setup             | 116,827,782 B | 116,825,090 B |               -2,692 B |
| Portable               | 116,606,566 B | 116,603,877 B |               -2,689 B |
| ZIP                    | 116,627,911 B | 116,625,340 B |               -2,571 B |

构建产物检查确认主进程 bundle 顶部不再有 `require("googleapis")`、`require("google-auth-library")` 或 `require("@alicloud/esa20240910")`；相应代码只以函数内 `await import(...)` 的形式出现。

安装包体积基本不变（差异在个位千字节），再次确认：动态导入改善的是启动加载时机，不是分发体积；`googleapis` 与阿里云 SDK 仍被打进 `app.asar`。

## 3. 启动与内存

### 3.1 启动

| 指标                         |    基线 |  阶段 B | 阶段 C |          相对基线 |
| ---------------------------- | ------: | ------: | -----: | ----------------: |
| 冷启动窗口可见（中位数）     | 1600 ms | 1491 ms | 694 ms | -906 ms（-56.6%） |
| 热启动窗口可见（中位数）     | 1565 ms | 1343 ms | 673 ms | -892 ms（-57.0%） |
| 冷启动宠物内容挂载（中位数） | 1182 ms | 1204 ms | 477 ms | -705 ms（-59.6%） |

三次冷启动宠物挂载分别为 477 / 503 / 458 ms，三次冷启动窗口可见分别为 673 / 694 / 730 ms。启动收益来自取消主进程启动期的三个重型 SDK 加载，而不是 renderer 改动。

### 3.2 内存

| 状态         | 基线工作集 / 私有内存 | 阶段 C 工作集 / 私有内存 |
| ------------ | --------------------: | -----------------------: |
| 启动后稳定   |      523.5 / 346.2 MB |         365.0 / 194.5 MB |
| 打开快捷菜单 |      632.3 / 385.7 MB |         473.0 / 238.1 MB |
| 再打开设置页 |      696.0 / 391.8 MB |         590.4 / 299.5 MB |
| 再打开气泡   |      811.2 / 434.3 MB |         693.1 / 336.5 MB |

启动后各进程工作集对比：

| 进程          |     基线 |   阶段 C |
| ------------- | -------: | -------: |
| 主进程        | 286.3 MB | 138.0 MB |
| GPU           | 100.5 MB |  94.6 MB |
| utility       |  54.6 MB |  50.2 MB |
| 宠物 renderer |  78.6 MB |  75.4 MB |

主进程工作集约下降 148 MB（-51.8%），与取消启动期 SDK 加载一致；GPU 与 renderer 基本不变。

## 4. 功能验证

- 184 项单元测试全部通过，包含 Gmail 轮询、ESA 请求构造与错误映射。
- 四个窗口在生产 `win-unpacked` 构建中均正常打开，根节点与样式探针正常。
- ESA 生产路径冒烟：在打包应用中通过设置窗口保存测试凭据并调用 `fetchEsaTraffic()`，SDK 动态导入成功并真实发起请求，682 ms 后返回 `AUTH_REQUIRED`（“ESA AccessKey 无效或签名失败”），说明 `@alicloud/esa20240910`、`@alicloud/openapi-core`、`@darabonba/typescript` 的按需加载路径可用。
- Electron 运行时动态导入检查：使用 `ELECTRON_RUN_AS_NODE` 分别加载 `googleapis`、`google-auth-library`、`@alicloud/esa20240910`、`@alicloud/openapi-core`、`@darabonba/typescript`，全部成功（约 1.3s，冷加载）。
- Gmail OAuth 端到端未执行：没有可用的 Google Cloud OAuth 客户端，与阶段 A 的已知限制相同；本次只能验证单元测试和模块加载方式。

## 5. 构建与检查

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test`：24 个测试文件、184 项测试通过。
- `npm run build`：通过，耗时 17s；主进程 1.49 MB → 147 KB。
- 完整 Windows 打包（licenses + electron-builder + zip）：59s，输出到 `release-phasec/`。
- `npm run format:check`：仍仅因未跟踪的审计报告 Markdown 失败。

## 6. `@googleapis/gmail` 独立评估

仅做评估，未修改依赖：

| 项目         | 结果                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| 版本         | 22.0.2                                                                                  |
| 许可证       | Apache-2.0                                                                              |
| 包体         | 1,178,476 B 解包，15 个文件                                                             |
| 依赖         | `googleapis-common ^9.0.0`，与当前 `googleapis@186.0.0` 使用的是同一大版本              |
| 导出         | 提供 `gmail({ version: 'v1', auth })`                                                   |
| API 形态     | 返回客户端包含当前使用的 `users.getProfile`、`users.history.list`、`users.messages.get` |
| 临时安装目录 | 约 15 MB（含共享依赖）                                                                  |

替换 `googleapis` 有潜力显著减小 `app.asar`（当前打包内 `googleapis` 约 55 MB），但需要单独分支完成：替换依赖、锁定文件更新、类型检查、Gmail 单元测试、真实 OAuth 冒烟测试、许可证清单与 Windows 打包体积对比。本次没有直接替换。

## 7. 结论与限制

- 阶段 C 的核心目标已达成：关闭/未配置 Gmail、ESA 时，主进程不再加载对应 SDK；启动内容挂载提升约 59.6%，主进程内存下降约 52%。
- 动态导入没有减小安装包，分发体积优化需要另做依赖替换评估。
- Gmail 真实 OAuth 与通知流程仍未验证，需要用户提供 OAuth 客户端后单独执行。
- 未在安装版/便携版中逐窗口点击验收；本次验证针对 `win-unpacked` 生产构建。
- 后续如采用 `@googleapis/gmail`，应以独立提交完成并重新对比启动、包体与测试结果。
