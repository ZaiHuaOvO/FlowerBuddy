# 完整功能与视觉回归报告

> 执行日期：2026-10-17
> 测试对象：架构优化阶段 A–F 完成后的 Windows 生产构建
> 构建产物：`npm run dist:win` 的 `release/win-unpacked`、Portable 与 Setup
> 结论：功能矩阵 18/18、补充行为 3/3、视觉矩阵 12/12 通过；回归过程中发现并修复了 1 个菜单对齐视觉回归。

## 1. 测试方法

- 使用隔离的 `--user-data-dir`，不读写用户真实配置。
- 功能测试通过 CDP 调用 preload 暴露的真实 IPC API，并在设置页执行真实 DOM 点击与输入。
- 网站检测使用本机临时 HTTP 服务提供的 200/500 端点，不依赖外网。
- 视觉回归使用固定 fixture（相同配置与日期数据），分别启动阶段 A 旧构建与最终构建，按相同窗口尺寸、200% 缩放截取整页 PNG，再做逐像素对比。
- 对比阈值：单通道差值 > 8 计为变化像素；同时记录平均差与最大差。

## 2. 功能回归结果（18/18）

| 场景                 | 结果                                                         |
| -------------------- | ------------------------------------------------------------ |
| 桌宠渲染             | 通过，图片 512×367 加载完成                                  |
| renderer 安全边界    | 通过，`window.require`/`window.process` 均为 undefined       |
| 快捷菜单动作列表     | 通过，包含 `dates:upcoming` 与 `website-check:run-all`       |
| 日期动作气泡         | 通过，显示“测试生日 · 还有 8 天”                             |
| 未知动作错误气泡     | 通过，状态为 `error`                                         |
| 设置窗口 CSP         | 通过，生产 CSP 为 `default-src 'none'`、`script-src 'self'`  |
| 常规设置读写         | 通过，保存后恢复原值                                         |
| 模块启用/停用        | 通过，5 个模块状态往返正确                                   |
| 日期 CRUD            | 通过，新增、修改、停用、删除均正确                           |
| 网站 CRUD 与检测     | 通过，本地 200 返回 `ok`、500 返回失败；修改、停用、删除正常 |
| Gmail 空客户端校验   | 通过，界面提示填写 Client ID/Secret                          |
| Gmail 假客户端状态   | 通过，`clientConfigured=true`；检查返回 `NOT_CONFIGURED`     |
| DeepSeek 空 Key 校验 | 通过，提示“请输入 DeepSeek API Key”                          |
| ESA 空凭据校验       | 通过，提示填写 AccessKey 与 SiteId                           |
| ESA 假凭据错误映射   | 通过，返回 `AUTH_REQUIRED`（AccessKey 无效）                 |
| 外观缩放与重置位置   | 通过，缩放保存为 1.2 后恢复为 1，位置重置成功                |
| 重启持久化           | 通过，`bounceAnimation=false` 与测试日期在重启后仍存在       |
| 密钥与日志脱敏       | 通过，加密 Secrets、config.json 与 app.log 均不含假凭据明文  |

补充行为：

| 场景         | 结果                                             |
| ------------ | ------------------------------------------------ |
| 气泡自动隐藏 | 通过，3 秒后页面可见性由 `visible` 变为 `hidden` |
| 单实例       | 通过，第二个实例退出码 0，第一个实例打开设置窗口 |
| 便携版启动   | 通过，Portable 解压后成功加载 pet renderer       |

## 3. 视觉回归结果

截图覆盖 12 个界面：pet、menu、bubble-success、bubble-error、settings-general、settings-modules、settings-dates、settings-websites、settings-gmail、settings-deepseek、settings-esa、settings-appearance。

### 3.1 发现的问题

首次对比发现快捷菜单存在真实视觉回归：

| 文件       | 变化像素 |  占比 | 平均差 | 最大差 |
| ---------- | -------: | ----: | -----: | -----: |
| `menu.png` |   18,033 | 7.03% | 10.305 |    232 |

原因是阶段 B 把 `menu.css` 移入视图组件后，公共 `components.css` 在打包结果中排到了 `menu.css` 之后；两者选择器优先级相同，`.fl-button` 的 `justify-content: center` 覆盖了 `.menu-item` 的 `flex-start`，菜单文字从左侧对齐变成居中。

修复方式：将 `.menu-item` 提升为 `.menu-panel .menu-item`，使菜单对齐不再依赖样式加载顺序。

### 3.2 修复后对比

修复后重新构建并截图，12 张界面与阶段 A 基线全部逐像素一致：

| 文件                                          | 变化像素 |
| --------------------------------------------- | -------: |
| pet / menu / bubble-success / bubble-error    |        0 |
| settings-general / modules / dates / websites |        0 |
| settings-gmail / deepseek / esa / appearance  |        0 |

最终 `npm run dist:win` 产物再次截图对比，12/12 仍为 0 变化像素。

## 4. 质量检查

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test`：27 个测试文件、199 项测试通过。
- `npm run build`：通过。
- `npm run dist:win`：通过，耗时 67 秒。
- `npm run format:check`：本地仍仅因未跟踪的审计报告 Markdown 失败；仓库内文件均符合格式。

## 5. 未覆盖范围

以下项目需要外部条件或人工操作，本次未自动化：

- 真实 Gmail OAuth 授权、新邮件轮询与系统通知。
- 真实 DeepSeek 余额与 ESA 流量数据（仅验证了空输入校验和错误映射）。
- 安装版 Setup 的交互式安装/卸载、开始菜单与桌面快捷方式。
- 系统托盘图标的像素级检查与托盘菜单点击。
- 原生文件选择对话框中的 PNG 导入流程。
- 桌宠拖动与多显示器物理验证（相关几何计算已有单元测试）。
- 视觉截图仅覆盖 Windows 本机 200% 缩放；未覆盖浅色/深色主题切换或不同 DPI。
- GitHub Actions 首次托管运行结果需在推送后由平台确认。

以上限制与实际完成项已同步到 `docs/OPEN_ITEMS.md`。
