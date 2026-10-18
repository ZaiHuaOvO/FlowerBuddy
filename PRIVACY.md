# 花伴 隐私说明

> 最后更新：2026-10-18

花伴 是一款本地桌面应用。应用没有账号体系、没有遥测，也不会上传用户数据用于分析或广告。

## 本地保存的数据

以下内容保存在 Electron 的 `userData` 目录（Windows 通常为 `%APPDATA%\FlowerBuddy`；显示名称为“花伴”，数据目录沿用旧名称以兼容升级）：

- `config.json`：普通设置、模块开关、桌面位置、非敏感配置（如 ESA SiteId、轮询间隔）。
- `secrets.enc.json`：使用 Electron `safeStorage`（Windows DPAPI）加密后的 API Key、AccessKey 等凭据。
- `data/memos.json`：备忘录文本、提醒时间、完成状态、锚点与卡片位置。
- `data/interval-reminders.json`：定时提醒的名称、间隔、生效时段、随机值和气泡文本。
- `memo-images/`：从剪贴板粘贴的备忘图片（统一转存为 PNG，仅保存在本机）。
- `data/website-checks.json`：网站检测配置与最近结果。
- `pets/`：你导入的角色图片。
- `logs/`：脱敏日志，按大小轮转并保留最近 7 天。

## 网络访问

应用只在相应模块已启用且已配置时访问外部服务：

- **DeepSeek**：`https://api.deepseek.com/user/balance`，用于查询余额。
- **阿里云 ESA**：通过官方 SDK 访问 `esa.cn-hangzhou.aliyuncs.com`，查询站点今日流量。
- **网站检测**：访问你自行添加的 URL，仅从本机网络发起。

## 密钥与日志

- 凭据只由主进程处理；渲染进程无法读取明文密钥。
- `config.json`、导出文件和日志都不会包含明文凭据。
- 日志会对 Authorization、API Key、AccessKey、token 等字段做脱敏。
- `safeStorage` 依赖 Windows DPAPI，能降低磁盘密文被其他 Windows 用户读取的风险，但不能防御已经在同一用户权限下运行的恶意程序。

## 删除数据

退出 花伴 后，删除 `%APPDATA%\FlowerBuddy` 目录即可清除全部本地配置、凭据、备忘录、备忘图片、角色图片与日志。卸载程序不会自动删除该目录。

## 第三方服务

DeepSeek 与阿里云的数据处理受各自服务条款与隐私政策约束。应用只会发送完成对应查询所必需的最小信息。

## 备忘录

- 备忘录文本、提醒时间、桌面卡片位置与粘贴图片只保存在本机 `userData` 目录。
- 粘贴图片不会上传到任何外部服务；删除备忘录时会同时删除其对应图片文件。
- 备忘录与定时提醒仅由本机定时器触发，通过桌宠气泡展示；不会访问任何外部服务。
