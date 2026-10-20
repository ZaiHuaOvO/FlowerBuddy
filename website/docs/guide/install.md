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

当前版本不提供应用内自动更新，需要手动下载新版本。后续版本的更新方式以实际 Release 说明为准。

## 卸载

通过 Windows“设置 → 应用”或开始菜单卸载。程序文件会被移除，但 `%APPDATA%\FlowerBuddy` 会保留。如需彻底清除个人数据，请在退出花伴后手动删除该目录。

## 未签名提示

安装包未做代码签名，Windows SmartScreen 可能显示“未知发布者”。请确认下载来源为官方 GitHub Releases；如果对来源有疑问，请勿运行安装包。
