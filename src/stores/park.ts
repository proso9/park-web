import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type {
  AnomalyRecord,
  OverviewData,
  PlateGroupsPage,
  RecordStatus,
  RecordsQuery,
} from '@/data/types'

const SETTINGS_KEY = 'park:settings'

/** 概览页「重点车辆标签」的可调阈值（localStorage 持久化） */
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

/**
 * 业务 store：数据全部来自 Worker /api（D1 anomalies 表），
 * 仅 status / remark 可写；阈值设置仍 localStorage 持久化。
 */
export const useParkStore = defineStore('park', () => {
  // 概览页「重点车辆标签」阈值
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

  // ===== 明细列表（服务端分页） =====
  const records = ref<AnomalyRecord[]>([])
  const recordsTotal = ref(0)
  const recordsPage = ref(1)
  const recordsPageSize = ref(20)
  const recordsLoading = ref(false)
  const recordsError = ref('')
  let lastRecordsQuery: RecordsQuery | null = null

  async function fetchRecords(query: RecordsQuery) {
    lastRecordsQuery = { ...query }
    recordsLoading.value = true
    recordsError.value = ''
    try {
      const result = await api.records(query)
      records.value = result.rows
      recordsTotal.value = result.total
      recordsPage.value = result.page
      recordsPageSize.value = result.pageSize
    } catch (err) {
      recordsError.value = err instanceof Error ? err.message : '加载明细失败'
    } finally {
      recordsLoading.value = false
    }
  }

  async function refreshRecords() {
    if (lastRecordsQuery) await fetchRecords(lastRecordsQuery)
  }

  // ===== 概览聚合 =====
  const overview = ref<OverviewData | null>(null)
  const overviewLoading = ref(false)
  const overviewError = ref('')
  // 窗口内日期对半分的两段 KPI（概览页「较前半期」趋势），日期不足两天时为 null
  const earlyKpi = ref<OverviewData['kpi'] | null>(null)
  const lateKpi = ref<OverviewData['kpi'] | null>(null)
  let lastOverviewRange: { from?: string; to?: string } = {}

  async function fetchOverview(from?: string, to?: string) {
    lastOverviewRange = { from, to }
    overviewLoading.value = true
    overviewError.value = ''
    earlyKpi.value = null
    lateKpi.value = null
    try {
      const data = await api.overview(from, to)
      overview.value = data

      // 日期对半分：分别拉两段 KPI 供趋势对比（人工浏览频率，额度无压力）
      const daily = data.daily
      if (daily.length >= 2) {
        const splitAt = Math.floor(daily.length / 2)
        const earlyDays = daily.slice(0, splitAt)
        const lateDays = daily.slice(splitAt)
        const [early, late] = await Promise.all([
          api.overview(earlyDays[0]!.logDate, earlyDays[earlyDays.length - 1]!.logDate),
          api.overview(lateDays[0]!.logDate, lateDays[lateDays.length - 1]!.logDate),
        ])
        earlyKpi.value = early.kpi
        lateKpi.value = late.kpi
      }
    } catch (err) {
      overviewError.value = err instanceof Error ? err.message : '加载概览失败'
    } finally {
      overviewLoading.value = false
    }
  }

  async function refreshOverview() {
    const range = lastOverviewRange
    await fetchOverview(range.from, range.to)
  }

  // ===== 审批页车牌分组 =====
  const plateGroups = ref<PlateGroupsPage | null>(null)
  const plateGroupsLoading = ref(false)
  const plateGroupsError = ref('')
  let lastGroupsQuery: { page?: number; pageSize?: number; from?: string; to?: string } | null =
    null

  async function fetchPlateGroups(query: {
    page?: number
    pageSize?: number
    from?: string
    to?: string
  }) {
    lastGroupsQuery = { ...query }
    plateGroupsLoading.value = true
    plateGroupsError.value = ''
    try {
      plateGroups.value = await api.plateGroups(query)
    } catch (err) {
      plateGroupsError.value = err instanceof Error ? err.message : '加载分组失败'
    } finally {
      plateGroupsLoading.value = false
    }
  }

  async function refreshPlateGroups() {
    if (lastGroupsQuery) await fetchPlateGroups(lastGroupsQuery)
  }

  // ===== 全量车牌 / 黑名单（status=1 的车牌，服务端派生） =====
  const allPlates = ref<string[]>([])
  const blacklistedPlates = ref<string[]>([])

  async function fetchAllPlates() {
    const result = await api.allPlates()
    allPlates.value = result.plates
    blacklistedPlates.value = result.blacklisted
  }

  /** 车牌是否已处理（黑名单） */
  function isBlacklisted(plate: string): boolean {
    return blacklistedPlates.value.includes(plate)
  }

  // ===== 状态变更操作（写库后同步刷新已加载的聚合数据） =====

  /** 就地替换一条记录（明细 / 最近动态 / 分组明细） */
  function applyRecordPatch(next: AnomalyRecord) {
    const patchList = (list: AnomalyRecord[]) => {
      const index = list.findIndex((r) => r.id === next.id)
      if (index >= 0) list.splice(index, 1, next)
    }
    patchList(records.value)
    if (overview.value) patchList(overview.value.recent)
    if (plateGroups.value) {
      for (const group of plateGroups.value.groups) patchList(group.records)
    }
  }

  /** 变更落库后，把已加载的列表与聚合全部刷一遍（人工操作频率低，额度无压力） */
  async function refreshAfterMutation() {
    await Promise.allSettled([
      refreshRecords(),
      refreshPlateGroups(),
      refreshOverview(),
      fetchAllPlates(),
    ])
  }

  /** 单条人工处理：只允许改 status / remark */
  async function updateRecord(
    id: number,
    patch: { status?: RecordStatus; remark?: string | null },
  ) {
    const { record } = await api.updateRecord(id, patch)
    applyRecordPatch(record)
    await refreshAfterMutation()
    return record
  }

  /** 加入黑名单 / 移出黑名单（再点一次恢复）。车牌级，作用于该车全部记录。 */
  async function toggleBlacklist(plate: string) {
    const { counts } = await api.plateCounts(plate)
    if (counts[1] > 0) {
      // 已有已处理记录：把已处理（status=1）恢复为未处理
      await api.setPlateStatus(plate, { to: 0, from: 1 })
    } else {
      // 否则把未处理（status=0）标记为已处理
      await api.setPlateStatus(plate, { to: 1, from: 0 })
    }
    await refreshAfterMutation()
  }

  /** 移除 / 恢复（再点一次恢复）。误报需附备注原因。 */
  async function toggleRemove(plate: string, remark?: string) {
    const { counts, total } = await api.plateCounts(plate)
    if (total > 0 && counts[2] === total) {
      // 全部都是误报：恢复为未处理
      await api.setPlateStatus(plate, { to: 0, from: 2 })
    } else {
      // 其余全部标记为误报（含已处理的，车牌随之自动移出黑名单）
      await api.setPlateStatus(plate, { to: 2, remark })
    }
    await refreshAfterMutation()
  }

  /** 批量移除（快速移除面板）：命中车牌全部标记为误报并写入备注，返回影响记录数 */
  async function removePlates(plates: string[], remark: string): Promise<number> {
    let changed = 0
    for (const plate of plates) {
      const result = await api.setPlateStatus(plate, { to: 2, remark })
      changed += result.changed
    }
    if (changed > 0) await refreshAfterMutation()
    return changed
  }

  /** 拉取全部已处理（status=1）记录，供导出黑名单 CSV（分页拉全量） */
  async function fetchBlacklistRecords(): Promise<AnomalyRecord[]> {
    const rows: AnomalyRecord[] = []
    let page = 1
    for (;;) {
      const result = await api.records({ status: 1, page, pageSize: 50 })
      rows.push(...result.rows)
      if (result.rows.length === 0 || rows.length >= result.total) break
      page += 1
    }
    return rows
  }

  return {
    // 阈值
    repeatThreshold,
    highFeeThreshold,
    setThresholds,
    // 明细列表
    records,
    recordsTotal,
    recordsPage,
    recordsPageSize,
    recordsLoading,
    recordsError,
    fetchRecords,
    // 概览
    overview,
    overviewLoading,
    overviewError,
    earlyKpi,
    lateKpi,
    fetchOverview,
    // 审批分组
    plateGroups,
    plateGroupsLoading,
    plateGroupsError,
    fetchPlateGroups,
    // 车牌 / 黑名单
    allPlates,
    blacklistedPlates,
    fetchAllPlates,
    isBlacklisted,
    // 状态操作
    updateRecord,
    toggleBlacklist,
    toggleRemove,
    removePlates,
    fetchBlacklistRecords,
  }
})
