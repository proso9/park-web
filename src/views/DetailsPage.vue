<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useParkStore } from '@/stores/park'
import {
  AppSurface,
  AppEmpty,
  AppSelect,
  AppDatePicker,
  AppPagination,
  AppStatusChip,
  AppButton,
  StatusDot,
} from '@/components/ui'
import type { AnomalyRecord, RecordStatus } from '@/data/types'

const store = useParkStore()

// 阈值：>= 此金额视为高额，费用列强调显示
const FEE_EMPHASIS = 100

// ===== 搜索 & 筛选状态（全部作为 /api/records 请求参数） =====
const query = ref('')
// 日期范围（AppDatePicker range 模式），null 表示全部日期
const dateRange = ref<readonly [string, string] | null>(null)
// AppSelect 的 model 是 string，状态值在此映射回数字
const filterStatus = ref<'all' | '0' | '1' | '2'>('all')
const filterSuspicious = ref<'all' | 'suspicious' | 'normal'>('all')
const filterTiming = ref<'all' | 'no-entry'>('all')

// 筛选区展开/收起（弹簧折叠动画）
const filterOpen = ref(true)

const statusSelectOptions = [
  { value: 'all', label: '全部' },
  { value: '0', label: '未处理' },
  { value: '1', label: '已处理' },
  { value: '2', label: '误报' },
]

const suspiciousSelectOptions = [
  { value: 'all', label: '全部' },
  { value: 'suspicious', label: '仅可疑' },
  { value: 'normal', label: '仅一般' },
]

const timingSelectOptions = [
  { value: 'all', label: '全部' },
  { value: 'no-entry', label: '缺入场' },
]

function currentQuery(page = 1) {
  return {
    page,
    pageSize: 20,
    plate: query.value.trim() || undefined,
    from: dateRange.value?.[0],
    to: dateRange.value?.[1],
    status: filterStatus.value === 'all' ? undefined : (Number(filterStatus.value) as RecordStatus),
    suspicious:
      filterSuspicious.value === 'all'
        ? undefined
        : filterSuspicious.value === 'suspicious'
          ? (1 as const)
          : (0 as const),
    entryMissing: filterTiming.value === 'no-entry' || undefined,
  }
}

// 筛选变化回第一页；车牌输入 300ms 防抖
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch([filterStatus, filterSuspicious, filterTiming, dateRange], () => {
  void store.fetchRecords(currentQuery(1))
})

watch(query, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void store.fetchRecords(currentQuery(1))
  }, 300)
})

