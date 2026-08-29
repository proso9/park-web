# park-web

现代、极简、温暖、高级的 SaaS 前端。奶油底、桃色光晕、深棕墨色、大面积留白。

技术栈：Vue 3.5（`<script setup lang="ts">`）+ Vite 8 + Tailwind CSS 4 + Pinia 4 + vue-router 5 + TypeScript 6。

> 完整项目规范（视觉语言、token、动画、组件约定、注意事项）见 **[AGENTS.md](./AGENTS.md)**，改代码前先读。

## 快速开始

要求 Node `^22.18.0 || >=24.12.0`，包管理 npm。

```sh
npm install     # 安装依赖
npm run dev     # 启动开发服务器，视觉标本在 /style-guide
npm run build   # vue-tsc 类型检查 + vite 构建
npm run type-check   # 仅类型检查
npm run lint    # oxlint + eslint 修复
npm run format  # oxfmt 格式化 src/
```

## 目录结构

```
src/
  assets/main.css   # 视觉 token 真源（@theme + @utility + @layer components 动效）
  theme/tokens.ts   # 标本页色板/圆角/阴影数据，hex 与 main.css 同步
  components/
    AppAtmosphere.vue / AppShell.vue / AppSidebar.vue   # 页面骨架
    ui/              # 可复用 UI（AppSurface、AppButton、AppSelect、AppDatePicker 等），经 index.ts 统一导出
  data/              # 领域类型 + 异常车辆 CSV 解析（Vite glob 动态加载）
  views/             # StyleGuide（视觉标本）+ Overview / Details / Approval / Settings
  stores/            # park.ts（审批状态 + 黑名单，localStorage 持久化）
  router/index.ts
```

## 约定

- 界面文案用简体中文；代码标识、token 名、路由 name 用英文。
- 视觉 token、动效曲线、组件规范、禁止事项等一律以 `AGENTS.md` 为准。
- 新增页面：`src/views/` + 在 `router/index.ts` 注册。
- 新增可复用 UI：`src/components/ui/`，从 `index.ts` 导出。

