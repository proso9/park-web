import type { AnomalyRecord, RecordStatus } from '../src/data/types'

/** D1 anomalies 表原始行（snake_case） */
export interface DbRow {
  id: number
  log_date: string
  log_file: string
  entry_time: string | null
  exit_time: string
  car_number: string
  fee: number | null
  is_suspicious: number
  status: number
  remark: string | null
  created_at: string
}

/** SELECT 列清单：永远不取 dedup_key（只读幂等键，业务无需展示） */
export const RECORD_COLUMNS =
  'id, log_date, log_file, entry_time, exit_time, car_number, fee, is_suspicious, status, remark, created_at'

function toStatus(raw: number): RecordStatus {
  return raw === 1 ? 1 : raw === 2 ? 2 : 0
}

/** D1 行 → 前端领域对象 */
export function mapRecord(row: DbRow): AnomalyRecord {
  return {
    id: row.id,
    logDate: row.log_date,
    logFile: row.log_file,
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    carNumber: row.car_number,
    fee: row.fee,
    isSuspicious: row.is_suspicious === 1,
    status: toStatus(row.status),
    remark: row.remark,
    createdAt: row.created_at,
  }
}

export interface RangeFilter {
  from?: string
  to?: string
}

/** 把 log_date 起止条件追加到 WHERE 片段与绑定参数（全部参数化） */
export function pushRange(where: string[], params: (string | number)[], range: RangeFilter): void {
  if (range.from) {
    where.push('log_date >= ?')
    params.push(range.from)
  }
  if (range.to) {
    where.push('log_date <= ?')
    params.push(range.to)
  }
}

export function rangeSql(range: RangeFilter): string {
  const where: string[] = []
  pushRange(where, [], range)
  return where.length ? `WHERE ${where.join(' AND ')}` : ''
}
