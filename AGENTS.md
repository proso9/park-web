# park-web · Agent 指南

给后续 AI / 协作者的项目说明书。先读本文件，再改代码。

## 这是什么

Vue 3 + Vite + Tailwind CSS 4 的前端。现代、极简、温暖、高级的 SaaS。左侧窄轨导航。

视觉语言（配色、字体层级、渐变、圆角、阴影、表面材质）已有完整 token；业务上已对接 Cloudflare D1（`anomalies` 异常车辆表）：明细列表（服务端分页 + 多条件筛选 + 行内人工处理）、审批分组（黑名单 / 误报移除）、快速移除面板、概览数据仪表盘、Settings 阈值配置，均已落地。全站有单密码访问门禁：未登录只渲染登录页，全部 `/api` 要求有效会话（见「访问认证」）。

氛围：现代、极简、温暖、高级的 SaaS。奶油底、桃色光晕、深棕墨色、大面积留白。

参考图在 `材料/design.png`（已列入 `.gitignore`，本地才有）。视觉方向以该图和 `src/assets/main.css` 为准，不要自行改成冷灰 / 纯黑 / 高饱和蓝。

## 保持本文件与代码同步（AI 必读）

本文件是项目规范真源。AI / 协作者改动本项目代码时，必须遵守：

1. 先读本文件，再改代码；视觉相关改动务必遵守其中的 token 与动效规范。
2. **本文件必须与代码保持同步。** 当代码发生变化、本文件里的目录 / 组件 / 路由 / 命令 / 约束描述不再准确时，应主动更新本文件，而非让文档失真。
3. 更新本文件时：只改事实性描述（目录、组件、路由、命令、新增约束），不改视觉方向与既有约定；保持简体中文风格。

## 技术栈

| 层    | 选型                                                  | 注意                                                |
| ---- | --------------------------------------------------- | ------------------------------------------------- |
| 框架   | Vue 3.5 `<script setup lang="ts">`                  | 不要 Options API，不要 JSX                             |
| 路由   | vue-router 5                                        | `createWebHistory`                                |
| 状态   | Pinia 4                                             | 现成 `src/stores/counter.ts` 是模板残留，新 store 按需建      |
| 样式   | Tailwind CSS **4**（`@tailwindcss/vite`）             | **没有** `tailwind.config.js`。token 写在 CSS `@theme` |
| 构建   | Vite 8                                              | 路径别名 `@` → `src/`                                 |
| 语言   | TypeScript 6，`noUncheckedIndexedAccess`             | 数组/对象取值按可能 `undefined` 处理                         |
| 运行时  | Cloudflare Workers + Static Assets                  | 静态资源 + `/api` 同一 Worker；配置见 `wrangler.jsonc`      |
| 数据库  | Cloudflare D1（SQLite 兼容），binding 名 `DB`             | 只允许 UPDATE `status` / `remark`（见「数据与状态模型」）        |
| 格式化  | oxfmt                                               | 无分号、单引号（`.oxfmtrc.json`）                          |
| Lint | oxlint + eslint（含 `vue/multi-word-component-names`） | 组件文件名必须多词                                         |

Node：`^22.18.0 || >=24.12.0`。包管理：npm。

## 常用命令

```sh
npm run dev          # 前端开发（/api 代理到 127.0.0.1:8787）。标本页在 /style-guide
npm run dev:api      # Worker 本地开发（wrangler dev，读写本地 D1）
npm run seed         # 把 scripts/seed-data/*.csv 导入本地 D1（dev 联调数据）
npm run build        # vue-tsc + vite build
npm run deploy       # build + wrangler deploy（部署到 Cloudflare）
npm run type-check   # 仅类型
npm run lint         # oxlint --fix + eslint --fix
npm run format       # oxfmt src/
```

本地联调开两个终端：先 `npm run seed`（同时会应用 `migrations/`），再 `npm run dev:api` + `npm run dev`。本地 dev 需要密钥文件：`cp .dev.vars.example .dev.vars` 并填入 `AUTH_PASSWORD` / `AUTH_SECRET` / `TURNSTILE_SECRET`（已 gitignore）。远端首次部署前先 `npx wrangler d1 migrations apply test --remote` 建索引；访问密码、签名密钥与 Turnstile 核销密钥用 `npx wrangler secret put AUTH_PASSWORD` / `AUTH_SECRET` / `TURNSTILE_SECRET` 配置（各执行一次）。认证（Cloudflare 账号）统一走 `wrangler login`，**不要在聊天里传 API token 与线上密码**。线上数据由上游检测工具用 `INSERT OR IGNORE` 写入，本项目不 seed 远端。

