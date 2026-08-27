<script setup lang="ts">
import { computed } from 'vue'
import { useParkStore } from '@/stores/park'
import { AppButton, AppStatusChip, AppSurface, AppEmpty, StatusDot } from '@/components/ui'
import type { AbnormalVehicle, ApprovalStatus } from '@/data/types'

const store = useParkStore()

// ===== 图标（描边风格） =====
const ICON = {
  car: '<rect x="3" y="8" width="18" height="9" rx="2.5"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M7 7l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  download: '<path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-4"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
} as const

// ===== 按车牌聚合，用于审批分组 =====
interface VehicleGroup {
  plate: string
  records: AbnormalVehicle[]
  status: ApprovalStatus
}

const groups = computed<VehicleGroup[]>(() => {
  const map = new Map<string, AbnormalVehicle[]>()
  for (const r of store.sourceRecords) {
    const list = map.get(r.plate)
    if (list) list.push(r)
    else map.set(r.plate, [r])
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([plate, records]) => ({ plate, records, status: groupStatus(records) }))
})

function groupStatus(records: AbnormalVehicle[]): ApprovalStatus {
  if (records.some((r) => store.statusOf(r) === 'blacklisted')) return 'blacklisted'
  if (records.every((r) => store.statusOf(r) === 'removed')) return 'removed'
  return 'pending'
}

// ===== 操作（可再点恢复） =====
function toggleBlacklist(plate: string) {
  store.toggleBlacklist(plate)
}

function toggleRemove(plate: string) {
  store.toggleRemove(plate)
}

// ===== 黑名单信息导出（CSV） =====
function exportBlacklist() {
  const rows = [
    ['入场时间', '出场时间', '车牌号', '用户需支付费用', '异常'],
    ...store.blacklistRecords.map((r) => [
      r.entryTime ?? '-',
      r.exitTime ?? '-',
      r.plate,
      String(r.fee),
      r.abnormal ? '1' : '0',
    ]),
  ]
  const csv = '\uFEFF' + rows.map((row) => row.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `黑名单_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const formatFee = (fee: number) => `¥${fee.toFixed(2)}`
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-14">
    <header class="mb-8 max-w-xl space-y-2">
      <h1 class="text-title font-bold text-ink">车辆审批</h1>
      <p class="text-body text-ink-soft">
        对异常车辆逐台审批：加入黑名单（可一键导出黑名单信息）或移除，结果实时同步并本地保留。
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- 审批列表 -->
      <section class="lg:col-span-2">
        <div v-if="groups.length" class="space-y-4">
          <AppSurface
            v-for="g in groups"
            :key="g.plate"
            tone="strong"
            as="section"
            class="p-5"
          >
            <!-- 分组头部 -->
            <div class="flex flex-wrap items-center gap-3">
              <svg
                viewBox="0 0 24 24"
                class="size-5 shrink-0 text-accent-muted"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="ICON.car"
              />
              <span class="nums-tabular text-heading font-semibold text-ink">{{ g.plate }}</span>
              <span class="text-caption text-ink-muted">{{ g.records.length }} 条记录</span>
              <AppStatusChip :status="g.status" />
              <div class="ml-auto flex gap-2">
                <AppButton
                  :tone="g.status === 'blacklisted' ? 'soft' : 'danger'"
                  small
                  :icon="g.status === 'blacklisted' ? ICON.shield : ICON.ban"
                  :disabled="g.status === 'removed'"
                  @click="toggleBlacklist(g.plate)"
                >
                  {{ g.status === 'blacklisted' ? '移出黑名单' : '加入黑名单' }}
                </AppButton>
                <AppButton
                  :tone="g.status === 'removed' ? 'primary' : 'ghost'"
                  small
                  :icon="g.status === 'removed' ? ICON.undo : ICON.trash"
                  @click="toggleRemove(g.plate)"
                >
                  {{ g.status === 'removed' ? '恢复' : '移除' }}
                </AppButton>
              </div>
            </div>

            <!-- 分组内记录明细 -->
            <ul class="mt-4 divide-y divide-stroke/60">
              <li
                v-for="(r, i) in g.records"
                :key="`${r.date}~${i}`"
                class="flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5 text-caption"
              >
                <span class="text-ink-muted">{{ r.date }}</span>
                <span class="nums-tabular text-ink-soft">{{ r.entryTime ?? '—' }} → {{ r.exitTime ?? '—' }}</span>
                <span class="nums-tabular font-medium text-ink">{{ formatFee(r.fee) }}</span>
                <span class="inline-flex items-center gap-1.5">
                  <StatusDot :tone="r.abnormal ? 'alert' : 'ok'" />
                  <span :class="r.abnormal ? 'text-status-alert' : 'text-status-ok'">
                    {{ r.abnormal ? '异常' : '正常' }}
                  </span>
                </span>
                <span v-if="store.statusOf(r) === 'removed'" class="ml-auto text-ink-faint">已移除</span>
              </li>
            </ul>
          </AppSurface>
        </div>

        <AppEmpty
          v-else
          :icon="ICON.alert"
          title="暂无待审批车辆"
          hint="所有异常车辆都已处理完毕"
        />
      </section>

      <!-- 黑名单侧栏 -->
      <aside>
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
            共 {{ store.blacklistedPlates.length }} 台车辆
          </p>

          <div class="mt-4">
            <AppButton
              tone="primary"
              class="w-full"
              :icon="ICON.download"
              :disabled="store.blacklistRecords.length === 0"
              @click="exportBlacklist"
            >
              导出黑名单信息
            </AppButton>
          </div>

          <ul v-if="store.blacklistedPlates.length" class="mt-5 space-y-2">
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
      </aside>
    </div>
  </main>
</template>