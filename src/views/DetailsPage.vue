<script setup lang="ts">
import { computed, ref } from 'vue'
import { useParkStore } from '@/stores/park'
import { AppSurface, AppEmpty, AppSelect, AppDatePicker, StatusDot } from '@/components/ui'
import type { AbnormalVehicle } from '@/data/types'

const store = useParkStore()

// 阈值：>= 此金额视为高额，费用列强调显示
const FEE_EMPHASIS = 100

// ===== 搜索 & 筛选状态 =====
const query = ref('')
// 日期用 AppDatePicker（网站统一日期选择）筛选：null 表示全部日期
const filterDate = ref<string | null>(null)
const filterAbnormal = ref<'all' | 'ok' | 'abnormal'>('all')
const filterTiming = ref<'all' | 'no-entry' | 'no-exit'>('all')

// 筛选区展开/收起（弹簧折叠动画）
const filterOpen = ref(true)

// 可选日期取数据实际出现的区间，作为日期选择器的上下限
const dateOptions = computed<string[]>(() => {
  const seen = new Set<string>()
  for (const r of store.sourceRecords) seen.add(r.date)
  return [...seen].sort()
})

const dateMin = computed(() => dateOptions.value[0] ?? '2000-01-01')
const dateMax = computed(
  () => dateOptions.value[dateOptions.value.length - 1] ?? new Date().toISOString().slice(0, 10),
)

const abnormalSelectOptions = [
  { value: 'all', label: '全部' },
  { value: 'abnormal', label: '仅异常' },
  { value: 'ok', label: '仅正常' },
]

const timingSelectOptions = [
  { value: 'all', label: '全部' },
  { value: 'no-entry', label: '缺入场' },
  { value: 'no-exit', label: '缺出场' },
]

const plateOptions = computed<string[]>(() => {
  const seen = new Set<string>()
  for (const r of store.sourceRecords) seen.add(r.plate)
  return [...seen].sort()
})

const filtered = computed<AbnormalVehicle[]>(() => {
  const q = query.value.trim().toUpperCase()
  return store.sourceRecords.filter((r) => {
    if (q && !r.plate.toUpperCase().includes(q)) return false
    if (filterDate.value && r.date !== filterDate.value) return false
    if (filterAbnormal.value === 'ok' && r.abnormal) return false
    if (filterAbnormal.value === 'abnormal' && !r.abnormal) return false
    if (filterTiming.value === 'no-entry' && r.entryTime) return false
    if (filterTiming.value === 'no-exit' && r.exitTime) return false
    return true
  })
})

const abnormalCount = computed(
  () => filtered.value.filter((r) => r.abnormal).length,
)

// ===== 行内小图标（描边风格，与侧栏一致） =====
const ICON = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  car: '<rect x="3" y="8" width="18" height="9" rx="2.5"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
} as const

