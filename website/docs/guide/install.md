# 安装与升级

## 下载

从 [GitHub Releases](https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest) 下载：

- `FlowerBuddy-Setup-<version>-x64.exe`：安装版，按当前用户安装，可选择安装目录。
- `FlowerBuddy-Portable-<version>-x64.exe`：便携版，双击运行。
- `FlowerBuddy-<version>-x64.zip`：便携版 ZIP，包含使用说明和第三方许可证。

## 安装

运行安装版并按向导完成安装。安装程序会：

- 检测旧版本并尽量复用原安装目录；
- 创建开始菜单和桌面快捷方式；
- 不自动删除 `%APPDATA%\FlowerBuddy` 中的个人数据。

## 升级

下载新版本安装包后直接运行即可。安装程序会先处理旧版本，再覆盖安装；设置、凭据、备忘录、提醒、网站配置、导入的桌宠图片和日志会保留。

当前公开版 v0.1.0 需要手动下载新版本。v0.2.0 的安装版已在 `main` 上实现 GitHub Releases 源的应用内更新（关于页检查、下载并确认重启安装），但尚未发布，且仍需真实 Windows 双版本升级验证；便携版始终手动下载。

## 卸载

通过 Windows“设置 → 应用”或开始菜单卸载。程序文件会被移除，但 `%APPDATA%\FlowerBuddy` 会保留。如需彻底清除个人数据，请在退出花伴后手动删除该目录。

## 未签名提示

安装包未做代码签名，Windows SmartScreen 可能显示“未知发布者”。请确认下载来源为官方 GitHub Releases；如果对来源有疑问，请勿运行安装包。
