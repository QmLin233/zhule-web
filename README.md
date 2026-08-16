# 逐乐（zhule-web）

个人网站，基于 [React Router 7](https://reactrouter.com/)（framework 模式，SSR）+ [Cloudflare Workers](https://developers.cloudflare.com/workers/) + Tailwind CSS v4。

## 功能

- **首页**：逐乐
- **下载**（`/download`）：从 R2 桶 `zhule` 的 `download/` 前缀列出文件并提供下载直链（`https://cdn.zhule.org`）
- **图床**（`/image-host`）：从 R2 桶 `zhule` 的 `image/` 前缀列出图片，支持复制链接
- **IP 查询**（`/ip`）：显示本机 IP、属地、运营商、ASN、时区、经纬度、延迟
- **设置**（`/settings`）：语言切换（中文 / English）
- **游戏 / 更多**：开发中占位页

## 目录结构

```
app/
  components/        # 共享组件（NavMenu、PageLayout、HomeHero、PlaceholderPage）
  lib/               # 共享工具（r2 列表、格式化、meta、IP 类型）
  routes/            # 页面与 API 路由
  root.tsx           # 根布局 + ErrorBoundary
  routes.ts          # 路由注册
workers/app.ts       # Worker 入口（注入 request.cf 到 AppLoadContext）
```

## 常用命令

```bash
npm run dev          # 本地开发（端口 5173）
npm run build        # 构建
npm run deploy       # 构建 + 部署到 Cloudflare（用 build/server/wrangler.json）
npm run cf-typegen   # 重新生成 Worker 类型 + 路由类型
npm run typecheck    # 生成类型 + 类型检查
```

> 注意：部署必须用 `build/server/wrangler.json`（根目录 `wrangler.json` 引用虚拟模块）。

## R2 说明

- 桶名 `zhule`，Worker 绑定 `FILES`，公开访问域名 `https://cdn.zhule.org`。
- R2 是扁平结构，「创建文件夹」会产生 0 字节占位对象（key 以 `/` 结尾），`app/lib/r2.ts` 的 `listR2Objects` 已统一过滤，页面不会显示文件夹。
- 文件由站长通过 Cloudflare 控制台 / R2 客户端上传到 `download/` 或 `image/` 前缀即可自动出现在对应页面。