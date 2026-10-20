# 隐私说明

花伴是一款本地桌面应用，没有账号体系、没有遥测，也不会上传用户数据用于分析或广告。

## 本地保存的数据

以下内容保存在 `%APPDATA%\FlowerBuddy`：

- `config.json`：普通设置、模块开关、桌面位置、非敏感配置。
- `secrets.enc.json`：使用 Electron `safeStorage`（Windows DPAPI）加密后的 API Key、AccessKey。
- `data/memos.json`：备忘录文本、提醒、完成状态、锚点、锁定与卡片位置。
- `data/interval-reminders.json`：定时提醒配置。
- `data/website-checks.json`：网站检测配置与最近结果。
- `memo-images/`：粘贴的备忘录图片。
- `pets/`：导入的桌宠图片。
- `logs/`：脱敏日志，按大小轮转并保留最近 7 天。

## 网络访问

应用只在相应模块已启用并配置时访问外部服务：

- DeepSeek：`https://api.deepseek.com/user/balance`，用于查询余额。
- 阿里云 ESA：通过官方 SDK 访问 `esa.cn-hangzhou.aliyuncs.com`，查询站点流量。
- 网站检测：访问你自行添加的 URL，仅从本机网络发起。

## 凭据与日志

- 凭据只由主进程处理，渲染进程无法读取明文。
- `config.json`、导出文件和日志都不会包含明文凭据。
- 日志会对 Authorization、API Key、AccessKey、token 等字段做脱敏。
- `safeStorage` 依赖 Windows DPAPI，能降低磁盘密文被其他 Windows 用户读取的风险，但不能防御已经在同一用户权限下运行的恶意程序。

## 删除数据

退出花伴后，删除 `%APPDATA%\FlowerBuddy` 即可清除全部本地配置、凭据、备忘录、图片和日志。卸载程序不会自动删除该目录。

完整说明以仓库中的 [PRIVACY.md](https://github.com/ZaiHuaOvO/FlowerBuddy/blob/main/PRIVACY.md) 为准。
