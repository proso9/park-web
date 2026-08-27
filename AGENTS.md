# park-web · Agent 指南

给后续 AI / 协作者的项目说明书。先读本文件，再改代码。

## 这是什么

Vue 3 + Vite + Tailwind CSS 4 的前端。当前阶段只有**视觉语言**（配色、字体层级、渐变、圆角、阴影、表面材质），没有业务页面、侧栏、卡片墙、图表。

氛围：现代、极简、温暖、高级的 SaaS。奶油底、桃色光晕、深棕墨色、大面积留白。

参考图在 `材料/design.png`（已列入 `.gitignore`，本地才有）。视觉方向以该图和 `src/assets/main.css` 为准，不要自行改成冷灰 / 纯黑 / 高饱和蓝。

## 技术栈

| 层 | 选型 | 注意 |
|---|---|---|
| 框架 | Vue 3.5 `<script setup lang="ts">` | 不要 Options API，不要 JSX |
| 路由 | vue-router 5 | `createWebHistory` |
| 状态 | Pinia 4 | 现成 `src/stores/counter.ts` 是模板残留，新 store 按需建 |
| 样式 | Tailwind CSS **4**（`@tailwindcss/vite`） | **没有** `tailwind.config.js`。token 写在 CSS `@theme` |
| 构建 | Vite 8 | 路径别名 `@` → `src/` |
| 语言 | TypeScript 6，`noUncheckedIndexedAccess` | 数组/对象取值按可能 `undefined` 处理 |
| 格式化 | oxfmt | 无分号、单引号（`.oxfmtrc.json`） |
| Lint | oxlint + eslint（含 `vue/multi-word-component-names`） | 组件文件名必须多词 |

Node：`^22.18.0 || >=24.12.0`。包管理：npm。

## 常用命令

```sh
npm run dev          # 开发。首页即视觉标本
npm run build        # vue-tsc + vite build
npm run type-check   # 仅类型
npm run lint         # oxlint --fix + eslint --fix
npm run format       # oxfmt src/
```

改完视觉相关文件后，至少跑 `npx vue-tsc --build` 和 `npx vite build`。生产 CSS 由 LightningCSS 按 `package.json` 的 `browserslist` 压缩；**不要删 browserslist**，否则 `backdrop-filter` 可能只剩 `-webkit-` 前缀，Firefox 没有毛玻璃。

## 目录

```
src/
  assets/main.css          # 视觉 token 真源（@theme + @utility）
  theme/tokens.ts          # 标本页用的色板/圆角/阴影数据，hex 必须与 CSS 同步
  components/
    AppAtmosphere.vue      # 页面级奶油底 + 三团模糊光晕
    ui/
      AppSurface.vue       # 玻璃表面（glass / strong / ghost）
      StatusDot.vue        # 低饱和状态圆点
      TrendMark.vue        # 趋势箭头与颜色
      index.ts             # 统一导出
  views/StyleGuide.vue     # `/` 抽象视觉标本，不是产品页
  App.vue                  # 包一层 AppAtmosphere + RouterView
  router/index.ts
  stores/
  main.ts                  # 必须 import './assets/main.css'
index.html                 # 引入 Plus Jakarta Sans
```

新增页面：`src/views/` + 在 `router/index.ts` 注册。新增可复用 UI：`src/components/ui/`，从 `index.ts` 导出。

## 视觉语言（必须遵守）

真源：`src/assets/main.css` 的 `@theme`。改色值时**同时**改 `src/theme/tokens.ts` 里对应 hex（标本页从那里读）。

### 色彩

不要用 Tailwind 默认的 `gray-*`、`black`、`orange-500` 当品牌色。用下面这套：

| Token | Hex | 用途 |
|---|---|---|
| `canvas` | `#F5EFE6` | 页面底 |
| `canvas-deep` | `#EDE4D6` | 略沉的奶油 |
| `foam` | `#FFFBF7` | 表面色素（再和透明做 mix） |
| `accent-mist` | `#F8E0D4` | 淡桃衬底、chip 底 |
| `ink` | `#2C241C` | 主文案。**禁止纯黑** |
| `ink-soft` | `#5E534A` | 次级 |
| `ink-muted` | `#9A8B7C` | 辅助说明 |
| `ink-faint` | `#C4B5A5` | 占位 / 禁用 |
| `accent` | `#FF8C6B` | 主强调 |
| `accent-soft` | `#FFAA85` | 渐变末端 |
| `accent-deep` | `#E56B4A` | 强调底上的字、上升趋势 |
| `accent-muted` | `#E8A090` | 大面积填充（柱、块） |
| `trend-up` | `#E56B4A` | 上升 |
| `trend-down` | `#6B9B7A` | **有利**下降（耗时变短等） |
| `trend-neutral` | `#9A8B7C` | 持平 |
| `status-ok` | `#7A9E82` | 正常 |
| `status-warn` | `#D4926A` | 注意 |
| `status-idle` | `#C4B5A5` | 空闲 |
| `status-alert` | `#C97B6A` | 告警 |