const formatFee = (fee: number) => fee.toFixed(2)
const isHighFee = (fee: number) => fee >= FEE_EMPHASIS
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-14">
    <!-- 页面标题 -->
    <header class="mb-8 max-w-xl space-y-2">
      <h1 class="text-title font-bold text-ink">异常车辆明细</h1>
      <p class="text-body text-ink-soft">
        从每日 CSV 汇总的停车场异常车辆记录，支持按车牌检索与条件筛选。
      </p>
    </header>

    <!-- 工具条：搜索 + 筛选（可收起，弹簧折叠动画） -->
    <div class="mb-5">
      <button
        type="button"
        :aria-expanded="filterOpen"
        aria-controls="filter-panel"
        @click="filterOpen = !filterOpen"
        class="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-stroke bg-foam/60 px-3.5 py-2 text-caption font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent-deep"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-3.5 text-ink-muted transition-transform duration-[var(--duration-spring)] ease-spring"
          :class="filterOpen ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          v-html="ICON.chevron"
        />
        {{ filterOpen ? '收起筛选' : '展开筛选' }}
      </button>

      <div id="filter-panel" class="filter-collapse" :class="{ open: filterOpen }">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="relative block">
        <svg
          viewBox="0 0 24 24"
          class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          v-html="ICON.search"
        />
        <input
          v-model="query"
          type="search"
          placeholder="按车牌号搜索"
          class="w-full rounded-control border border-stroke bg-foam/70 py-2.5 pl-10 pr-3.5 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </label>

      <label class="relative block">
        <AppDatePicker
          v-model="filterDate"
          mode="single"
          :min="dateMin"
          :max="dateMax"
          placeholder="全部日期"
        />
      </label>

      <AppSelect v-model="filterAbnormal" label="异常" :options="abnormalSelectOptions" />

      <AppSelect v-model="filterTiming" label="出入场" :options="timingSelectOptions" />
        </div>
      </div>
    </div>

    <!-- 结果统计 -->
    <p class="mb-4 text-caption text-ink-muted">
      共 {{ filtered.length }} 条记录<span v-if="abnormalCount"> · 其中异常 {{ abnormalCount }} 条</span>
    </p>

    <!-- 数据表格 -->
    <AppSurface tone="strong" as="section">
      <div v-if="filtered.length" class="overflow-x-auto">
        <table class="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr class="border-b border-stroke text-caption uppercase tracking-wide text-ink-faint">
              <th class="px-5 py-4 font-medium">日期</th>
              <th class="px-5 py-4 font-medium">车牌号</th>
              <th class="px-5 py-4 font-medium">入场时间</th>
              <th class="px-5 py-4 font-medium">出场时间</th>
              <th class="px-5 py-4 text-right font-medium">费用</th>
              <th class="px-5 py-4 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in filtered"
              :key="`${r.date}~${r.plate}~${i}`"
              class="border-b border-stroke/60 transition-colors last:border-0 hover:bg-accent-mist/30"
            >
              <td class="whitespace-nowrap px-5 py-3.5 text-caption text-ink-muted">{{ r.date }}</td>
              <td class="whitespace-nowrap px-5 py-3.5">
                <span class="inline-flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    class="size-4 text-accent-muted"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    v-html="ICON.car"
                  />
                  <span class="nums-tabular font-medium text-ink">{{ r.plate }}</span>
                </span>
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 nums-tabular text-body text-ink-soft">
                {{ r.entryTime ?? '—' }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 nums-tabular text-body text-ink-soft">
                {{ r.exitTime ?? '—' }}
              </td>
              <td
                class="whitespace-nowrap px-5 py-3.5 text-right nums-tabular"
                :class="isHighFee(r.fee) ? 'font-semibold text-accent-deep' : 'text-ink-soft'"
              >
                ¥{{ formatFee(r.fee) }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5">
                <span class="inline-flex items-center gap-1.5 text-caption">
                  <StatusDot :tone="r.abnormal ? 'alert' : 'ok'" />
                  <span :class="r.abnormal ? 'text-status-alert' : 'text-status-ok'">
                    {{ r.abnormal ? '异常' : '正常' }}
                  </span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppEmpty
        v-else
        :icon="ICON.alert"
        title="没有匹配的记录"
        :hint="query ? '换个车牌号试试' : '当前筛选条件下没有数据'"
      />
    </AppSurface>

    <!-- 车牌速览（有图标，用于快速定位） -->
    <section class="mt-6">
      <h2 class="mb-3 text-heading font-semibold text-ink">车牌速览</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="plate in plateOptions"
          :key="plate"
          type="button"
          @click="query = plate"
          class="inline-flex items-center gap-1.5 rounded-pill border border-stroke bg-foam/60 px-3 py-1.5 text-caption text-ink-soft transition-colors hover:border-accent hover:text-accent-deep"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-3.5 text-ink-faint"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            v-html="ICON.car"
          />
          {{ plate }}
        </button>
      </div>
    </section>
  </main>
</template>