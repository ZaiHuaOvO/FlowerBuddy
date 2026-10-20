# 安全与已知限制

## 安全基线

- 所有应用窗口启用 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。
- preload 只暴露按窗口划分的窄 API；renderer 不直接访问 Node/Electron、文件系统或外部网络。
- 每个 IPC handler 校验发送方 URL 和 Zod 输入；错误只返回公开字段。
- 生产 renderer 使用严格 CSP；所有权限请求默认拒绝。
- API Key、AccessKey 只在主进程解密；普通配置、日志和 renderer 都不含明文。
- 桌宠图片和备忘录图片通过受限自定义协议提供，不能读取任意文件。

## 已知限制

- 安装包未签名，SmartScreen 可能提示未知发布者。
- v0.2.0 安装版计划仅通过 GitHub Releases 提供应用内更新；便携版手动下载，仍需真实 Windows 双版本升级验证。
- ESA 接入点固定为国内 `esa.cn-hangzhou.aliyuncs.com`。
- 备忘录和定时提醒通过桌宠气泡展示，不发送 Windows 系统通知。
- 不提供 macOS/Linux 版本、云端同步或通用插件加载。
- 多显示器、真实 DeepSeek/ESA 账户、干净 Windows 安装和不同 DPI 下的视觉表现仍需要实机验收。

完整清单见 [OPEN_ITEMS.md](https://github.com/ZaiHuaOvO/FlowerBuddy/blob/main/docs/OPEN_ITEMS.md)。
