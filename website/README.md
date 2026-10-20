# 花伴官网

独立的 VitePress 站点，不参与 Electron 打包。

## 本地运行

```bash
cd website
npm install
npm run dev
```

VitePress 使用 `base: '/FlowerBuddy/'`，本地预览地址通常为 `http://localhost:5173/FlowerBuddy/`。

## 构建

```bash
cd website
npm run build
```

产物位于 `website/docs/.vitepress/dist`。

## 部署目标

GitHub Pages 项目站访问地址：

```text
https://zaihuaovo.github.io/FlowerBuddy/
```

部署方式：

1. 在仓库 Settings → Pages 中选择 **GitHub Actions**。
2. 设置仓库变量 `WEBSITE_DEPLOY_ENABLED=true`，或手动触发 `Website` 工作流。
3. 推送 `website/**` 变更后，[`.github/workflows/website.yml`](../.github/workflows/website.yml) 会构建并部署站点。

`base` 已固定为 `/FlowerBuddy/`，与仓库名大小写一致；不要改成 `/`，否则项目 Pages 路径下的静态资源和内部链接会 404。若以后改用自定义域名根路径或服务器子目录，需要同时调整 `base`、favicon 路径与部署方式。

## 内容边界

- README 负责项目简介与开发者入口。
- 官网承载长篇用户文档、FAQ、隐私与已知限制。
- 下载版本与校验文件以 GitHub Releases 为准，不在官网复制版本资产。
