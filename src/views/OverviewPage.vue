<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useParkStore } from '@/stores/park'
import { AppDatePicker, AppEmpty, AppSurface, StatusDot, TrendMark } from '@/components/ui'
import type { AnomalyRecord } from '@/data/types'

const store = useParkStore()

// ===== 图标（描边风格） =====
const ICON = {
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
  car: '<rect x="3" y="8" width="18" height="9" rx="2.5"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  wallet:
    '<path d="M3 7a2 2 0 012-2h12a2 2 0 012 2"/><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2H3z"/><path d="M16 14h2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l2.5 2.5"/>',
  percent:
    '<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  peak: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
} as const

// ===== 问候语与日期行 =====
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'] as const
const now = new Date()
const greeting = (() => {
  const h = now.getHours()
  if (h < 5) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})()
const dateLine = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${WEEKDAY_NAMES[now.getDay()]}`

// ===== 日期范围筛选（右上角）→ /api/overview 请求参数 =====
const dateRange = ref<readonly [string, string] | null>(null)

onMounted(() => {
  void store.fetchOverview(dateRange.value?.[0], dateRange.value?.[1])
})

watch(dateRange, () => {
  void store.fetchOverview(dateRange.value?.[0], dateRange.value?.[1])
})

const kpi = computed(() => store.overview?.kpi ?? null)
const days = computed(() => store.overview?.daily ?? [])
const lastDate = computed(() => {
  const list = days.value
  return list.length ? list[list.length - 1]!.logDate : ''
})
const hasData = computed(() => (kpi.value?.total ?? 0) > 0)

// ===== 趋势：窗口内日期对半分，后半段 vs 前半段（两段 KPI 由 store 预取） =====
interface KpiTrend {
  up: boolean | null
  text: string
}

function makeTrend(cur: number | null, prev: number | null): KpiTrend {
  if (cur === null || prev === null) return { up: null, text: '—' }
  if (prev === 0) return cur === 0 ? { up: null, text: '—' } : { up: true, text: '新增' }
  const pct = ((cur - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return { up: null, text: '持平' }
  return { up: pct > 0, text: `${pct > 0 ? '+' : ''}${pct.toFixed(1).replace(/\.0$/, '')}%` }
}

const formatFee = (fee: number) => `¥${fee.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`

// ===== KPI 卡片 =====
const kpis = computed(() => {
  const w = kpi.value
  if (!w) return []
  const l = store.lateKpi
  const e = store.earlyKpi
  return [
    {
      key: 'count',
      label: '记录总数',
      icon: ICON.list,
      value: String(w.total),
      trend: makeTrend(l?.total ?? null, e?.total ?? null),
      favorableDown: false,
    },
    {
      key: 'suspicious',
      label: '可疑记录',
      icon: ICON.alert,
      value: String(w.suspicious),
      trend: makeTrend(l?.suspicious ?? null, e?.suspicious ?? null),
      favorableDown: true,
    },
    {
      key: 'plates',
      label: '涉及车辆',
      icon: ICON.car,
      value: String(w.plates),
      trend: makeTrend(l?.plates ?? null, e?.plates ?? null),
      favorableDown: false,
    },
    {
      key: 'fee',
      label: '费用合计',
      icon: ICON.wallet,
      value: formatFee(w.feeSum),
      trend: makeTrend(l?.feeSum ?? null, e?.feeSum ?? null),
      favorableDown: false,
    },
  ]
})

// ===== 每日记录柱状图（/api/overview 的 daily 聚合） =====
const daily = computed(() =>
  days.value.map((d) => ({
    date: d.logDate,
    label: d.logDate.slice(5).replace('-', '/'),
    total: d.total,
    abnormal: d.suspicious,
    normal: d.total - d.suspicious,
  })),
)
const maxDaily = computed(() => Math.max(1, ...daily.value.map((d) => d.total)))
const barPct = (v: number) => `${((v / maxDaily.value) * 100).toFixed(2)}%`

// ===== 图表样式切换（柱状 / 折线共用同一份数据与比例尺） =====
const chartOptions = [
  { key: 'bar', label: '柱状' },
  { key: 'line', label: '折线' },
] as const
type ChartType = (typeof chartOptions)[number]['key']
const chartType = ref<ChartType>('bar')

/** 滑动色块指示激活项：色块按目标按钮的几何位置弹簧平移（同 AppSidebar 模式） */
const indicator = ref({ left: '0px', width: '0px', ready: false })
const btnEls = new Map<ChartType, HTMLElement>()

function setBtnRef(key: ChartType, el: unknown) {
  const node = el as HTMLElement | null
  if (node) btnEls.set(key, node)
  else btnEls.delete(key)
}

function updateIndicator() {
  const el = btnEls.get(chartType.value)
  if (!el) return
  indicator.value = { left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px`, ready: true }
}

