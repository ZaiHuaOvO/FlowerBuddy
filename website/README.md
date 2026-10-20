# 花伴官网

独立的 VitePress 站点，不参与 Electron 打包。

## 本地运行

```bash
cd website
npm install
npm run dev
```

VitePress 使用 `base: '/flowerbuddy/'`，本地预览地址通常为 `http://localhost:5173/flowerbuddy/`。

## 构建

```bash
cd website
npm run build
```

产物位于 `website/docs/.vitepress/dist`。

## 部署目标

生产访问地址固定为：

```text
https://tool.flowersink.com/flowerbuddy/
```

服务器需要把 `/flowerbuddy/*` 映射到站点产物根目录：

- 直接把 `dist` 部署到 `/flowerbuddy/` 路径；或
- 反向代理 `/flowerbuddy/*` 到 GitHub Pages 产物根路径，并在转发时去掉 `/flowerbuddy` 前缀。

`base` 已固定为 `/flowerbuddy/`，不要改用 `/` 或 `/FlowerBuddy/` 构建生产版本，否则静态资源路径会不一致。

## GitHub Actions

`.github/workflows/website.yml` 在 `website/**` 变化或手动触发时构建。部署到 GitHub Pages 需要：

1. 在仓库 Settings → Pages 中选择 GitHub Actions。
2. 配置服务器反向代理与域名。
3. 设置仓库变量 `WEBSITE_DEPLOY_ENABLED=true` 后再启用部署 job。

未设置该变量时只构建、不部署，避免 Pages 尚未配置时产生失败。

## 内容边界

- README 负责项目简介与开发者入口。
- 官网承载长篇用户文档、FAQ、隐私与已知限制。
- 下载版本与校验文件以 GitHub Releases 为准，不在官网复制版本资产。