改完视觉相关文件后，至少跑 `npx vue-tsc --build` 和 `npx vite build`。生产 CSS 由 LightningCSS 按 `package.json` 的 `browserslist` 压缩；**不要删 browserslist**，否则 `backdrop-filter` 可能只剩 `-webkit-` 前缀，Firefox 没有毛玻璃。

## 目录

```
wrangler.jsonc             # Worker 配置：main=worker/index.ts、assets=dist、D1 binding、SPA 回退
worker-configuration.d.ts  # wrangler types 生成的运行时类型（Env 含 DB / ASSETS），勿手改
.dev.vars.example          # 本地 dev 密钥模板（AUTH_PASSWORD / AUTH_SECRET / TURNSTILE_SECRET），复制为 .dev.vars 使用
worker/
  index.ts                 # fetch 入口：/api 路由分发（auth 端点 + 会话守卫），其余交给静态资源
  auth.ts                  # 单密码门禁：登录/探测/登出端点 + 无状态会话签发验签 + Turnstile token 核销（siteverify）
  env.d.ts                # Env 补充 secrets 声明（AUTH_PASSWORD / AUTH_SECRET / TURNSTILE_SECRET），与生成的全局 Env 合并
  http.ts                  # json / httpError / readJson 工具
  db.ts                    # 行映射（snake_case → camelCase）+ 列清单 + 日期范围条件
  routes/
    records.ts             # GET /api/records（分页列表）+ PATCH /api/records/:id（只改 status/remark）
    plates.ts              # 车牌候选 / 全量+黑名单 / 各状态计数 / 车牌级批量状态变更
    overview.ts            # GET /api/overview：KPI + 每日分布 + 最近动态 + 全量车牌聚合（db.batch 单请求）
    plateGroups.ts         # GET /api/plate-groups：审批页两段式车牌分组分页
migrations/
  0000_schema.sql          # anomalies 建表（IF NOT EXISTS，与上游一致，远端已有表则无操作）
  0001_indexes.sql         # exit_time / car_number / status 三个索引
  0002_log_date_index.sql  # log_date 索引（日期是筛选最高优先条件）
scripts/
  seed-local.mjs           # CSV → 本地 D1 种子脚本（npm run seed）
  seed-data/               # 种子 CSV（*.csv 已 gitignore，本地保留）
src/
  assets/main.css          # 视觉 token 真源（@theme + @utility + @layer components 动效）
  assets/fonts/            # Plus Jakarta Sans 自托管 woff2（latin + latin-ext，可变字重 400-800），经 main.css 的 @font-face 引用
  theme/tokens.ts          # 标本页用的色板/圆角/阴影数据，hex 必须与 CSS 同步
  api/
    client.ts              # Worker /api 的 fetch 封装（类型化）；读接口走 SWR，写接口与导出绕过缓存；401 全局回调 setUnauthorizedHandler
    cache.ts               # 前端 SWR 读缓存（内存级）：聚合/全量 TTL 60s、列表 TTL 15s，invalidateApiCache() 全量失效
  components/
    AppAtmosphere.vue      # 页面级奶油底 + 三团模糊光晕
    AppShell.vue           # 骨架：左栏 + 主区，路由切换时页面左右滑动（方向感知）
    RouteProgress.vue      # 路由懒加载 chunk 的顶部细进度条（导航 200ms 未完成才淡入，预取命中不可见）
    AppSidebar.vue         # 左轨导航：滑动色块指示激活项 + 4 个 RouterLink，数据驱动
    BlacklistQuickRemove.vue  # 审批页快速移除面板：车牌模糊匹配（/api/plates）+ 每行导入，批量标记误报（必填备注）
    ui/
      AppSurface.vue       # 玻璃表面（glass / strong / ghost）
      AppButton.vue        # 通用按钮（primary / ghost / danger 等）
      AppStatusChip.vue    # 记录状态胶囊（0 未处理 / 1 已处理 / 2 误报）
      AppSelect.vue        # 通用下拉（除日期外：状态/可疑/入场等选项筛选）
      AppDatePicker.vue    # 全站统一日期选择：输入框唤起悬浮日历，single/range、拖拽框选、今日/禁用、键盘
      AppPagination.vue    # 轻量分页（服务端分页专用，上一页/下一页 + 总量）
      AppEmpty.vue         # 空状态占位
      StatusDot.vue        # 低饱和状态圆点
      TrendMark.vue        # 趋势箭头与颜色
      index.ts             # 统一导出
  data/
    types.ts               # 领域类型：AnomalyRecord、RecordStatus、OverviewData、PlateStat 等（worker 复用）
  views/
    LoginPage.vue          # 全屏登录页（无侧栏）：AppSurface 卡片 + 密码输入 + Cloudflare Turnstile（dev/生产 sitekey 按 import.meta.env.DEV 切换，失败自动 reset），错误/过期提示，弹簧入场
    StyleGuide.vue         # `/style-guide` 抽象视觉标本，不是产品页
    OverviewPage.vue       # 概览仪表盘：/api/overview 驱动 —— 问候 + 时间档位切换（近3天/近7天/近1月，滑动色块，始终带日期范围请求） + KPI 卡片（前后半期趋势） / 每日分布图（柱状 / 折线可切换） / 运营指标四宫格 / 最近动态 / 重点车辆标签统计（全量聚合，不随档位变化） + 数据「更新于」时间（含后台静默重拉）
    DetailsPage.vue        # 明细：筛选折叠（车牌/日期范围/状态/可疑/缺入场）+ 服务端分页表格 + 行内处理（状态下拉 + 备注，误报必填原因）
    ApprovalPage.vue       # 审批：日期范围 + 车牌分组分页（/api/plate-groups）+ 加入黑名单/误报移除/恢复（动作先入待提交队列，底部粘性提交栏一次性落库，串行执行后统一刷新；队列 sessionStorage 暂存 + 关页/刷新弹确认防丢） + 黑名单 CSV 导出 + 快速移除面板
    SettingsPage.vue       # 设置：可调概览页「屡次异常 / 高额欠费」判定阈值（基于服务端车牌聚合实时预演）+ 退出登录
  App.vue                  # AppAtmosphere + 认证门：checking 静默占位 / guest 渲染 LoginPage / authed 渲染 AppShell
  router/index.ts
  stores/
    auth.ts                # 认证 store：check / login / logout，401 全局回调切回登录页，重新登录后失效读缓存
    park.ts                # 业务 store：明细/概览/分组/车牌数据与状态操作（全部走 api/client，读请求经 SWR 缓存），阈值 localStorage（park:settings）
    counter.ts             # 模板残留，勿用
  main.ts                  # 必须 import './assets/main.css'
index.html                 # 入口 HTML（字体自托管，无第三方 CDN 渲染阻塞）
public/_headers            # 静态资产缓存头：/assets/*（内容哈希文件名）一年 immutable；HTML 与 public 图标不在此列
```