watch(chartType, () => nextTick(updateIndicator))

// ===== 图表入场：每次切换类型都重播一次生长动画 =====
const chartRevealed = ref(false)

function revealChart() {
  chartRevealed.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => (chartRevealed.value = true)))
}

watch(chartType, revealChart)

/** viewBox 纵向按 100 等分，x 落在每列中点；配合 preserveAspectRatio="none" 拉伸铺满 */
const linePoints = (values: number[]) =>
  values
    .map((v, i) => `${(i + 0.5).toFixed(2)},${(100 - (v / maxDaily.value) * 100).toFixed(2)}`)
    .join(' ')

// ===== 运营指标四宫格（全部来自 KPI 聚合） =====
const metrics = computed(() => {
  const w = kpi.value
  const n = w?.total ?? 0
  const feeSum = w?.feeSum ?? 0
  const suspicious = w?.suspicious ?? 0
  const maxFee = w?.feeMax
  return [
    {
      label: '可疑率',
      icon: ICON.percent,
      value: n ? `${((suspicious / n) * 100).toFixed(1)}%` : '—',
    },
    { label: '平均费用', icon: ICON.wallet, value: n ? formatFee(feeSum / n) : '—' },
    {
      label: '单笔最高',
      icon: ICON.peak,
      value: maxFee !== null && maxFee !== undefined && n ? formatFee(maxFee) : '—',
    },
    {
      label: '日均记录',
      icon: ICON.calendar,
      value: days.value.length ? (n / days.value.length).toFixed(1) : '—',
    },
  ]
})

// ===== 最近动态（窗口内最新记录，服务端已排好序） =====
const hhmm = (value: string | null) => (value ? value.slice(11, 16) : null)

function describeRecord(r: AnomalyRecord): string {
  const entry = hhmm(r.entryTime)
  const exit = hhmm(r.exitTime)
  if (entry && exit) return `入场 ${entry} · 出场 ${exit}`
  if (entry) return `入场 ${entry} · 出场缺失`
  if (exit) return `出场 ${exit} · 入场缺失`
  return '出入场时间缺失'
}

const recordTime = (r: AnomalyRecord) => hhmm(r.exitTime) ?? ''

const activities = computed(() => store.overview?.recent ?? [])

// 最近动态里的黑名单标记：plateStats 中有已处理（status=1）记录的车牌
const blacklistedSet = computed(() => {
  const set = new Set<string>()
  for (const p of store.overview?.plateStats ?? []) {
    if (p.processed > 0) set.add(p.carNumber)
  }
  return set
})

