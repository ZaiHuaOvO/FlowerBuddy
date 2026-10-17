# 设置页拆分记录（阶段 D）

> 完成日期：2026-10-17
> 对应审计阶段：阶段 D（拆分 `SettingsApp.tsx`）
> 约束：不改变用户可见功能、文案、样式、IPC 契约与 API 数据格式。

## 1. 拆分结果

`src/renderer/src/settings/SettingsApp.tsx` 从 1,735 行减少到 440 行，只保留：

- 设置窗口的初始数据读取（配置、应用信息、模块、安全状态、启动提示、Gmail 状态、日期与网站列表）；
- 加载态与错误提示；
- 顶部标题、全局 banner、tab 导航与 footer；
- 创建并组合各 tab 的 hook。

新增结构：

```text
src/renderer/src/settings/
  SettingsApp.tsx          # 引导层 + 内容协调层
  types.ts                 # SettingsApi 类型
  tabs/                    # 8 个页面组件，只负责 JSX
    GeneralSettingsTab.tsx
    ModulesSettingsTab.tsx
    DatesSettingsTab.tsx
    WebsitesSettingsTab.tsx
    GmailSettingsTab.tsx
    DeepSeekSettingsTab.tsx
    EsaSettingsTab.tsx
    AppearanceSettingsTab.tsx
  hooks/                   # 页面私有状态与操作
    useDatesSettings.ts
    useWebsiteSettings.ts
    useGmailSettings.ts
    useDeepSeekSettings.ts
    useEsaSettings.ts
    useAppearanceSettings.ts
  utils/
    constants.ts           # tab、选项与分类常量
    formatters.ts          # 纯格式化与状态文案函数
    forms.ts               # 日期/网站表单初始值
```

共享状态仍由 `SettingsApp` 持有：配置、模块摘要、安全状态、启动提示、日期列表、网站列表、Gmail 状态、错误。页面私有状态（表单草稿、编辑 ID、删除确认、检测中状态、API Key 草稿、余额/流量结果、缩放草稿）移入对应 hook。

各 hook 在 `SettingsContent` 中始终调用，因此切换 tab 不会卸载状态；这与拆分前的行为一致，未提交的表单草稿会保留。

## 2. 行为验证

在拆分前（`release-phasec`）与拆分后（`release-phased`）的生产 `win-unpacked` 构建上执行同一套 CDP 冒烟脚本，结果完全一致：

- 8 个 tab 均可点击并渲染对应标题：常规、功能管理、日期事件、网站检测、Gmail 新邮件、DeepSeek 余额、ESA 今日流量、外观。
- 在日期页输入草稿，切换到常规再切回，草稿仍然保留。
- 通过日期表单新增事件，事件出现在列表中。
- 页面没有错误 banner。

拆分前后产物对比：

| 对象                 |        拆分前 |        拆分后 |               变化 |
| -------------------- | ------------: | ------------: | -----------------: |
| `SettingsApp` 源文件 |      1,735 行 |        440 行 |          -1,295 行 |
| SettingsApp chunk    |      30,039 B |      34,261 B | +4,222 B（+14.1%） |
| `app.asar`           | 102,278,967 B | 102,283,189 B |           +4,222 B |
| NSIS Setup           | 116,825,090 B | 116,825,979 B |             +889 B |
| Portable             | 116,603,877 B | 116,604,766 B |             +889 B |
| ZIP                  | 116,625,340 B | 116,626,180 B |             +840 B |

设置页 chunk 增加约 4 KB，主要来自组件边界与 props 转发；这是可维护性收益的代价，不是性能优化。

## 3. 新增测试

- `tests/unit/settings-formatters.test.ts`：覆盖错误消息归一化、模块状态、日期倒计时与状态、网站结果、字节/余额/时间格式化、邮箱脱敏。
- `tests/unit/settings-tabs.test.ts`：使用 `react-dom/server` 渲染 8 个 tab 的 smoke test，不需要 jsdom 或新增依赖。

测试数量从 184 增加到 193，26 个测试文件全部通过。

为了在 Node 测试项目中安全导入 renderer 的 TSX，做了两处类型边界调整：

- 将 `TagTone` 类型移到纯 `.ts` 文件 `components/tag-tone.ts`，避免 Node tsconfig 解析 TSX。
- 将 tab 渲染测试加入 renderer tsconfig，并从 Node tsconfig 排除该文件；运行时行为不受影响。

## 4. 限制

- 未引入 jsdom 或 React Testing Library；交互级验证通过生产构建 CDP 冒烟完成，未固化为仓库内自动化脚本。
- Gmail OAuth、DeepSeek/ESA 真实凭据流程仍需外部条件，未在本阶段执行。
- 未在安装版/便携版中逐 tab 点击验收。