新增页面：`src/views/` + 在 `router/index.ts` 注册，路由组件一律懒加载 `component: () => import('@/views/Xxx.vue')`；登录后常去的页面记得加入 `router/index.ts` 的 `prefetchRouteChunks()`（空闲时预取 chunk）。新增可复用 UI：`src/components/ui/`，从 `index.ts` 导出。

页面渲染：`App.vue` 只在最外层包一次 `AppAtmosphere`，`AppShell` 里放 `AppSidebar` + `RouterView`。页面内不要再套 `AppAtmosphere`，否则光晕叠两层。侧栏是窄轨（`w-20`）+ 垂直居中的 icon+中文，不改成传统宽文字菜单。

## 数据与状态模型（必须遵守）

数据全部来自 Cloudflare D1 `anomalies` 表（上游检测工具自动写入），经 Worker `/api` 访问，前端**没有任何内置数据**。

1. **只允许 UPDATE `status` 和 `remark` 两个字段**；`id / log_date / log_file / entry_time / exit_time / car_number / fee / is_suspicious / dedup_key / created_at` 一律只读（`dedup_key` 是上游幂等键，绝不可改删）。Worker 的 PATCH 接口已做白名单，别加字段。
2. **状态映射**（`RecordStatus`，即 D1 `status`）：`0` 未处理、`1` 已处理（= 旧「黑名单」，`/api/plates?all=1` 的 `blacklisted` 就是 status=1 的车牌）、`2` 误报（= 旧「移除」，**必填备注原因**写入 `remark`）。UI 胶囊用 `<AppStatusChip :status="0|1|2">`。
3. `entry_time` / `fee` 为 NULL 是正常业务状态，前端显示 `-`/`—`；`created_at` 是 UTC，展示需转 +8；时间都是 `YYYY-MM-DD HH:MM:SS` 文本，排序直接按字符串。
4. **分页与额度**：列表接口 `pageSize` 上限 50、审批分组上限 20；所有查询参数化绑定（`prepare().bind()`），模糊搜索用 `car_number LIKE ?`；不做高频轮询。单次查询绑定参数 ≤ 100。**概览页始终携带日期范围**（时间档位：近3天/近7天/近1月，默认近7天），不允许无界全表聚合；审批页动作用待提交队列批量落库，避免高频写。
5. **读缓存（SWR，`src/api/cache.ts`）**：store 的读请求全部走 SWR——聚合/全量（`/api/overview`、`/api/plates?all=1`）TTL 60s，列表（records、plate-groups）TTL 15s。TTL 内切页零请求；过期先回旧数据渲染，再后台静默重拉（经 `onUpdate` 覆盖 UI）。**任何写操作后必须全量失效**（`refreshAfterMutation` 已封装 `invalidateApiCache()`）；写前判定（`plateCounts`）与黑名单 CSV 导出绕过缓存。store 各数据切片带请求序号守卫，过期重拉的旧响应不会乱序覆盖。
6. 前端 localStorage 只存 `park:settings`（概览阈值）；旧的 `park:approval-state` 已废弃（审批状态在数据库里）。审批页「待提交队列」另暂存 sessionStorage（`park:approval-queue`），只存未落库动作、提交成功即清空；队列非空时关页 / 刷新会弹浏览器确认。
7. 本地 dev 用 `npm run seed` 灌种子数据（`scripts/seed-data/*.csv` → 本地 Miniflare SQLite）；**不要 seed 远端**，远端数据只属于上游工具。