// ===== 重点车辆标签统计（plateStats 全量聚合，不随日期筛选变化） =====
const plateTags = computed(() => {
  const stats = store.overview?.plateStats ?? []
  const total = stats.length

  const blacklisted = stats.filter((p) => p.processed > 0)
  const unprocessed = stats.filter((p) => p.unprocessed > 0)
  const repeat = stats.filter((p) => p.suspicious >= store.repeatThreshold)
  const highFee = stats.filter((p) => p.feeSum >= store.highFeeThreshold)

  const mk = (label: string, colorCls: string, list: typeof stats) => ({
    label,
    colorCls,
    count: list.length,
    pct: `${total ? (list.length / total) * 100 : 0}%`,
  })

  return [
    mk('黑名单', 'bg-status-alert', blacklisted),
    mk('屡次异常', 'bg-accent-deep', repeat),
    mk('高额欠费', 'bg-mint', highFee),
    mk('未处理', 'bg-status-warn', unprocessed),
  ]
})

const totalPlates = computed(() => store.overview?.plateStats.length ?? 0)

// ===== 入场动画：卡片渐显上浮 + 柱状图 / 标签条生长 =====
const shown = ref(false)
onMounted(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => (shown.value = true)))
  updateIndicator()
  revealChart()
})
</script>

