<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useParkStore } from '@/stores/park'
import {
  AppButton,
  AppStatusChip,
  AppSurface,
  AppEmpty,
  AppDatePicker,
  AppPagination,
  StatusDot,
} from '@/components/ui'
import BlacklistQuickRemove from '@/components/BlacklistQuickRemove.vue'
import type { RecordStatus } from '@/data/types'

const store = useParkStore()

// ===== 图标（描边风格） =====
const ICON = {
  car: '<rect x="3" y="8" width="18" height="9" rx="2.5"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  trash:
    '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M7 7l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  download: '<path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-4"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
} as const

// ===== 日期范围筛选（AppDatePicker，range 模式）→ /api/plate-groups 参数 =====
const dateRange = ref<readonly [string, string] | null>(null)
const groupsPage = ref(1)

onMounted(() => {
  void refresh()
})

watch(dateRange, () => {
  groupsPage.value = 1
  void refresh()
})

function refresh() {
  return store.fetchPlateGroups({
    page: groupsPage.value,
    pageSize: 10,
    from: dateRange.value?.[0],
    to: dateRange.value?.[1],
  })
}

function onPage(page: number) {
  groupsPage.value = page
  void refresh()
}

const groups = computed(() => store.plateGroups?.groups ?? [])
const totalGroups = computed(() => store.plateGroups?.total ?? 0)
const visibleCount = computed(() => groups.value.reduce((sum, g) => sum + g.count, 0))
const hasFilter = computed(() => dateRange.value !== null)

/**
 * 车牌级审批状态映射（D1 status）：有已处理（1）记录 → 已处理；
 * 全部误报（2）→ 误报；否则未处理。
 */
function groupStatus(g: { processed: number; misreported: number; count: number }): RecordStatus {
  if (g.processed > 0) return 1
  if (g.count > 0 && g.misreported === g.count) return 2
  return 0
}

// ===== 待提交队列：动作先入队（同车牌覆盖、再点取消），统一由底部提交栏落库 =====
type PendingAction = 'blacklist' | 'unblacklist' | 'remove' | 'restore'

const PENDING_LABELS: Record<PendingAction, string> = {
  blacklist: '加入黑名单',
  unblacklist: '移出黑名单',
  remove: '移除（误报）',
  restore: '恢复',
}

const pending = ref(new Map<string, { action: PendingAction; remark?: string }>())

// ===== 队列暂存（sessionStorage）：刷新 / 会话过期切登录页后可恢复，防止已排好的动作丢失 =====
const QUEUE_KEY = 'park:approval-queue'
const QUEUE_MAX = 200
const PENDING_ACTIONS: readonly PendingAction[] = ['blacklist', 'unblacklist', 'remove', 'restore']

function loadQueue(): Map<string, { action: PendingAction; remark?: string }> {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY)
    if (!raw) return new Map()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Map()
    const map = new Map<string, { action: PendingAction; remark?: string }>()
    for (const pair of parsed.slice(0, QUEUE_MAX)) {
      const plate = Array.isArray(pair) && typeof pair[0] === 'string' ? pair[0] : ''
      const entry = Array.isArray(pair) ? (pair[1] as { action?: unknown; remark?: unknown }) : null
      if (!plate || !entry || !PENDING_ACTIONS.includes(entry.action as PendingAction)) continue
      map.set(plate, {
        action: entry.action as PendingAction,
        remark: typeof entry.remark === 'string' ? entry.remark : undefined,
      })
    }
    return map
  } catch {
    return new Map()
  }
}

pending.value = loadQueue()

watch(pending, (map) => {
  try {
    if (map.size === 0) sessionStorage.removeItem(QUEUE_KEY)
    else sessionStorage.setItem(QUEUE_KEY, JSON.stringify([...map.entries()]))
  } catch {
    // 存储不可用（隐私模式等）时队列仅存内存，不影响本页使用
  }
})