## 访问认证（必须遵守）

单密码门禁，无账号体系（`worker/auth.ts` + `src/stores/auth.ts`）：

1. 密码与签名密钥只走 Worker secrets：线上 `npx wrangler secret put AUTH_PASSWORD` / `AUTH_SECRET` / `TURNSTILE_SECRET`，本地 dev 用 `.dev.vars`（模板 `.dev.vars.example`）。未配置时 fail closed：登录接口 500、其余 `/api` 一律 401。
2. 会话是无状态签名 Cookie `park_session`（`过期时间戳.HMAC-SHA256`，7 天，HttpOnly + SameSite=Lax），不落库、不占 D1 写额度；密码比对走 SHA-256 摘要常量时间比较。前端启动探测 `/api/auth/check` 验证通过时，服务端顺带滑动续签（重发满 7 天的新 Cookie），活跃用户不会被硬性踢出；过期会话仍一律 401。
3. 除 `/api/auth/login|check|logout` 外，所有 `/api` 端点必须在 `isAuthed` 守卫之后；**新增业务接口默认放守卫后面，不要开免认证路径**。
4. 前端 `App.vue` 认证门三态：`checking` 静默占位 / `guest` 全屏登录页（无侧栏）/ `authed` 正常 AppShell。任何业务 401 经 `setUnauthorizedHandler` 回调切回登录页，重新登录后 `invalidateApiCache()` 全量失效，避免残留上个会话的数据。
5. 登录接口**不做限速**；防人机 / 防爆破由 Cloudflare Turnstile 承担：LoginPage 显式渲染 widget（action=login），登录请求必须带 token；服务端 `handleLogin` 先调 `siteverify` 核销（10s 超时、fail closed，**不传 remoteip**——解题与请求 IP 可能不同会误拒）再校验密码。**token 一次性**：任何登录失败后前端必须 `turnstile.reset()` 换新 token。**sitekey / secret 必须配套**：vite dev 用官方测试 sitekey（`import.meta.env.DEV` 切换，自动通过），`.dev.vars` 配官方测试 secret；生产构建用真实 sitekey（公开，硬编码在 LoginPage）+ `wrangler secret put` 配置的真实 secret。官方测试 secret 遇真实 token 会返回 `invalid-input-secret`，混用必挂。

## 视觉语言（必须遵守）

真源：`src/assets/main.css` 的 `@theme`。改色值时**同时**改 `src/theme/tokens.ts` 里对应 hex（标本页从那里读）。

### 色彩

