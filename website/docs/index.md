---
layout: home

hero:
  name: 花伴
  text: 桌面宠物与个人信息助手
  tagline: 常驻桌面的温柔陪伴，顺手记录备忘、提醒和常用信息。
  image:
    src: /app-icon.png
    alt: 花伴
  actions:
    - theme: brand
      text: 下载最新版
      link: https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest
    - theme: alt
      text: 阅读使用指南
      link: /guide/

features:
  - title: 桌面宠物
    details: 透明、无边框、始终置顶；可拖动、点击互动，右键打开快捷菜单。
  - title: 备忘录与提醒
    details: 文本、粘贴图片、中文自然语言提醒时间和桌面锚定卡片；卡片支持新建、锁定、完成和关闭。
  - title: DeepSeek 与 ESA
    details: 在本机查询 DeepSeek 余额和阿里云 ESA 流量；凭据只在主进程加密保存。
  - title: 网站检测
    details: 从本机检查 HTTP(S) 状态、耗时和错误类型，不读取响应正文。
  - title: 老板键
    details: 默认 Alt+Z 一键隐藏桌宠、气泡、设置窗口、桌面卡片和托盘图标。
  - title: 本地优先
    details: 无账号、无遥测；配置、备忘录、图片和日志保存在本机。
---

::: tip 当前公开版本
公开下载版为 **v0.2.0**。功能与界面以 [GitHub Release](https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest) 的说明为准。
:::

## 下载与安装

花伴提供安装版、便携版和 ZIP 三种形式，均从 [GitHub Releases](https://github.com/ZaiHuaOvO/FlowerBuddy/releases/latest) 下载：

| 形式                                     | 适合场景         | 说明                                                       |
| ---------------------------------------- | ---------------- | ---------------------------------------------------------- |
| `FlowerBuddy-Setup-<version>-x64.exe`    | 长期使用         | 按当前用户安装，可选择安装目录，创建开始菜单和桌面快捷方式 |
| `FlowerBuddy-Portable-<version>-x64.exe` | 试用或移动使用   | 双击运行，无需安装；更新时手动下载新版本                   |
| `FlowerBuddy-<version>-x64.zip`          | 需要手动管理文件 | 包含便携版、使用说明、项目许可证和第三方许可证             |

系统要求为 **Windows x64**。最终用户不需要安装 Node.js、打开终端或执行命令。

安装包未做代码签名，Windows SmartScreen 可能提示“未知发布者”；请只从官方 GitHub Releases 下载。安装与卸载都不会自动删除 `%APPDATA%\FlowerBuddy` 中的个人数据。

## 数据与隐私

- 应用没有账号体系，也没有遥测；不会上传用户数据用于分析或广告。
- 配置、备忘录、定时提醒、网站检测结果、粘贴图片、导入的桌宠图片和日志保存在本机。
- API Key、AccessKey 等凭据只在主进程中处理，并通过 Electron `safeStorage` 加密保存。
- 仅在相应模块启用并配置后访问外部服务：DeepSeek 余额接口、阿里云 ESA API，以及你自行添加的网站 URL。

完整说明见[隐私文档](/guide/privacy)和 [PRIVACY.md](https://github.com/ZaiHuaOvO/FlowerBuddy/blob/main/PRIVACY.md)。

## 常见问题

- **会自动更新吗？** v0.2.0 安装版支持从 GitHub Releases 检查、下载并确认重启安装更新；仍需真实 Windows 双版本验证。便携版手动下载。
- **数据放在哪里？** 默认在 `%APPDATA%\FlowerBuddy`；升级和卸载不会清空。
- **为什么提示未知发布者？** 当前安装包未做代码签名，这是预期行为。

更多问题见[常见问题](/guide/faq)，安装与升级细节见[安装与升级](/guide/install)。

## 反馈与参与

花伴目前由个人维护。问题反馈、功能建议和文档修正可以通过 [GitHub Issues](https://github.com/ZaiHuaOvO/FlowerBuddy/issues) 提交；源代码采用 MIT 许可证，美术素材保留所有权利，详见[仓库](https://github.com/ZaiHuaOvO/FlowerBuddy)。
