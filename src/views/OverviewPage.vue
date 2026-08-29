<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useParkStore } from '@/stores/park'
import { AppDatePicker, AppEmpty, AppSurface, StatusDot, TrendMark } from '@/components/ui'
import type { AbnormalVehicle, ApprovalStatus } from '@/data/types'

const store = useParkStore()

// ===== 图标（描边风格） =====
const ICON = {
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
  car: '<rect x="3" y="8" width="18" height="9" rx="2.5"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  wallet: '<path d="M3 7a2 2 0 012-2h12a2 2 0 012 2"/><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2H3z"/><path d="M16 14h2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l2.5 2.5"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  peak: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
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

// ===== 日期范围筛选（右上角） =====
const dateRange = ref<readonly [string, string] | null>(null)

const sorted = computed(() => [...store.sourceRecords].sort((a, b) => a.date.localeCompare(b.date)))

const records = computed(() => {
  const range = dateRange.value
  if (!range) return sorted.value
  return sorted.value.filter((r) => r.date >= range[0] && r.date <= range[1])
})

/** 窗口内出现过的日期（升序） */
const days = computed(() => [...new Set(records.value.map((r) => r.date))].sort())
const lastDate = computed(() => days.value[days.value.length - 1] ?? '')

// ===== 趋势：窗口内日期对半分，后半段 vs 前半段 =====
const splitAt = computed(() => Math.floor(days.value.length / 2))
const earlyDays = computed(() => days.value.slice(0, splitAt.value))
const lateDays = computed(() => days.value.slice(splitAt.value))

function recordsOn(ds: string[]): AbnormalVehicle[] {
  const set = new Set(ds)
  return records.value.filter((r) => set.has(r.date))
}

function statsOf(list: AbnormalVehicle[]) {
  return {
    count: list.length,
    abnormal: list.filter((r) => r.abnormal).length,
    plates: new Set(list.map((r) => r.plate)).size,
    fee: list.reduce((sum, r) => sum + r.fee, 0),
  }
}

const windowStats = computed(() => statsOf(records.value))
const lateStats = computed(() => statsOf(recordsOn(lateDays.value)))
const earlyStats = computed(() => statsOf(recordsOn(earlyDays.value)))

interface KpiTrend {
  up: boolean | null
  text: string
}

function makeTrend(cur: number, prev: number): KpiTrend {
  if (prev === 0) return cur === 0 ? { up: null, text: '—' } : { up: true, text: '新增' }
  const pct = ((cur - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return { up: null, text: '持平' }
  return { up: pct > 0, text: `${pct > 0 ? '+' : ''}${pct.toFixed(1).replace(/\.0$/, '')}%` }
}

const formatFee = (fee: number) => `¥${fee.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`

// ===== KPI 卡片 =====
const kpis = computed(() => {
  const w = windowStats.value
  const c = lateStats.value
  const p = earlyStats.value
  return [
    {
      key: 'count',
      label: '记录总数',
      icon: ICON.list,
      value: String(w.count),
      trend: makeTrend(c.count, p.count),
      favorableDown: false,
    },
    {
      key: 'abnormal',
      label: '异常记录',
      icon: ICON.alert,
      value: String(w.abnormal),
      trend: makeTrend(c.abnormal, p.abnormal),
      favorableDown: true,
    },
    {
      key: 'plates',
      label: '涉及车辆',
      icon: ICON.car,
      value: String(w.plates),
      trend: makeTrend(c.plates, p.plates),
      favorableDown: false,
    },
    {
      key: 'fee',
      label: '费用合计',
      icon: ICON.wallet,
      value: formatFee(w.fee),
      trend: makeTrend(c.fee, p.fee),
      favorableDown: false,
    },
  ]
})

// ===== 每日记录柱状图 =====
const daily = computed(() =>
  days.value.map((date) => {
    const list = records.value.filter((r) => r.date === date)
    const abnormal = list.filter((r) => r.abnormal).length
    return {
      date,
      label: date.slice(5).replace('-', '/'),
      total: list.length,
      abnormal,
      normal: list.length - abnormal,
    }
  }),
)
const maxDaily = computed(() => Math.max(1, ...daily.value.map((d) => d.total)))
const barPct = (v: number) => `${((v / maxDaily.value) * 100).toFixed(2)}%`

// ===== 运营指标四宫格 =====
const metrics = computed(() => {
  const w = windowStats.value
  const n = w.count
  const maxFee = records.value.reduce((m, r) => Math.max(m, r.fee), 0)
  return [
    { label: '异常率', icon: ICON.percent, value: n ? `${((w.abnormal / n) * 100).toFixed(1)}%` : '—' },
    { label: '平均费用', icon: ICON.wallet, value: n ? formatFee(w.fee / n) : '—' },
    { label: '单笔最高', icon: ICON.peak, value: n ? formatFee(maxFee) : '—' },
    {
      label: '日均记录',
      icon: ICON.calendar,
      value: days.value.length ? (n / days.value.length).toFixed(1) : '—',
    },
  ]
})

// ===== 最近动态（窗口内最新记录） =====
function describeRecord(r: AbnormalVehicle): string {
  if (r.entryTime && r.exitTime) return `入场 ${r.entryTime} · 出场 ${r.exitTime}`
  if (r.entryTime) return `入场 ${r.entryTime} · 未出场`
  if (r.exitTime) return `出场 ${r.exitTime} · 入场缺失`
  return '出入场时间缺失'
}

const recordTime = (r: AbnormalVehicle) => (r.exitTime ?? r.entryTime ?? '').slice(0, 5)

const activities = computed(() =>
  [...records.value]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.exitTime ?? b.entryTime ?? '').localeCompare(a.exitTime ?? a.entryTime ?? ''),
    )
    .slice(0, 6),
)

// ===== 重点车辆标签统计（按车牌聚合，不随日期筛选变化） =====
function statusOfPlate(rs: AbnormalVehicle[]): ApprovalStatus {
  if (rs.some((r) => store.statusOf(r) === 'blacklisted')) return 'blacklisted'
  if (rs.length > 0 && rs.every((r) => store.statusOf(r) === 'removed')) return 'removed'
  return 'pending'
}

const plateTags = computed(() => {
  const all = store.sourceRecords
  const plates = [...new Set(all.map((r) => r.plate))].filter((p) => p && p !== '-')
  const byPlate = (p: string) => all.filter((r) => r.plate === p)
  const total = plates.length

  const blacklisted = plates.filter((p) => store.isBlacklisted(p))
  const pending = plates.filter((p) => statusOfPlate(byPlate(p)) === 'pending')
  const repeat = plates.filter((p) => byPlate(p).filter((r) => r.abnormal).length >= store.repeatThreshold)
  const highFee = plates.filter((p) => byPlate(p).reduce((sum, r) => sum + r.fee, 0) >= store.highFeeThreshold)

  const mk = (label: string, colorCls: string, list: string[]) => ({
    label,
    colorCls,
    count: list.length,
    pct: `${total ? (list.length / total) * 100 : 0}%`,
  })

  return [
    mk('黑名单', 'bg-status-alert', blacklisted),
    mk('屡次异常', 'bg-accent-deep', repeat),
    mk('高额欠费', 'bg-mint', highFee),
    mk('待审批', 'bg-status-warn', pending),
  ]
})

const totalPlates = computed(() =>
  [...new Set(store.sourceRecords.map((r) => r.plate))].filter((p) => p && p !== '-').length,
)

// ===== 入场动画：卡片渐显上浮 + 柱状图 / 标签条生长 =====
const shown = ref(false)
onMounted(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => (shown.value = true)))
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
          停车场运行概览 · 当前范围 {{ records.length }} 条记录<template v-if="lastDate">
            · 数据截至 {{ lastDate }}</template>
        </p>
      </div>
      <div class="w-full sm:w-80">
        <AppDatePicker v-model="dateRange" mode="range" placeholder="全部日期" />
      </div>
    </header>

    <template v-if="records.length">
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
              <span class="grid size-9 shrink-0 place-items-center rounded-control bg-accent-mist/70 text-accent-deep">
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
            <p class="relative mt-3 text-display font-extrabold tracking-display nums-tabular text-ink">
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
        <div
          class="reveal lg:col-span-2"
          :class="{ 'reveal-in': shown }"
          style="--d: 280ms"
        >
          <AppSurface tone="glass" as="section" class="relative h-full overflow-hidden p-6">
            <span
              class="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/15 blur-orb"
              aria-hidden="true"
            />
            <div class="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-heading font-semibold text-ink">每日记录分布</h2>
                <p class="mt-0.5 text-caption text-ink-muted">按日期统计正常 / 异常记录条数</p>
              </div>
              <div class="flex items-center gap-4 text-micro text-ink-muted">
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2 rounded-full bg-accent" aria-hidden="true" />异常
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2 rounded-full bg-accent-muted" aria-hidden="true" />正常
                </span>
              </div>
            </div>

            <div class="relative mt-6 flex items-end gap-4 sm:gap-8">
              <div
                v-for="(d, i) in daily"
                :key="d.date"
                class="flex flex-1 flex-col items-center gap-2 rounded-control px-1 py-1.5 transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/40"
              >
                <p class="text-micro font-semibold nums-tabular text-ink-muted">{{ d.total }}</p>
                <div
                  class="relative h-40 w-full max-w-14"
                  role="img"
                  :aria-label="`${d.date} 共 ${d.total} 条记录，其中异常 ${d.abnormal} 条`"
                  :title="`${d.date} · 共 ${d.total} 条 / 异常 ${d.abnormal} 条`"
                >
                  <div class="absolute inset-0 flex flex-col justify-end overflow-hidden rounded-t-control">
                    <div
                      class="w-full bg-accent-gradient transition-[height] ease-spring duration-[var(--duration-spring)]"
                      :style="{
                        height: shown ? barPct(d.abnormal) : '0%',
                        transitionDelay: `${400 + i * 80}ms`,
                      }"
                    />
                    <div
                      class="w-full bg-accent-muted/60 transition-[height] ease-spring duration-[var(--duration-spring)]"
                      :style="{
                        height: shown ? barPct(d.normal) : '0%',
                        transitionDelay: `${400 + i * 80}ms`,
                      }"
                    />
                  </div>
                </div>
                <span class="text-caption nums-tabular text-ink-muted">{{ d.label }}</span>
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
        <div
          class="reveal lg:col-span-2"
          :class="{ 'reveal-in': shown }"
          style="--d: 420ms"
        >
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
                :key="`${a.date}~${a.plate}~${a.entryTime}~${a.exitTime}`"
                class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <StatusDot :tone="a.abnormal ? 'alert' : 'ok'" :label="a.abnormal ? '异常' : '正常'" />
                <span class="nums-tabular text-body font-semibold text-ink">{{ a.plate }}</span>
                <span class="text-caption text-ink-soft">{{ describeRecord(a) }}</span>
                <span v-if="store.isBlacklisted(a.plate)" class="chip">黑名单</span>
                <span class="ml-auto flex items-center gap-4">
                  <span class="nums-tabular text-caption font-semibold text-ink">
                    {{ formatFee(a.fee) }}
                  </span>
                  <span class="w-24 text-right text-micro nums-tabular text-ink-faint">
                    {{ a.date.slice(5).replace('-', '/') }} {{ recordTime(a) }}
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
                    <span class="inline-flex items-center gap-2 text-caption font-medium text-ink-soft">
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
                屡次异常 ≥ {{ store.repeatThreshold }} 条异常记录 · 高额欠费为累计费用 ≥ ¥{{ store.highFeeThreshold }}
              </p>
            </div>
          </AppSurface>
        </div>
      </div>
    </template>

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
