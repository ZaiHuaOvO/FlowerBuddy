# Windows 发布流程

> 状态：**操作规范**。适用于维护者发布 Windows 安装版、便携版与 ZIP。
> 版本号由维护者决定；工作流不会自动修改 `package.json`，也不会自动创建版本提交。

## 1. 触发方式

发布由推送 `v*` 标签触发，例如 `v0.1.1`。`.github/workflows/release.yml` 会：

1. 校验标签版本与 `package.json` 的 `version` 完全一致；
2. 运行 `typecheck`、`lint`、`format:check`、单元测试与 `dist:win`；
3. 生成 `release/SHA256SUMS.txt`；
4. 创建或更新**草稿** GitHub Release，附上 Setup、Portable、ZIP 与校验文件；
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
2. 检查 Setup、Portable、ZIP 和 `SHA256SUMS.txt` 是否齐全；
3. 在自动生成的提交列表上方补充本次更新的摘要、升级注意事项和已知问题；
4. 确认版本号、标题和附件无误后点击 Publish release。

自动生成的 notes 来自上次发布以来的提交；如果这是第一个标签，会包含全部历史提交，建议手动整理。

## 5. 失败处理

- **检查或构建失败**：根据 Actions 日志修复问题。若只是临时网络/ runner 故障，可在同一标签上重新运行工作流；工作流会覆盖草稿中的同名附件。
- **版本号需要修改**：先删除草稿 Release 和远程标签，修正版本后重新执行 `npm version` 和推送；不要改写已发布的标签。
- **需要补发资产**：在草稿 Release 页面重新上传，或重新运行该标签的 Release 工作流。

## 6. 产物与限制

- 安装版：`FlowerBuddy-Setup-<version>-x64.exe`
- 便携版：`FlowerBuddy-Portable-<version>-x64.exe`
- 压缩包：`FlowerBuddy-<version>-x64.zip`
- 校验文件：`SHA256SUMS.txt`

安装包未做代码签名，Windows SmartScreen 可能提示“未知发布者”。安装版通过 GitHub Releases 的 `latest.yml` 与 blockmap 支持应用内更新；便携版保持手动下载。`latest.yml` 与 blockmap 随 Release 上传，但不作为用户下载项。真实签名的 Windows 安装包完成至少两个版本升级验证前，自动更新仍属待验证。GitHub Actions 的临时 Artifact 默认只保留 14 天，不能替代 Release 附件。electron-builder 使用 `--publish never`，Release 附件由 `gh release create` 单独上传，避免标签构建时触发隐式发布。
