/** 记录处理状态（D1 anomalies.status）：0 未处理 / 1 已处理 / 2 误报 */
export type RecordStatus = 0 | 1 | 2

/**
 * D1 `anomalies` 表一行（snake_case → camelCase 映射）。
 * 本项目只允许 UPDATE status / remark，其余字段一律只读。
 */
export interface AnomalyRecord {
  id: number
  /** 来源日志日期，如 2026-08-22 */
  logDate: string
  /** 来源日志文件名，如 system.2026-08-22.log */
  logFile: string
  /** 入场时间 YYYY-MM-DD HH:MM:SS，日志里没反查到时为 null（展示 "-"） */
  entryTime: string | null
  /** 出场时间 YYYY-MM-DD HH:MM:SS（必有） */
  exitTime: string
  /** 车牌（上游已归一化：去空格、全大写） */
  carNumber: string
  /** 应付费用（元），无关联为 null（展示 "-"） */
  fee: number | null
  /** 1=重点可疑（系统停车时间明显大于实际时长，疑似人工放行） */
  isSuspicious: boolean
  status: RecordStatus
  /** 人工备注；标为「误报」时应填写原因 */
  remark: string | null
  /** 入库时间（UTC，datetime('now')），展示时转 +8 */
  createdAt: string
}

/** 单个日期的记录聚合 */
export interface DailyStat {
  logDate: string
  total: number
  suspicious: number
}

/** 单台车牌的全量聚合（不随日期筛选变化，供重点车辆标签与设置页预演） */
export interface PlateStat {
  carNumber: string
  count: number
  suspicious: number
  feeSum: number
  unprocessed: number
  processed: number
  misreported: number
}

/** 概览页一次请求返回的全部聚合数据 */
export interface OverviewData {
  kpi: {
    total: number
    suspicious: number
    unprocessed: number
    plates: number
    feeSum: number
    feeMax: number | null
  }
  daily: DailyStat[]
  recent: AnomalyRecord[]
  plateStats: PlateStat[]
}

/** 明细列表分页结果 */
export interface RecordsPage {
  rows: AnomalyRecord[]
  total: number
  page: number
  pageSize: number
}

/** 明细列表筛选条件 */
export interface RecordsQuery {
  page?: number
  pageSize?: number
  /** log_date 起止（含端点） */
  from?: string
  to?: string
  /** 车牌模糊搜索 */
  plate?: string
  status?: RecordStatus
  /** 1 仅可疑 / 0 仅一般 */
  suspicious?: 0 | 1
  /** 仅缺入场时间的记录 */
  entryMissing?: boolean
}

/** 审批页一个车牌分组：状态计数 + 该车牌在筛选范围内的记录 */
export interface PlateGroup {
  carNumber: string
  count: number
  suspicious: number
  feeSum: number
  unprocessed: number
  processed: number
  misreported: number
  records: AnomalyRecord[]
}

/** 审批页车牌分组分页结果 */
export interface PlateGroupsPage {
  groups: PlateGroup[]
  total: number
  page: number
  pageSize: number
}

/** 某车牌各状态的记录数 */
export interface PlateCounts {
  counts: Record<RecordStatus, number>
  total: number
}