不要用 Tailwind 默认的 `gray-*`、`black`、`orange-500` 当品牌色。用下面这套：

| Token           | Hex       | 用途              |
| --------------- | --------- | --------------- |
| `canvas`        | `#F5EFE6` | 页面底             |
| `canvas-deep`   | `#EDE4D6` | 略沉的奶油           |
| `foam`          | `#FFFBF7` | 表面色素（再和透明做 mix） |
| `accent-mist`   | `#F8E0D4` | 淡桃衬底、chip 底     |
| `ink`           | `#2C241C` | 主文案。**禁止纯黑**    |
| `ink-soft`      | `#5E534A` | 次级              |
| `ink-muted`     | `#9A8B7C` | 辅助说明            |
| `ink-faint`     | `#C4B5A5` | 占位 / 禁用         |
| `accent`        | `#FF8C6B` | 主强调             |
| `accent-soft`   | `#FFAA85` | 渐变末端            |
| `accent-deep`   | `#E56B4A` | 强调底上的字、上升趋势     |
| `accent-muted`  | `#E8A090` | 大面积填充（柱、块）      |
| `mint`          | `#5FA99C` | 薄荷青点缀             |
| `trend-up`      | `#E56B4A` | 上升              |
| `trend-down`    | `#6B9B7A` | **有利**下降（耗时变短等） |
| `trend-neutral` | `#9A8B7C` | 持平              |
| `status-ok`     | `#7A9E82` | 正常              |
| `status-warn`   | `#D4926A` | 注意              |
| `status-idle`   | `#C4B5A5` | 空闲              |
| `status-alert`  | `#C97B6A` | 告警              |

状态色饱和度要低，不要用鲜绿 / 鲜红。

趋势规则：上升 → 桃橙；下降且有利 → sage 绿；下降且不利 → `status-alert`。用 `<TrendMark>`，不要手写颜色。

### 字体层级

字体：Plus Jakarta Sans（自托管 woff2 在 `src/assets/fonts/`，`@font-face` 定义在 `main.css`，`@theme --font-sans`；不引 Google Fonts CDN——渲染阻塞关键路径且国内不可达，中文字符本就回退系统字体）。

| 类              | 角色   | 典型组合                                                    |
| -------------- | ---- | ------------------------------------------------------- |
| `text-display` | 核心数据 | `font-extrabold tracking-display nums-tabular text-ink` |
| `text-title`   | 页面标题 | `font-bold text-ink`                                    |
| `text-heading` | 区块标题 | `font-semibold text-ink`                                |
| `text-body`    | 正文   | `text-ink-soft`                                         |
| `text-caption` | 辅助   | `text-ink-muted`                                        |
| `text-micro`   | 元信息  | `text-ink-faint`                                        |

对比要够：数据极大极粗，说明极小极淡。强调词可用 `text-accent-gradient`。

### 表面 / 圆角 / 阴影 / 光晕

- 容器圆角：`rounded-surface`（24px，等同极大圆角）。控件 `rounded-control`，胶囊 `rounded-pill`。
- 材质：`surface`（半透明 foam + blur 16 + 暖色阴影 + 内高光）、`surface-strong`、`surface-ghost`。组件封装是 `<AppSurface tone="glass|strong|ghost">`。
- 阴影：`shadow-surface` / `shadow-lift` / `shadow-glow`。带桃色透色，宁可太淡，不要发灰。
- 页面光晕：只通过 `<AppAtmosphere>`（默认 `orbs`）。局部光晕：`absolute` 圆形 `bg-accent/50 blur-orb`，不要画插画。
- 渐变：`bg-accent-gradient`（实色桃橙）、`bg-accent-sheer`（透到透明）。

### 点缀

- 状态：`<StatusDot tone="ok|warn|idle|alert" />`，需要无障碍时传 `label`。审批状态胶囊用 `<AppStatusChip>`，按钮用 `<AppButton>`，空态用 `<AppEmpty>`。
- 趋势胶囊：外层 `chip`（上升）或 `chip-sage`（有利下降），内层 `<TrendMark>`。

## 动画规范（必须遵守）

所有动效统一「**线性弹簧**」：`--ease-spring`（`cubic-bezier(0.34, 1.56, 0.64, 1)`）+ `--duration-spring`（420ms），token 定义在 `src/assets/main.css` 的 `@theme`。组件里用 `ease-spring duration-[var(--duration-spring)]`，原生 CSS 直接用两个 var。不要用默认 `ease-in-out`、不要硬切。

