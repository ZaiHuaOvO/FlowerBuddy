# Windows 发布流程

> 状态：**操作规范**。适用于维护者发布 Windows 安装版、便携版与 ZIP。
> 版本号由维护者决定；工作流不会自动修改 `package.json`，也不会自动创建版本提交。

## 1. 触发方式

发布由推送 `v*` 标签触发，例如 `v0.1.1`。`.github/workflows/release.yml` 会：

1. 校验标签版本与 `package.json` 的 `version` 完全一致；
2. 运行 `typecheck`、`lint`、`format:check`、单元测试、生产构建与许可证生成，再构建 Windows 安装版、便携版和 ZIP；
3. 生成 `release/SHA256SUMS.txt`；
4. 创建或更新**草稿** GitHub Release：优先读取仓库内的 `docs/releases/v<version>.md` 作为中文 Release Notes，缺少该文件时回退到 GitHub 自动生成的提交列表；附上 Setup、Portable、ZIP、`latest.yml`、blockmap 与校验文件；
5. 由维护者在 GitHub 上审核 Release notes 和附件后手动发布。

工作流不会自动提交版本号，也不会自动发布 Release。`ci.yml` 仍负责 `main` 分支和 Pull Request 的日常检查。

## 2. 发布前准备

1. 确认 `main` 工作区干净且已同步远程：

   ```bash
   git status --short --branch
   git pull --ff-only
   ```

2. 确认当前 CI 检查通过，且没有未合并的发布阻断项。
3. 决定本次版本号（语义化版本，例如 `0.1.1`、`0.2.0`、`1.0.0`）。已经发布的版本号不要复用。
4. 从 [`docs/releases/TEMPLATE.md`](../releases/TEMPLATE.md) 复制并编写 `docs/releases/v<version>.md`，使用中文说明新增功能、问题修复、体验优化、安全或文档变更，并为每条改动标注提交短哈希；该文件会作为 GitHub Release 的正文。

## 3. 更新版本并打标签

使用 npm 同时更新 `package.json`、`package-lock.json`，创建发布提交和标签：

```bash
npm version 0.1.1 -m "chore: release %s"
```

`npm version` 会生成 `v0.1.1` 标签。随后推送提交和标签：

```bash
git push --follow-tags origin main
```

标签必须指向当前 `main`。如果推送后才发现版本号写错，且 Release 仍是草稿，可以删除标签和草稿后重新打标签；已经发布的标签不要移动或强制覆盖。

## 4. 审核并发布草稿 Release

标签推送后，在 GitHub Actions 的 `Release` 工作流中等待构建完成。成功后：

1. 打开仓库的 Draft Release；
2. 检查 Setup、Portable、ZIP、`latest.yml`、blockmap 和 `SHA256SUMS.txt` 是否齐全；缺少更新元数据时应用内更新无法工作。
3. 核对 Release 正文是否来自 `docs/releases/v<version>.md`，确认中文描述、提交 ID 和升级说明与实际代码一致；工作流只在文件缺失时回退到自动生成的提交列表。
4. 确认版本号、标题和附件无误后点击 Publish release。

### Release Notes 规范

- 文件名与标签严格一致：`v0.2.0` 对应 `docs/releases/v0.2.0.md`。
- 正文使用中文，至少包含“新增功能”“问题修复”“升级说明”三节；可按需增加“体验与界面优化”“安全与稳定性”“文档与发布”。
- 每条改动写成用户能理解的一句话，并在末尾标注对应的真实提交短哈希，例如（`abc1234`）。不要把提交标题原样罗列。
- 同一提交影响多个条目时可以复用该哈希；纯文档提交可以合并说明。
- 发布前对照 `git log v<上一个版本>..HEAD --oneline` 检查遗漏，确认没有把未实现的事项写进 Release。
- `docs/releases/v<version>.md` 与版本号提交一并推送，确保 Release 工作流能读取到最终正文。

## 5. 失败处理

- **检查或构建失败**：根据 Actions 日志修复问题。若只是临时网络/ runner 故障，可在同一标签上重新运行工作流；工作流会覆盖草稿中的同名附件。
- **版本号需要修改**：先删除草稿 Release 和远程标签，修正版本后重新执行 `npm version` 和推送；不要改写已发布的标签。
- **需要补发资产**：在草稿 Release 页面重新上传，或重新运行该标签的 Release 工作流。

## 6. 产物与限制

- 安装版：`FlowerBuddy-Setup-<version>-x64.exe`
- 便携版：`FlowerBuddy-Portable-<version>-x64.exe`
- 压缩包：`FlowerBuddy-<version>-x64.zip`
- 更新元数据：`latest.yml` 与安装版 `.blockmap`（供 electron-updater 使用，不作为用户下载项）
- 校验文件：`SHA256SUMS.txt`

已发布的 `v0.1.0` 附件没有 `latest.yml`/blockmap，且该版本没有应用内更新器，不能作为更新基线；从包含更新元数据的版本开始验证双版本升级。

安装包未做代码签名，Windows SmartScreen 可能提示“未知发布者”。安装版通过 GitHub Releases 的 `latest.yml` 与 blockmap 支持应用内更新；便携版保持手动下载。`latest.yml` 与 blockmap 随 Release 上传，但不作为用户下载项。真实 Windows 安装包完成至少两个版本升级验证前，自动更新仍属待验证。GitHub Actions 的临时 Artifact 默认只保留 14 天，不能替代 Release 附件。electron-builder 使用 `--publish never`，Release 附件由 `gh release create` 单独上传，避免标签构建时触发隐式发布。
