# park-web

现代、极简、温暖、高级的停车场异常车辆管理后台。奶油底、桃色光晕、深棕墨色、大面积留白。

技术栈：Vue 3.5（`<script setup lang="ts">`）+ Vite 8 + Tailwind CSS 4 + Pinia 4 + TypeScript 6；部署在 Cloudflare Workers（静态资源 + `/api` 路由），数据存 Cloudflare D1（SQLite）。

> 完整项目规范（视觉语言、token、动画、组件约定、注意事项）见 **[AGENTS.md](./AGENTS.md)**，改代码前先读。

## 架构

- 单一 Worker：`worker/` 提供 `/api/*` 路由（全参数化 SQL，仅 `status` / `remark` 可写），其余回落 `dist/` 静态资源（SPA 回退）。
- 数据：上游检测工具自动写入 D1 `anomalies` 表（`dedup_key` 幂等去重，只读）；本项目人工维护 `status`（0 未处理 / 1 已处理 / 2 误报）与 `remark`。
- 前端读请求走 SWR 缓存（聚合 60s / 列表 15s，写后全量失效）；列表分页 ≤50，不做轮询。

## 快速开始

要求 Node `^22.18.0 || >=24.12.0`，包管理 npm。

```sh
npm install        # 安装依赖
npm run seed       # 种子 CSV → 本地 Miniflare D1（scripts/seed-data/*.csv，不入库）
npm run dev:api    # 启动 wrangler dev（本地 D1，端口 8787）
npm run dev        # 启动 vite dev（/api 代理到 8787），视觉标本在 /style-guide
npm run deploy     # vite 构建 + wrangler deploy（部署线上）
```

数据库迁移（建表 / 索引，均幂等）：

```sh
npx wrangler d1 migrations apply <库名> --local    # 本地
npx wrangler d1 migrations apply <库名> --remote   # 远端（生产）
```

换绑 D1：改 `wrangler.jsonc` 的 `database_name` / `database_id` 后重新部署即可，代码无需改动（绑定名 `DB` 不变）。

## 目录结构

```
worker/            # Worker 入口与 /api 路由（records / plates / overview / plate-groups）
migrations/        # D1 迁移（anomalies 建表 + 索引，幂等）
scripts/           # seed-local.mjs（CSV → 本地 D1 种子）
src/
  api/             # client.ts（fetch 封装）+ cache.ts（SWR 读缓存）
  assets/main.css  # 视觉 token 真源（@theme + @utility + @layer components 动效）
  theme/tokens.ts  # 标本页色板/圆角/阴影数据，hex 与 main.css 同步
  components/      # AppAtmosphere / AppShell / AppSidebar / BlacklistQuickRemove + ui/
  data/types.ts    # 领域类型（Worker 与前端共用）
  views/           # StyleGuide（视觉标本）+ Overview / Details / Approval / Settings
  stores/park.ts   # 业务 store（SWR 读写 + 审批待提交队列 + 阈值 localStorage）
  router/index.ts
```

## 约定

- 界面文案用简体中文；代码标识、token 名、路由 name 用英文。
- 视觉 token、动效曲线、组件规范、禁止事项等一律以 `AGENTS.md` 为准。
- 新增页面：`src/views/` + 在 `router/index.ts` 注册。
- 新增可复用 UI：`src/components/ui/`，从 `index.ts` 导出。