onMounted(() => {
  void store.fetchRecords(currentQuery(1))
  void store.fetchAllPlates()
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

function onPage(page: number) {
  void store.fetchRecords(currentQuery(page))
}

// ===== 行内人工处理（只允许 status / remark） =====
const editId = ref<number | null>(null)
const editDraft = reactive<{ status: '0' | '1' | '2'; remark: string }>({
  status: '0',
  remark: '',
})
const editSaving = ref(false)
const editError = ref('')

function startEdit(r: AnomalyRecord) {
  editId.value = r.id
  editDraft.status = String(r.status) as '0' | '1' | '2'
  editDraft.remark = r.remark ?? ''
  editError.value = ''
}

function cancelEdit() {
  editId.value = null
  editError.value = ''
}

/** 误报必须填备注（db.txt 约定） */
/** 误报必须填备注（db.txt 约定） */
const editRemarkRequired = computed(
  () => editDraft.status === '2' && editDraft.remark.trim() === '',
)
const editInvalid = editRemarkRequired

async function saveEdit() {
  if (editId.value === null || editInvalid.value || editSaving.value) return
  editSaving.value = true
  editError.value = ''
  try {
    await store.updateRecord(editId.value, {
      status: Number(editDraft.status) as RecordStatus,
      remark: editDraft.remark.trim() === '' ? null : editDraft.remark.trim(),
    })
    cancelEdit()
  } catch (err) {
    editError.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    editSaving.value = false
  }
}

// ===== 行内小图标（描边风格，与侧栏一致） =====
const ICON = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  car: '<rect x="3" y="8" width="18" height="9" rx="2.5"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9a2 2 0 000-3l-1-1a2 2 0 00-3 0L4 16z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
} as const

const formatFee = (fee: number) => fee.toFixed(2)
const isHighFee = (fee: number) => fee >= FEE_EMPHASIS

/** 全时间戳里取 HH:mm 展示；NULL 显示 — */
const timePart = (value: string | null) => (value ? value.slice(11, 16) : '—')
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-14">
    <!-- 页面标题 -->
    <header class="mb-8 max-w-xl space-y-2">
      <h1 class="text-title font-bold text-ink">异常车辆明细</h1>
      <p class="text-body text-ink-soft">
        来自 D1 数据库的异常车辆记录，支持按车牌检索、条件筛选与人工处理（状态 / 备注）。
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
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <AppDatePicker v-model="dateRange" mode="range" placeholder="全部日期" />
          </label>

          <AppSelect v-model="filterStatus" label="状态" :options="statusSelectOptions" />

          <AppSelect v-model="filterSuspicious" label="可疑" :options="suspiciousSelectOptions" />

          <AppSelect v-model="filterTiming" label="入场" :options="timingSelectOptions" />
        </div>
      </div>
    </div>

    <p v-if="store.recordsError" class="mb-4 text-caption text-status-alert">
      {{ store.recordsError }}
    </p>

    <!-- 数据表格（服务端分页） -->
    <AppSurface tone="strong" as="section" class="overflow-hidden">
      <div v-if="store.records.length" class="overflow-x-auto">
        <table
          class="w-full min-w-[860px] border-collapse text-left transition-opacity"
          :class="store.recordsLoading ? 'opacity-50' : 'opacity-100'"
        >
          <thead>
            <tr class="border-b border-stroke text-caption uppercase tracking-wide text-ink-faint">
              <th class="px-5 py-4 font-medium">日期</th>
              <th class="px-5 py-4 font-medium">车牌号</th>
              <th class="px-5 py-4 font-medium">入场</th>
              <th class="px-5 py-4 font-medium">出场</th>
              <th class="px-5 py-4 text-right font-medium">费用</th>
              <th class="px-5 py-4 font-medium">可疑</th>
              <th class="px-5 py-4 font-medium">状态</th>
              <th class="px-5 py-4 font-medium">备注</th>
              <th class="px-5 py-4 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in store.records" :key="r.id">
              <tr class="border-b border-stroke/60 transition-colors hover:bg-accent-mist/30">
                <td class="whitespace-nowrap px-5 py-3.5 text-caption text-ink-muted">
                  {{ r.logDate }}
                </td>
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
                    <span class="nums-tabular font-medium text-ink">{{ r.carNumber }}</span>
                  </span>
                </td>
                <td class="whitespace-nowrap px-5 py-3.5 nums-tabular text-body text-ink-soft">
                  {{ timePart(r.entryTime) }}
                </td>
                <td class="whitespace-nowrap px-5 py-3.5 nums-tabular text-body text-ink-soft">
                  {{ timePart(r.exitTime) }}
                </td>
                <td
                  class="whitespace-nowrap px-5 py-3.5 text-right nums-tabular"
                  :class="
                    r.fee !== null && isHighFee(r.fee)
                      ? 'font-semibold text-accent-deep'
                      : 'text-ink-soft'
                  "
                >
                  {{ r.fee === null ? '—' : `¥${formatFee(r.fee)}` }}
                </td>
                <td class="whitespace-nowrap px-5 py-3.5">
                  <span class="inline-flex items-center gap-1.5 text-caption">
                    <StatusDot :tone="r.isSuspicious ? 'alert' : 'ok'" />
                    <span :class="r.isSuspicious ? 'text-status-alert' : 'text-status-ok'">
                      {{ r.isSuspicious ? '可疑' : '一般' }}
                    </span>
                  </span>
                </td>
                <td class="whitespace-nowrap px-5 py-3.5">
                  <AppStatusChip :status="r.status" />
                </td>
                <td
                  class="max-w-40 truncate px-5 py-3.5 text-caption text-ink-muted"
                  :title="r.remark ?? ''"
                >
                  {{ r.remark ?? '—' }}
                </td>
                <td class="whitespace-nowrap px-5 py-3.5 text-right">
                  <AppButton
                    tone="ghost"
                    small
                    :icon="ICON.edit"
                    @click="editId === r.id ? cancelEdit() : startEdit(r)"
                  >
                    {{ editId === r.id ? '取消' : '处理' }}
                  </AppButton>
                </td>
              </tr>

              <!-- 行内处理面板：状态下拉 + 备注 -->
              <tr v-if="editId === r.id" class="border-b border-stroke/60 bg-accent-mist/20">
                <td colspan="9" class="px-5 py-4">
                  <div class="flex flex-wrap items-start gap-3">
                    <label class="flex items-center gap-2 text-caption text-ink-soft">
                      状态
                      <select
                        v-model="editDraft.status"
                        class="rounded-control border border-stroke bg-foam/70 px-3 py-2 text-body text-ink focus:border-accent focus:outline-none"
                      >
                        <option value="0">未处理</option>
                        <option value="1">已处理</option>
                        <option value="2">误报</option>
                      </select>
                    </label>
                    <label class="min-w-64 flex-1 text-caption text-ink-soft">
                      备注<span v-if="editRemarkRequired" class="text-status-alert"
                        >（误报必填原因）</span
                      >
                      <input
                        v-model="editDraft.remark"
                        type="text"
                        placeholder="处理说明，如：确认为误报，道闸故障"
                        class="mt-1 w-full rounded-control border border-stroke bg-foam/70 px-3 py-2 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                      />
                    </label>
                    <div class="flex items-center gap-2 self-end">
                      <AppButton
                        tone="primary"
                        small
                        :icon="ICON.check"
                        :disabled="editInvalid || editSaving"
                        @click="saveEdit"
                      >
                        保存
                      </AppButton>
                      <AppButton tone="ghost" small :icon="ICON.x" @click="cancelEdit"
                        >取消</AppButton
                      >
                    </div>
                  </div>
                  <p v-if="editError" class="mt-2 text-caption text-status-alert">
                    {{ editError }}
                  </p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <AppEmpty
        v-else-if="!store.recordsLoading"
        :icon="ICON.alert"
        title="没有匹配的记录"
        :hint="query ? '换个车牌号试试' : '当前筛选条件下没有数据'"
      />
      <AppEmpty v-else :icon="ICON.alert" title="加载中…" hint="正在从数据库读取记录" />

      <AppPagination
        :page="store.recordsPage"
        :page-size="store.recordsPageSize"
        :total="store.recordsTotal"
        @update="onPage"
      />
    </AppSurface>

    <!-- 车牌速览（有图标，用于快速定位） -->
    <section class="mt-6">
      <h2 class="mb-3 text-heading font-semibold text-ink">车牌速览</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="plate in store.allPlates"
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
