# 花伴官网

独立的 VitePress 站点，不参与 Electron 打包。

## 本地运行

```bash
cd website
npm install
npm run dev
```

VitePress 使用 `base: '/FlowerBuddy/'`，本地预览地址通常为 `http://localhost:5173/FlowerBuddy/`。

## 构建与检查

```bash
cd website
npm run build
npm run check:links
```

产物位于 `website/docs/.vitepress/dist`。`check:links` 会扫描构建产物中的内部 `href`/`src`，按当前 `base` 检查对应文件是否存在；发现 404 风险时以非零状态退出。

如需验证另一个部署前缀，可显式传入 base：

```bash
node scripts/check-links.mjs --base=/flowerbuddy/
```

## 部署目标

### GitHub Pages

访问地址：

```text
https://zaihuaovo.github.io/FlowerBuddy/
```

部署方式：

1. 在仓库 Settings → Pages 中选择 **GitHub Actions**。
2. 设置仓库变量 `WEBSITE_DEPLOY_ENABLED=true`，或手动触发 `Website` 工作流。
3. 推送 `website/**` 变更后，[`.github/workflows/website.yml`](../.github/workflows/website.yml) 会构建并部署站点。

`base` 固定为 `/FlowerBuddy/`，与仓库名大小写一致；不要改成 `/`，否则项目 Pages 路径下的静态资源和内部链接会 404。

### 自定义域名 `tool.flowersink.com/flowerbuddy/`

自定义域名由服务器反向代理到 GitHub Pages。**仓库内无法替服务器补全路径**，需要在 Tengine/nginx 中同时转发两个前缀：

```nginx
# 小写路径映射到 Pages 项目根目录。
location /flowerbuddy/ {
    proxy_pass https://zaihuaovo.github.io/FlowerBuddy/;
    proxy_set_header Host zaihuaovo.github.io;
    proxy_ssl_server_name on;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 构建产物使用绝对 /FlowerBuddy/ 资源与导航地址；
# 浏览器会直接请求这些地址，因此服务器也必须转发。
location /FlowerBuddy/ {
    proxy_pass https://zaihuaovo.github.io/FlowerBuddy/;
    proxy_set_header Host zaihuaovo.github.io;
    proxy_ssl_server_name on;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

如果现有配置已经能打开 `https://tool.flowersink.com/flowerbuddy/` 但页面无样式、导航 404，通常就是缺少第二条 `/FlowerBuddy/` 转发。应用规则后验证：

```bash
curl -sI https://tool.flowersink.com/flowerbuddy/ | head -1
curl -sI https://tool.flowersink.com/FlowerBuddy/ | head -1
curl -sI https://tool.flowersink.com/FlowerBuddy/app-icon.png | head -1
curl -sI https://tool.flowersink.com/flowerbuddy/guide/ | head -1
```

四条都应为 `200`。由于构建使用绝对 `/FlowerBuddy/` 地址，点击内页后浏览器地址栏会显示大写路径；这是当前“单构建、双前缀代理”方案的已知表现。

若以后要求 `tool.flowersink.com/flowerbuddy/` 始终显示小写路径，需要在仓库外托管一份 `base: '/flowerbuddy/'` 的独立构建，并让服务器指向该产物；GitHub Pages 只能同时服务一个 base，不能在一份构建里同时满足两种前缀。该双构建方案尚未实现。

## 内容边界

- README 负责项目简介与开发者入口。
- 官网承载长篇用户文档、FAQ、隐私与已知限制。
- 下载版本与校验文件以 GitHub Releases 为准，不在官网复制版本资产。
- 发布新版本前，确保官网版本声明与 GitHub Release 一致；发布说明按 `docs/releases/vX.Y.Z.md` 维护。