/** 有未提交动作时关页 / 刷新前让浏览器弹确认 */
function warnUnsavedActions(event: BeforeUnloadEvent) {
  if (pending.value.size === 0) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', warnUnsavedActions))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnsavedActions))

/** 由当前库内状态推导目标动作；同车牌再点同一动作 = 取消，不同动作 = 覆盖 */
function queueAction(plate: string, action: PendingAction, remark?: string) {
  const map = new Map(pending.value)
  if (map.get(plate)?.action === action) map.delete(plate)
  else map.set(plate, { action, remark })
  pending.value = map
}

function onBlacklistClick(g: { carNumber: string; processed: number }) {
  queueAction(g.carNumber, g.processed > 0 ? 'unblacklist' : 'blacklist')
}

function onRemoveClick(g: {
  carNumber: string
  processed: number
  count: number
  misreported: number
}) {
  if (groupStatus(g) === 2) {
    queueAction(g.carNumber, 'restore')
    return
  }
  askRemove(g.carNumber)
}

const removingPlate = ref<string | null>(null)
const removingRemark = ref('')
const removingError = ref('')

function askRemove(plate: string) {
  removingPlate.value = plate
  removingRemark.value = ''
  removingError.value = ''
}

function cancelRemove() {
  removingPlate.value = null
  removingError.value = ''
}

const removingInvalid = computed(
  () => removingPlate.value !== null && removingRemark.value.trim() === '',
)

/** 移除确认 → 入队（不直接落库），误报必填备注 */
function confirmRemove() {
  const plate = removingPlate.value
  if (!plate || removingInvalid.value) return
  queueAction(plate, 'remove', removingRemark.value.trim())
  cancelRemove()
}

// ===== 提交 / 放弃 =====
const committing = ref(false)
const commitError = ref('')
const commitMsg = ref('')

async function commitPending() {
  if (committing.value || pending.value.size === 0) return
  committing.value = true
  commitError.value = ''
  try {
    const actions = [...pending.value.entries()].map(([plate, p]) => ({
      plate,
      to: (p.action === 'blacklist'
        ? 1
        : p.action === 'unblacklist'
          ? 0
          : p.action === 'remove'
            ? 2
            : 0) as RecordStatus,
      from: (p.action === 'blacklist'
        ? 0
        : p.action === 'unblacklist'
          ? 1
          : p.action === 'restore'
            ? 2
            : undefined) as RecordStatus | undefined,
      remark: p.remark,
    }))
    const changed = await store.applyPlateActions(actions)
    commitMsg.value = `已提交 ${actions.length} 台车辆的审批，更新 ${changed} 条记录`
    pending.value = new Map()
    window.setTimeout(() => (commitMsg.value = ''), 3200)
  } catch (err) {
    commitError.value = err instanceof Error ? err.message : '提交失败，请重试'
  } finally {
    committing.value = false
  }
}

function discardPending() {
  pending.value = new Map()
  commitError.value = ''
}

// ===== 记录明细默认收纳，点击展开 =====
const expanded = reactive(new Set<string>())

function toggleRecords(plate: string) {
  if (expanded.has(plate)) expanded.delete(plate)
  else expanded.add(plate)
}

// ===== 黑名单信息导出（CSV，按需分页拉取 status=1 的全部记录） =====
const exporting = ref(false)

async function exportBlacklist() {
  if (exporting.value) return
  exporting.value = true
  try {
    const rows = await store.fetchBlacklistRecords()
    const csvRows = [
      ['入场时间', '出场时间', '车牌号', '用户需支付费用', '可疑'],
      ...rows.map((r) => [
        r.entryTime ?? '-',
        r.exitTime,
        r.carNumber,
        r.fee === null ? '-' : String(r.fee),
        r.isSuspicious ? '1' : '0',
      ]),
    ]
    const csv = '\uFEFF' + csvRows.map((row) => row.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `黑名单_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

const formatFee = (fee: number) => `¥${fee.toFixed(2)}`
const timePart = (value: string | null) => (value ? value.slice(11, 16) : '—')
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-14">
    <header class="mb-8 max-w-xl space-y-2">
      <h1 class="text-title font-bold text-ink">车辆审批</h1>
      <p class="text-body text-ink-soft">
        对异常车辆逐台审批：加入黑名单（标记已处理）或移除（标记误报，需填写备注原因）。动作先入待提交队列，点击底部「提交更改」一次性落库。
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- 审批列表 -->
      <section class="lg:col-span-2">
        <!-- 日期范围筛选工具条 -->
        <div class="mb-4 flex flex-wrap items-center gap-2.5">
          <span class="text-caption font-medium text-ink-muted">审批日期</span>
          <AppDatePicker v-model="dateRange" mode="range" size="small" placeholder="全部日期" />
          <span v-if="hasFilter" class="text-caption text-ink-muted">
            范围内 {{ visibleCount }} 条记录 · {{ totalGroups }} 台车辆
          </span>
          <AppButton
            v-if="hasFilter"
            tone="ghost"
            small
            :icon="ICON.undo"
            @click="dateRange = null"
          >
            清空筛选
          </AppButton>
        </div>

        <p v-if="store.plateGroupsError" class="mb-4 text-caption text-status-alert">
          {{ store.plateGroupsError }}
        </p>

        <div
          v-if="groups.length"
          class="space-y-4 transition-opacity"
          :class="store.plateGroupsLoading ? 'opacity-50' : 'opacity-100'"
        >
          <AppSurface v-for="g in groups" :key="g.carNumber" tone="strong" as="section" class="p-5">
            <!-- 分组头部（整行可点击展开/收起） -->
            <div
              class="flex cursor-pointer select-none flex-wrap items-center gap-3"
              role="button"
              tabindex="0"
              :aria-expanded="expanded.has(g.carNumber)"
              @click="toggleRecords(g.carNumber)"
              @keydown.enter.prevent="toggleRecords(g.carNumber)"
              @keydown.space.prevent="toggleRecords(g.carNumber)"
            >
              <span
                class="flex size-6 shrink-0 items-center justify-center rounded-control text-ink-muted transition-transform duration-300"
                :class="expanded.has(g.carNumber) ? 'rotate-180' : ''"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  v-html="ICON.chevron"
                />
              </span>
              <svg
                viewBox="0 0 24 24"
                class="size-5 shrink-0 text-accent-muted"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                v-html="ICON.car"
              />
              <span class="nums-tabular text-heading font-semibold text-ink">{{
                g.carNumber
              }}</span>
              <span class="text-caption text-ink-muted">{{ g.count }} 条记录</span>
              <AppStatusChip :status="groupStatus(g)" />
              <!-- 待提交徽标：动作已入队，尚未落库 -->
              <span v-if="pending.get(g.carNumber)" class="chip">
                待提交：{{ PENDING_LABELS[pending.get(g.carNumber)!.action] }}
              </span>
              <div class="ml-auto flex gap-2" @click.stop>
                <AppButton
                  :tone="groupStatus(g) === 1 ? 'soft' : 'danger'"
                  small
                  :icon="groupStatus(g) === 1 ? ICON.shield : ICON.ban"
                  :disabled="groupStatus(g) === 2"
                  @click="onBlacklistClick(g)"
                >
                  {{ groupStatus(g) === 1 ? '移出黑名单' : '加入黑名单' }}
                </AppButton>
                <AppButton
                  :tone="groupStatus(g) === 2 ? 'primary' : 'ghost'"
                  small
                  :icon="groupStatus(g) === 2 ? ICON.undo : ICON.trash"
                  @click="onRemoveClick(g)"
                >
                  {{ groupStatus(g) === 2 ? '恢复' : '移除' }}
                </AppButton>
              </div>
            </div>

            <!-- 移除确认：误报必须填写备注原因（随队列统一落库） -->
            <div
              v-if="removingPlate === g.carNumber"
              class="mt-4 rounded-control border border-stroke bg-accent-mist/20 p-4"
            >
              <label class="block text-caption text-ink-soft">
                移除原因（误报备注，必填）
                <textarea
                  v-model="removingRemark"
                  rows="2"
                  placeholder="如：确认为正常缴费，检测误判"
                  class="mt-1 w-full resize-none rounded-control border border-stroke bg-foam/70 px-3 py-2 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
              </label>
              <p v-if="removingError" class="mt-2 text-caption text-status-alert">
                {{ removingError }}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <AppButton
                  tone="danger"
                  small
                  :icon="ICON.trash"
                  :disabled="removingInvalid"
                  @click="confirmRemove"
                >
                  加入待提交
                </AppButton>
                <AppButton tone="ghost" small :icon="ICON.x" @click="cancelRemove">取消</AppButton>
              </div>
            </div>

            <!-- 分组内记录明细（默认收纳，展开时线性滑出并自然推移下方方框） -->
            <div class="records-wrap" :class="expanded.has(g.carNumber) ? 'records-open' : ''">
              <ul class="min-h-0 divide-y divide-stroke/60 overflow-hidden pt-4">
                <li
                  v-for="r in g.records"
                  :key="r.id"
                  class="flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5 text-caption"
                >
                  <span class="text-ink-muted">{{ r.logDate }}</span>
                  <span class="nums-tabular text-ink-soft">
                    {{ timePart(r.entryTime) }} → {{ timePart(r.exitTime) }}
                  </span>
                  <span class="nums-tabular font-medium text-ink">
                    {{ r.fee === null ? '—' : formatFee(r.fee) }}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <StatusDot :tone="r.isSuspicious ? 'alert' : 'ok'" />
                    <span :class="r.isSuspicious ? 'text-status-alert' : 'text-status-ok'">
                      {{ r.isSuspicious ? '可疑' : '一般' }}
                    </span>
                  </span>
                  <span v-if="r.status === 2" class="ml-auto text-ink-faint">误报</span>
                  <span v-else-if="r.status === 1" class="ml-auto text-ink-faint">已处理</span>
                </li>
              </ul>
            </div>
          </AppSurface>
        </div>

        <AppEmpty
          v-else-if="!store.plateGroupsLoading"
          :icon="ICON.alert"
          :title="hasFilter ? '该日期范围内暂无待审批车辆' : '暂无待审批车辆'"
          :hint="hasFilter ? '试试调整或清空日期筛选' : '所有异常车辆都已处理完毕'"
        />
        <AppEmpty v-else :icon="ICON.alert" title="数据加载中…" hint="正在从数据库读取分组" />

        <AppSurface v-if="groups.length" tone="strong" as="section" class="mt-4">
          <AppPagination
            :page="store.plateGroups?.page ?? 1"
            :page-size="store.plateGroups?.pageSize ?? 10"
            :total="totalGroups"
            unit="台车辆"
            @update="onPage"
          />
        </AppSurface>
      </section>

      <!-- 黑名单侧栏：跟随视口固定，不随列表滑动；整栏限高内部滚动兜底 -->
      <aside
        class="scrollbar-slim lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overscroll-contain lg:self-start lg:overflow-y-auto"
      >
        <AppSurface tone="glass" as="section" class="p-5">
          <div class="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              class="size-4 text-status-alert"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              v-html="ICON.shield"
            />
            <h2 class="text-heading font-semibold text-ink">黑名单</h2>
          </div>
          <p class="mt-1 text-caption text-ink-muted">
            共 {{ store.blacklistedPlates.length }} 台车辆（有已处理记录的车牌）
          </p>

          <div class="mt-4">
            <AppButton
              tone="primary"
              class="w-full"
              :icon="ICON.download"
              :disabled="store.blacklistedPlates.length === 0 || exporting"
              @click="exportBlacklist"
            >
              导出黑名单信息
            </AppButton>
          </div>

          <ul
            v-if="store.blacklistedPlates.length"
            class="scrollbar-slim mt-5 max-h-[40vh] space-y-2 overflow-y-auto pr-1"
          >
            <li
              v-for="plate in store.blacklistedPlates"
              :key="plate"
              class="flex items-center gap-2 rounded-control border border-stroke bg-foam/40 px-3 py-2"
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
              <span class="nums-tabular text-body text-ink">{{ plate }}</span>
            </li>
          </ul>

          <p v-else class="mt-5 text-caption text-ink-faint">还没有加入黑名单的车辆。</p>
        </AppSurface>

        <BlacklistQuickRemove />
      </aside>
    </div>

    <!-- 待提交栏：动作入队后弹簧滑入，统一提交避免高频写库 -->
    <Transition name="commit-bar">
      <AppSurface
        v-if="pending.size > 0"
        tone="strong"
        class="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
      >
        <span class="inline-flex items-center gap-2">
          <StatusDot tone="warn" />
          <span class="text-body font-semibold text-ink"> {{ pending.size }} 台车辆待提交 </span>
          <span class="text-caption text-ink-muted">
            {{ [...pending.values()].map((p) => PENDING_LABELS[p.action]).join(' · ') }}
          </span>
        </span>
        <div class="ml-auto flex items-center gap-2">
          <AppButton
            tone="ghost"
            small
            :icon="ICON.x"
            :disabled="committing"
            @click="discardPending"
          >
            放弃
          </AppButton>
          <AppButton
            tone="primary"
            small
            :icon="ICON.check"
            :disabled="committing"
            @click="commitPending"
          >
            {{ committing ? '提交中…' : '提交更改' }}
          </AppButton>
        </div>
        <p v-if="commitError" class="w-full text-caption text-status-alert">{{ commitError }}</p>
        <p v-else-if="commitMsg" class="w-full text-caption text-status-ok">{{ commitMsg }}</p>
      </AppSurface>
    </Transition>
  </main>
</template>

<style scoped>
.records-wrap {
  display: grid;
  grid-template-rows: 0fr;
  /* 弹簧式缓动：缓起缓停，无回弹 */
  transition: grid-template-rows 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.records-wrap.records-open {
  grid-template-rows: 1fr;
}
.records-wrap > ul {
  min-height: 0;
  overflow: hidden;
}

/* 提交栏滑入滑出：位移用线性弹簧，与全站动效同一套曲线 */
.commit-bar-enter-active,
.commit-bar-leave-active {
  transition:
    opacity var(--duration-spring) var(--ease-spring),
    transform var(--duration-spring) var(--ease-spring);
}
.commit-bar-enter-from,
.commit-bar-leave-to {
  opacity: 0;
  transform: translateY(18px);
}
.commit-bar-enter-to,
.commit-bar-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