<template>
  <main class="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-14">
    <!-- 问候标题 + 右上角日期范围选择器 -->
    <header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div class="max-w-xl space-y-2">
        <p class="text-caption font-medium text-ink-muted">{{ dateLine }}</p>
        <h1 class="text-title font-bold text-ink">
          {{ greeting }}<span class="text-accent-gradient">。</span>
        </h1>
        <p class="text-body text-ink-soft">
          停车场运行概览 · 当前范围 {{ kpi?.total ?? 0 }} 条记录<template v-if="lastDate">
            · 数据截至 {{ lastDate }}</template
          >
        </p>
      </div>
      <div class="w-full sm:w-80">
        <AppDatePicker v-model="dateRange" mode="range" placeholder="全部日期" />
      </div>
    </header>

    <p v-if="store.overviewError" class="mt-6 text-caption text-status-alert">
      {{ store.overviewError }}
    </p>

    <template v-if="hasData">
      <!-- KPI 数据卡片 -->
      <div class="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="(k, i) in kpis"
          :key="k.key"
          class="reveal"
          :class="{ 'reveal-in': shown }"
          :style="{ '--d': `${i * 70}ms` }"
        >
          <AppSurface
            tone="glass"
            class="relative overflow-hidden p-5 transition-all duration-[var(--duration-spring)] ease-spring hover:-translate-y-1 hover:shadow-lift"
          >
            <!-- 有机渐变色块装饰 -->
            <span
              class="pointer-events-none absolute -right-8 -top-12 size-36 rounded-full bg-accent/25 blur-orb"
              aria-hidden="true"
            />
            <span
              class="pointer-events-none absolute -bottom-14 -left-10 size-32 rounded-full bg-mint/20 blur-orb"
              aria-hidden="true"
            />

            <div class="relative flex items-center justify-between gap-3">
              <span class="text-caption font-medium text-ink-muted">{{ k.label }}</span>
              <span
                class="grid size-9 shrink-0 place-items-center rounded-control bg-accent-mist/70 text-accent-deep"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  v-html="k.icon"
                />
              </span>
            </div>
            <p
              class="relative mt-3 text-display font-extrabold tracking-display nums-tabular text-ink"
            >
              {{ k.value }}
            </p>
            <div class="relative mt-3 flex items-center gap-2">
              <span v-if="k.trend.up === null" class="text-caption font-medium text-ink-faint">
                {{ k.trend.text }}
              </span>
              <span v-else-if="k.trend.up" class="chip">
                <TrendMark direction="up">{{ k.trend.text }}</TrendMark>
              </span>
              <span v-else-if="k.favorableDown" class="chip-sage">
                <TrendMark direction="down" favorable>{{ k.trend.text }}</TrendMark>
              </span>
              <TrendMark v-else direction="down">{{ k.trend.text }}</TrendMark>
              <span class="text-micro text-ink-faint">较前半期</span>
            </div>
          </AppSurface>
        </div>
      </div>

      <!-- 柱状图表 + 指标四宫格 -->
      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <div class="reveal lg:col-span-2" :class="{ 'reveal-in': shown }" style="--d: 280ms">
          <AppSurface tone="glass" as="section" class="relative h-full overflow-hidden p-6">
            <span
              class="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/15 blur-orb"
              aria-hidden="true"
            />
            <div class="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-heading font-semibold text-ink">每日记录分布</h2>
                <p class="mt-0.5 text-caption text-ink-muted">按日期统计一般 / 可疑记录条数</p>
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div class="flex items-center gap-4 text-micro text-ink-muted">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="size-2 rounded-full bg-accent" aria-hidden="true" />可疑
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="size-2 rounded-full bg-accent-muted" aria-hidden="true" />一般
                  </span>
                </div>
                <div
                  class="relative flex items-center rounded-pill border border-stroke bg-foam/60 p-1"
                  role="group"
                  aria-label="图表样式"
                >
                  <!-- 滑动色块：跟随激活项弹簧平移，不随切换闪现 -->
                  <span
                    class="pointer-events-none absolute inset-y-1 rounded-pill bg-accent-mist transition-[left,width,opacity] ease-spring duration-[var(--duration-spring)]"
                    :class="indicator.ready ? 'opacity-100' : 'opacity-0'"
                    :style="{ left: indicator.left, width: indicator.width }"
                    aria-hidden="true"
                  />
                  <button
                    v-for="opt in chartOptions"
                    :key="opt.key"
                    :ref="(el) => setBtnRef(opt.key, el)"
                    type="button"
                    class="relative rounded-pill px-3 py-1 text-caption font-medium transition-colors duration-[var(--duration-spring)] ease-spring"
                    :class="
                      chartType === opt.key
                        ? 'text-accent-deep'
                        : 'text-ink-muted hover:text-ink-soft'
                    "
                    :aria-pressed="chartType === opt.key"
                    @click="chartType = opt.key"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="chartType === 'bar'" class="relative mt-6 flex items-end gap-4 sm:gap-8">
              <div
                v-for="(d, i) in daily"
                :key="d.date"
                class="flex flex-1 flex-col items-center gap-2 rounded-control px-1 py-1.5 transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/40"
              >
                <p class="text-micro font-semibold nums-tabular text-ink-muted">{{ d.total }}</p>
                <div
                  class="relative h-40 w-full max-w-14"
                  role="img"
                  :aria-label="`${d.date} 共 ${d.total} 条记录，其中可疑 ${d.abnormal} 条`"
                  :title="`${d.date} · 共 ${d.total} 条 / 可疑 ${d.abnormal} 条`"
                >
                  <!-- 圆角挂在当前最高的分段上：外层不再裁剪，否则只有顶满量程的柱子才有圆角 -->
                  <div class="absolute inset-0 flex flex-col justify-end">
                    <div
                      class="w-full bg-accent-gradient transition-[height] ease-spring duration-[var(--duration-spring)]"
                      :class="d.abnormal > 0 ? 'rounded-t-control' : ''"
                      :style="{
                        height: chartRevealed ? barPct(d.abnormal) : '0%',
                        transitionDelay: `${400 + i * 80}ms`,
                      }"
                    />
                    <div
                      class="w-full bg-accent-muted/60 transition-[height] ease-spring duration-[var(--duration-spring)]"
                      :class="d.abnormal === 0 ? 'rounded-t-control' : ''"
                      :style="{
                        height: chartRevealed ? barPct(d.normal) : '0%',
                        transitionDelay: `${400 + i * 80}ms`,
                      }"
                    />
                  </div>
                </div>
                <span class="text-caption nums-tabular text-ink-muted">{{ d.label }}</span>
              </div>
            </div>

            <!-- 折线视图：与柱状共用同一份数据与比例尺；入场用 clip-path 从左向右擦除展开 -->
            <div v-else class="relative mt-6">
              <div
                class="relative h-40 w-full transition-[clip-path] ease-spring duration-[calc(var(--duration-spring)*2)]"
                :style="{ clipPath: chartRevealed ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' }"
              >
                <svg
                  class="h-full w-full"
                  :viewBox="`0 0 ${daily.length} 100`"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    v-for="y in [0, 50, 100]"
                    :key="y"
                    x1="0"
                    :x2="daily.length"
                    :y1="y"
                    :y2="y"
                    vector-effect="non-scaling-stroke"
                    style="stroke: var(--color-stroke)"
                  />
                  <polyline
                    :points="linePoints(daily.map((d) => d.normal))"
                    fill="none"
                    style="stroke: var(--color-accent-muted)"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"
                  />
                  <polyline
                    :points="linePoints(daily.map((d) => d.abnormal))"
                    fill="none"
                    style="stroke: var(--color-accent)"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
                <!-- 数据点用 DOM 圆点：preserveAspectRatio 拉伸会把 SVG circle 压成椭圆；随外层 clip-path 一同展开 -->
                <div class="absolute inset-0 flex">
                  <div
                    v-for="d in daily"
                    :key="d.date"
                    class="relative flex-1"
                    role="img"
                    :aria-label="`${d.date} 共 ${d.total} 条记录，其中可疑 ${d.abnormal} 条`"
                    :title="`${d.date} · 共 ${d.total} 条 / 可疑 ${d.abnormal} 条`"
                  >
                    <!-- 0 值也画点（贴基线收尾），否则折线终点会显得悬空；max 防止圆点被 clip-path 下缘裁掉 -->
                    <span
                      class="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent ring-2 ring-foam"
                      :style="{ bottom: `max(calc(${barPct(d.abnormal)} - 4px), 0px)` }"
                    />
                    <span
                      class="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent-muted ring-2 ring-foam"
                      :style="{ bottom: `max(calc(${barPct(d.normal)} - 4px), 0px)` }"
                    />
                  </div>
                </div>
              </div>
              <div class="mt-2 flex">
                <span
                  v-for="d in daily"
                  :key="d.date"
                  class="flex-1 text-center text-caption nums-tabular text-ink-muted"
                >
                  {{ d.label }}
                </span>
              </div>
            </div>
          </AppSurface>
        </div>

        <div class="reveal" :class="{ 'reveal-in': shown }" style="--d: 360ms">
          <AppSurface tone="glass" as="section" class="relative h-full overflow-hidden p-6">
            <span
              class="pointer-events-none absolute -bottom-16 -right-14 size-48 rounded-full bg-mint/15 blur-orb"
              aria-hidden="true"
            />
            <div class="relative">
              <h2 class="text-heading font-semibold text-ink">运营指标</h2>
              <p class="mt-0.5 text-caption text-ink-muted">当前日期范围内</p>

              <div class="mt-5 grid grid-cols-2 gap-3">
                <div
                  v-for="m in metrics"
                  :key="m.label"
                  class="rounded-control border border-stroke bg-foam/50 p-4"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="grid size-7 shrink-0 place-items-center rounded-control bg-accent-mist/70 text-accent-deep"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        class="size-3.5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                        v-html="m.icon"
                      />
                    </span>
                    <span class="text-caption text-ink-muted">{{ m.label }}</span>
                  </div>
                  <p class="mt-3 text-title font-bold nums-tabular text-ink">{{ m.value }}</p>
                </div>
              </div>
            </div>
          </AppSurface>
        </div>
      </div>

      <!-- 最近动态 + 重点车辆标签统计 -->
      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <div class="reveal lg:col-span-2" :class="{ 'reveal-in': shown }" style="--d: 420ms">
          <AppSurface tone="glass" as="section" class="relative h-full overflow-hidden p-6">
            <span
              class="pointer-events-none absolute -left-20 -bottom-24 size-56 rounded-full bg-accent/10 blur-orb"
              aria-hidden="true"
            />
            <div class="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-heading font-semibold text-ink">最近动态</h2>
                <p class="mt-0.5 text-caption text-ink-muted">最新入库的车辆记录</p>
              </div>
              <RouterLink
                to="/approval"
                class="rounded-pill px-3 py-1.5 text-caption font-medium text-accent-deep transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60"
              >
                前往审批 →
              </RouterLink>
            </div>

            <ul class="relative mt-2 divide-y divide-stroke/60">
              <li
                v-for="a in activities"
                :key="a.id"
                class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <StatusDot
                  :tone="a.isSuspicious ? 'alert' : 'ok'"
                  :label="a.isSuspicious ? '可疑' : '一般'"
                />
                <span class="nums-tabular text-body font-semibold text-ink">{{ a.carNumber }}</span>
                <span class="text-caption text-ink-soft">{{ describeRecord(a) }}</span>
                <span v-if="blacklistedSet.has(a.carNumber)" class="chip">黑名单</span>
                <span class="ml-auto flex items-center gap-4">
                  <span class="nums-tabular text-caption font-semibold text-ink">
                    {{ a.fee === null ? '—' : formatFee(a.fee) }}
                  </span>
                  <span class="w-24 text-right text-micro nums-tabular text-ink-faint">
                    {{ a.logDate.slice(5).replace('-', '/') }} {{ recordTime(a) }}
                  </span>
                </span>
              </li>
            </ul>
          </AppSurface>
        </div>

        <div class="reveal" :class="{ 'reveal-in': shown }" style="--d: 480ms">
          <AppSurface tone="glass" as="section" class="relative h-full overflow-hidden p-6">
            <span
              class="pointer-events-none absolute -right-14 -top-16 size-44 rounded-full bg-accent/15 blur-orb"
              aria-hidden="true"
            />
            <div class="relative">
              <h2 class="text-heading font-semibold text-ink">重点车辆标签</h2>
              <p class="mt-0.5 text-caption text-ink-muted">共 {{ totalPlates }} 台车</p>

              <ul class="mt-5 space-y-4">
                <li v-for="(t, i) in plateTags" :key="t.label">
                  <div class="flex items-center justify-between">
                    <span
                      class="inline-flex items-center gap-2 text-caption font-medium text-ink-soft"
                    >
                      <span class="size-2 rounded-full" :class="t.colorCls" aria-hidden="true" />
                      {{ t.label }}
                    </span>
                    <span class="text-caption nums-tabular text-ink">{{ t.count }} 台</span>
                  </div>
                  <div class="mt-2 h-2.5 rounded-pill bg-canvas-deep/60">
                    <div
                      class="h-full rounded-pill transition-[width] ease-spring duration-[var(--duration-spring)]"
                      :class="t.colorCls"
                      :style="{
                        width: shown ? t.pct : '0%',
                        transitionDelay: `${550 + i * 90}ms`,
                      }"
                    />
                  </div>
                </li>
              </ul>

              <p class="mt-5 text-micro text-ink-faint">
                屡次异常 ≥ {{ store.repeatThreshold }} 条可疑记录 · 高额欠费为累计费用 ≥ ¥{{
                  store.highFeeThreshold
                }}
              </p>
            </div>
          </AppSurface>
        </div>
      </div>
    </template>

    <AppEmpty
      v-else-if="store.overviewLoading"
      :icon="ICON.clock"
      title="数据加载中…"
      hint="正在从数据库读取概览数据"
    />
    <AppEmpty
      v-else
      :icon="ICON.clock"
      title="该日期范围内暂无记录"
      hint="试试调整右上角的日期范围，或清空筛选查看全部数据"
    />
  </main>
</template>

<style scoped>
/* 入场渐显：透明度线性、位移用线性弹簧，与路由过渡同一套曲线 */
.reveal {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity var(--duration-spring) linear,
    transform var(--duration-spring) var(--ease-spring);
  transition-delay: var(--d, 0ms);
}
.reveal-in {
  opacity: 1;
  transform: translateY(0);
}
</style>
