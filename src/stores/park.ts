import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { loadAllVehicles } from '@/data/parse'
import type { AbnormalVehicle, ApprovalStatus } from '@/data/types'

const STORAGE_KEY = 'park:approval-state'
const SETTINGS_KEY = 'park:settings'

interface PersistedState {
  status: Record<string, ApprovalStatus>
  plates: string[]
}

/** 概览页「重点车辆标签」的可调阈值 */
interface VehSettings {
  repeatThreshold: number
  highFeeThreshold: number
}

function loadSettings(): VehSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { repeatThreshold: 2, highFeeThreshold: 500 }
    const parsed = JSON.parse(raw) as Partial<VehSettings>
    return {
      repeatThreshold:
        typeof parsed.repeatThreshold === 'number' && parsed.repeatThreshold > 0
          ? parsed.repeatThreshold
          : 2,
      highFeeThreshold:
        typeof parsed.highFeeThreshold === 'number' && parsed.highFeeThreshold > 0
          ? parsed.highFeeThreshold
          : 500,
    }
  } catch {
    return { repeatThreshold: 2, highFeeThreshold: 500 }
  }
}

const FEES_LIMIT = 10000
const REPEAT_LIMIT = 100

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

  // 概览页「重点车辆标签」阈值，localStorage 持久化
  const saved = loadSettings()
  const repeatThreshold = ref(saved.repeatThreshold)
  const highFeeThreshold = ref(saved.highFeeThreshold)

  /** 更新阈值并持久化；非法值（非正数）不写入 */
  function setThresholds(repeat: number, highFee: number) {
    if (!Number.isFinite(repeat) || repeat <= 0 || repeat > REPEAT_LIMIT) return
    if (!Number.isFinite(highFee) || highFee <= 0 || highFee > FEES_LIMIT) return
    repeatThreshold.value = repeat
    highFeeThreshold.value = highFee
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ repeatThreshold, highFeeThreshold }))
  }

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

  /** 批量移除（审批页快速移除面板）：命中车牌的未移除记录全部标记为已移除并清出黑名单，单次持久化 */
  function removePlates(plates: string[]): number {
    const targets = new Set(plates)
    if (targets.size === 0) return 0
    const touched = new Set<string>()
    for (const r of sourceRecords.value) {
      if (!targets.has(r.plate) || statusOf(r) === 'removed') continue
      setStatus(r, 'removed')
      touched.add(r.plate)
    }
    const hadBlacklisted = blacklistedPlates.value.some((p) => targets.has(p))
    if (touched.size > 0 || hadBlacklisted) {
      blacklistedPlates.value = blacklistedPlates.value.filter((p) => !targets.has(p))
      persist()
    }
    return touched.size
  }

  /** 黑名单的完整信息记录（拉黑状态下该车牌的所有记录） */
  const blacklistRecords = computed<AbnormalVehicle[]>(() =>
    sourceRecords.value.filter((r) => r.plate !== '' && statusOf(r) === 'blacklisted'),
  )

  return {
    sourceRecords,
    blacklistedPlates,
    blacklistRecords,
    repeatThreshold,
    highFeeThreshold,
    setThresholds,
    statusOf,
    isBlacklisted,
    toggleBlacklist,
    toggleRemove,
    removePlates,
  }
})
