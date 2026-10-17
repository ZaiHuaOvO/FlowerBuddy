# 花伴 隐私说明

> 最后更新：2026-10-17

花伴 是一款本地桌面应用。应用没有账号体系、没有遥测，也不会上传用户数据用于分析或广告。

## 本地保存的数据

以下内容保存在 Electron 的 `userData` 目录（Windows 通常为 `%APPDATA%\FlowerBuddy`；显示名称为“花伴”，数据目录沿用旧名称以兼容升级）：

- `config.json`：普通设置、模块开关、桌面位置、非敏感配置（如 ESA SiteId、轮询间隔）。
- `secrets.enc.json`：使用 Electron `safeStorage`（Windows DPAPI）加密后的 API Key、AccessKey、OAuth 客户端与 refresh token。
- `data/dates.json`：日期事件。
- `data/website-checks.json`：网站检测配置与最近结果。
- `data/gmail-state.json`：已连接的邮箱、historyId、已通知消息 ID 等最小同步状态。
- `pets/`：你导入的角色图片。
- `logs/`：脱敏日志，按大小轮转并保留最近 7 天。

## 网络访问

应用只在相应模块已启用且已配置时访问外部服务：

- **DeepSeek**：`https://api.deepseek.com/user/balance`，用于查询余额。
- **阿里云 ESA**：通过官方 SDK 访问 `esa.cn-hangzhou.aliyuncs.com`，查询站点今日流量。
- **Gmail**：通过 Google OAuth 2.0 与 Gmail API 查询邮件元数据（发件人、主题、日期、消息 ID），不读取邮件正文。
- **网站检测**：访问你自行添加的 URL，仅从本机网络发起。

Gmail 授权页面在系统浏览器中打开；授权完成后通过 `127.0.0.1` 上的临时回环服务返回应用。应用不会把 OAuth 授权码或 token 展示给渲染进程。

## 密钥与日志

- 凭据只由主进程处理；渲染进程无法读取明文密钥。
- `config.json`、导出文件和日志都不会包含明文凭据。
- 日志会对 Authorization、API Key、AccessKey、token、邮件主题/正文等字段做脱敏。
- `safeStorage` 依赖 Windows DPAPI，能降低磁盘密文被其他 Windows 用户读取的风险，但不能防御已经在同一用户权限下运行的恶意程序。

## 删除数据

退出 花伴 后，删除 `%APPDATA%\FlowerBuddy` 目录即可清除全部本地配置、凭据、事件、角色图片与日志。卸载程序不会自动删除该目录。

## 第三方服务

DeepSeek、阿里云与 Google 的数据处理受各自服务条款与隐私政策约束。应用只会发送完成对应查询所必需的最小信息。