状态色饱和度要低，不要用鲜绿 / 鲜红。

趋势规则：上升 → 桃橙；下降且有利 → sage 绿；下降且不利 → `status-alert`。用 `<TrendMark>`，不要手写颜色。

### 字体层级

字体：Plus Jakarta Sans（`index.html` Google Fonts，`@theme --font-sans`）。

| 类 | 角色 | 典型组合 |
|---|---|---|
| `text-display` | 核心数据 | `font-extrabold tracking-display nums-tabular text-ink` |
| `text-title` | 页面标题 | `font-bold text-ink` |
| `text-heading` | 区块标题 | `font-semibold text-ink` |
| `text-body` | 正文 | `text-ink-soft` |
| `text-caption` | 辅助 | `text-ink-muted` |
| `text-micro` | 元信息 | `text-ink-faint` |

对比要够：数据极大极粗，说明极小极淡。强调词可用 `text-accent-gradient`。

### 表面 / 圆角 / 阴影 / 光晕

- 容器圆角：`rounded-surface`（24px，等同极大圆角）。控件 `rounded-control`，胶囊 `rounded-pill`。
- 材质：`surface`（半透明 foam + blur 16 + 暖色阴影 + 内高光）、`surface-strong`、`surface-ghost`。组件封装是 `<AppSurface tone="glass|strong|ghost">`。
- 阴影：`shadow-surface` / `shadow-lift` / `shadow-glow`。带桃色透色，宁可太淡，不要发灰。
- 页面光晕：只通过 `<AppAtmosphere>`（默认 `orbs`）。局部光晕：`absolute` 圆形 `bg-accent/50 blur-orb`，不要画插画。
- 渐变：`bg-accent-gradient`（实色桃橙）、`bg-accent-sheer`（透到透明）。

### 点缀

- 状态：`<StatusDot tone="ok|warn|idle|alert" />`，需要无障碍时传 `label`。
- 趋势胶囊：外层 `chip`（上升）或 `chip-sage`（有利下降），内层 `<TrendMark>`。

## 组件约定

- Vue 组件文件名必须多词：`AppSurface.vue` 可以，`Surface.vue` 会被 `vue/multi-word-component-names` 报错。
- 一律 `<script setup lang="ts">`。props 用 `defineProps` + `withDefaults`。
- UI 从 `@/components/ui` 导入，不要深层相对路径乱穿。
- `App.vue` 已经包了 `AppAtmosphere`。页面里不要再套一层，除非明确关掉光晕（`orbs={false}`）。
- 不要为了「完整后台」去造侧栏、顶栏、图表、时间轴。用户要产品布局时再做，且必须吃这套 token。

## Tailwind 4 注意

- 自定义色 / 字号 / 圆角 / 阴影 / 模糊 / 渐变全部走 `@theme` 变量。例如 `--color-ink` → `text-ink` / `bg-ink`；`--radius-surface` → `rounded-surface`；`--blur-orb` → `blur-orb`；`--background-image-accent-gradient` → `bg-accent-gradient`。
- 复合样式用 `@utility`（`surface`、`chip`、`text-accent-gradient`、`nums-tabular`），不要复制一长串 class。
- **Tailwind 会扫描源码里的类名字符串。** 不要在说明文案、注释、标本 `sample` 里写 `bg-accent`、`from-accent`、`rounded-3xl` 这种会生成无用工具类的词。标本页的 meta 字段可以写类名（那是真的要用的）。
- 半透明表面不要把 alpha 写进 `--color-*` token（会破坏 `bg-foo/60` 这种透明度修饰）。`foam` 是不透明的，`surface` 用 `color-mix` 现配透明度。
- 不要新增 `tailwind.config.js`。不要 `@apply` 一大串到业务组件里；业务用 token 类和已有 `@utility`。

## 文案与 i18n

界面文案用简体中文。代码标识、token 名、路由 name 用英文。暂无 i18n 库，不要无故引入。

## 不要做的事

- 不要把底色改成白 / 冷灰，不要文字用 `#000`。
- 不要用默认 `shadow-lg shadow-orange-100` 替代 `shadow-surface`。
- 不要引入 UI 框架（Element Plus、Naive、Vuetify、shadcn 等）覆盖这套材质。
- 不要提交 `材料/`、`.env`、构建产物。
- 不要在没有用户要求时改 `package.json` 依赖大版本。
- 不要把 `StyleGuide.vue` 改成真实 Dashboard；它是 token 标本。产品页另建 view。

## 改视觉时的检查清单

1. 只改 `src/assets/main.css` 的 `@theme` / `@utility`，或新增真正可复用的 `@utility`。
2. hex 同步到 `src/theme/tokens.ts`。
3. 标本页能看到变化（`/`）。
4. `npx vue-tsc --build && npx vite build` 通过。
5. 抽查产物 CSS：自定义 token 在、`backdrop-filter` 无前缀形式还在、没有误扫进的工具类。
