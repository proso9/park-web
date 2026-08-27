import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { loadAllVehicles } from '@/data/parse'
import type { AbnormalVehicle, ApprovalStatus } from '@/data/types'

const STORAGE_KEY = 'park:approval-state'

interface PersistedState {
  status: Record<string, ApprovalStatus>
  plates: string[]
}

/** 一条记录的唯一标识：日期 + 牌号 + 出入场时间，容错缺失时间 */
function recordKey(r: AbnormalVehicle): string {
  return [r.date, r.plate, r.entryTime ?? '-', r.exitTime ?? '-'].join('~')
}

/** 读取本地持久化的审批状态，损坏/缺失时回退为空 */
function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { status: {}, plates: [] }
    const parsed = JSON.parse(raw) as PersistedState
    return {
      status: parsed.status ?? {},
      plates: Array.isArray(parsed.plates) ? parsed.plates : [],
    }
  } catch {
    return { status: {}, plates: [] }
  }
}

export const useParkStore = defineStore('park', () => {
  // 静态源数据（构建期从 src/data/*.csv 解析），审批状态按记录 key 叠加其上
  const sourceRecords = computed<AbnormalVehicle[]>(() => loadAllVehicles())

  const persisted = loadPersisted()
  const statusMap = ref<Record<string, ApprovalStatus>>(persisted.status)
  const blacklistedPlates = ref<string[]>(persisted.plates)

  function persist() {
    const payload: PersistedState = { status: statusMap.value, plates: blacklistedPlates.value }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  /** 单条记录当前审批状态 */
  function statusOf(r: AbnormalVehicle): ApprovalStatus {
    return statusMap.value[recordKey(r)] ?? 'pending'
  }

  /** 车牌是否为黑名单 */
  function isBlacklisted(plate: string): boolean {
    return blacklistedPlates.value.includes(plate)
  }

  /** 单条记录改为给定状态并持久化 */
  function setStatus(r: AbnormalVehicle, status: ApprovalStatus) {
    statusMap.value[recordKey(r)] = status
  }

  /** 加入黑名单 / 移出黑名单（再点一次恢复） */
  function toggleBlacklist(plate: string) {
    const records = sourceRecords.value.filter((r) => r.plate === plate)
    const shouldRemove = records.some((r) => statusOf(r) === 'blacklisted')
    for (const r of records) {
      const cur = statusOf(r)
      if (shouldRemove && cur === 'blacklisted') setStatus(r, 'pending')
      else if (!shouldRemove && cur === 'pending') setStatus(r, 'blacklisted')
    }
    if (shouldRemove) {
      blacklistedPlates.value = blacklistedPlates.value.filter((p) => p !== plate)
    } else if (!blacklistedPlates.value.includes(plate)) {
      blacklistedPlates.value = [...blacklistedPlates.value, plate]
    }
    persist()
  }

  /** 移除 / 恢复（再点一次恢复） */
  function toggleRemove(plate: string) {
    const records = sourceRecords.value.filter((r) => r.plate === plate)
    const allRemoved = records.length > 0 && records.every((r) => statusOf(r) === 'removed')
    for (const r of records) {
      const cur = statusOf(r)
      if (allRemoved && cur === 'removed') setStatus(r, 'pending')
      else if (!allRemoved && cur !== 'removed') setStatus(r, 'removed')
    }
    // 执行移除时同步清出黑名单；恢复不改黑名单
    if (!allRemoved) {
      blacklistedPlates.value = blacklistedPlates.value.filter((p) => p !== plate)
    }
    persist()
  }

  /** 黑名单的完整信息记录（拉黑状态下该车牌的所有记录） */
  const blacklistRecords = computed<AbnormalVehicle[]>(() =>
    sourceRecords.value.filter((r) => r.plate !== '' && statusOf(r) === 'blacklisted'),
  )

  return {
    sourceRecords,
    blacklistedPlates,
    blacklistRecords,
    statusOf,
    isBlacklisted,
    toggleBlacklist,
    toggleRemove,
  }
})