现有五处动画（新增动画沿用同一套曲线与时长）：

| 位置 | 效果 |
| --- | --- |
| `AppSidebar.vue` | 导航色块：绝对定位 `bg-accent-mist` 指示块，按激活项 `top/height` 弹簧平移 |
| `AppShell.vue` | 路由过渡：`<Transition mode="out-in">`，按导航顺序前进右进 / 后退左进，类名 `page-slide-right/left-*`（定义在 `main.css` 的 `@layer components`） |
| `DetailsPage.vue` | 筛选折叠：`.filter-collapse`（`grid-template-rows 0fr→1fr`）+ `.open`，箭头随展开旋转 |
| `OverviewPage.vue` | 概览入场：卡片渐显上浮（`.reveal` / `.reveal-in`，`--d` 做逐级延迟）+ 柱状图 / 标签条生长过渡（height / width 过渡）+ 折线图从左向右擦除展开（clip-path 过渡），均用弹簧 token |
| `LoginPage.vue` | 登录卡片入场：透明上浮一次（`translate-y` + opacity 过渡，弹簧 token） |
| `RouteProgress.vue` | 路由懒加载指示：导航 200ms 未完成才淡入的顶部 2px 进度条，宽度 60%→100% 两段式弹簧过渡，完成后淡出 |

- 路由滑动方向由 `NAV_ORDER` 决定（`AppShell.vue`），新增页面记得加入顺序数组。
- 折叠类面板统一用 `filter-collapse` 模式，不要用 JS 量高度。

## 组件约定

- Vue 组件文件名必须多词：`AppSurface.vue` 可以，`Surface.vue` 会被 `vue/multi-word-component-names` 报错。
- 一律 `<script setup lang="ts">`。props 用 `defineProps` + `withDefaults`。
- UI 从 `@/components/ui` 导入，不要深层相对路径乱穿。
- `App.vue` 已经包了 `AppAtmosphere`。页面里不要再套一层，除非明确关掉光晕（`orbs={false}`）。
- **全站日期选择统一用 `<AppDatePicker>`**（`OverviewPage` / `ApprovalPage` / `DetailsPage` 都是 range 选范围）。不要再用 `AppSelect` 去列日期选项来当日期筛选。范围/单选的 v-model 值类型见组件导出 `DatePickerValue`。
- 服务端分页列表统一用 `<AppPagination>`（受控组件：父组件传 page/pageSize/total，回抛 update 事件）。
- 注意：`oxfmt` 会把模板里分号分隔的多语句内联事件（`@focus="a(); b=true"`）改写成 Vue 编译不过的形式，多语句逻辑抽成 `<script setup>` 里的方法再绑定。
- 不要为了「完整后台」去造顶栏、图表、时间轴、卡片墙。侧栏已有（`AppShell` / `AppSidebar`），别随意把它改成宽文字菜单或加底部头像。

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
- 不要提交 `材料/`、`.env`、`.dev.vars`、构建产物、种子 CSV 与 `scripts/seed.sql`。
- 不要在没有用户要求时改 `package.json` 依赖大版本。
- 不要把 `StyleGuide.vue` 改成真实 Dashboard；它是 token 标本。产品页另建 view。
- 不要绕过 Worker 直连 D1 REST API（运行时一律走 binding），不要在前端拼 SQL。
- 不要新增绕过会话守卫的 `/api` 路径（免认证的只有 `/api/auth/*` 三个端点），不要把访问密码 / `AUTH_SECRET` / `TURNSTILE_SECRET` 写进代码或提交到仓库（Turnstile sitekey 是公开的，硬编码在 LoginPage 属正常）。
- 不要改 `wrangler.jsonc` 的 `database_id` / 账号，不要删除或修改 `dedup_key` 相关约束。

## 改视觉时的检查清单

1. 只改 `src/assets/main.css` 的 `@theme` / `@utility`，或新增真正可复用的 `@utility`。
2. hex 同步到 `src/theme/tokens.ts`。
3. 标本页能看到变化（`/style-guide`）。
4. `npx vue-tsc --build && npx vite build` 通过。
5. 抽查产物 CSS：自定义 token 在、`backdrop-filter` 无前缀形式还在、没有误扫进的工具类。
6. 改动画：沿用 `--ease-spring` / `--duration-spring`，不要硬编码曲线或时长。

