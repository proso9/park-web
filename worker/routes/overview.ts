import type { OverviewData, PlateStat } from '../../src/data/types'
import { mapRecord, pushRange, type DbRow } from '../db'
import { httpError, json } from '../http'


interface KpiRow {
  total: number
  suspicious: number
  unprocessed: number
  plates: number
  fee_sum: number | null
  fee_max: number | null
}

interface DailyRow {
  log_date: string
  total: number
  suspicious: number
}

interface PlateStatRow {
  car_number: string
  count: number
  suspicious: number
  fee_sum: number | null
  unprocessed: number
  processed: number
  misreported: number
}

function sum(raw: number | null | undefined): number {
  return raw ?? 0
}

/**
 * GET /api/overview?from&to —— 概览页全部聚合，单次请求 db.batch 完成：
 * KPI / 每日分布 / 最近动态按日期范围过滤；plateStats 永远按全量记录聚合
 * （重点车辆标签与设置页预演不随日期筛选变化，与原版语义一致）。
 */
export async function overview(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const fromRaw = url.searchParams.get('from')
  const toRaw = url.searchParams.get('to')
  const range: { from?: string; to?: string } = {}
  if (fromRaw && DATE_RE.test(fromRaw)) range.from = fromRaw
  if (toRaw && DATE_RE.test(toRaw)) range.to = toRaw

  const where: string[] = []
  const rangeParams: (string | number)[] = []
  pushRange(where, rangeParams, range)
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const [kpiResult, dailyResult, recentResult, plateResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(is_suspicious), 0) AS suspicious,
              COALESCE(SUM(status = 0), 0) AS unprocessed, COUNT(DISTINCT car_number) AS plates,
              SUM(fee) AS fee_sum, MAX(fee) AS fee_max
       FROM anomalies ${whereSql}`,
    ).bind(...rangeParams),
    env.DB.prepare(
      `SELECT log_date, COUNT(*) AS total, COALESCE(SUM(is_suspicious), 0) AS suspicious
       FROM anomalies ${whereSql} GROUP BY log_date ORDER BY log_date`,
    ).bind(...rangeParams),
    env.DB.prepare(
      `SELECT id, log_date, log_file, entry_time, exit_time, car_number, fee, is_suspicious, status, remark, created_at
       FROM anomalies ${whereSql} ORDER BY exit_time DESC, id DESC LIMIT 6`,
    ).bind(...rangeParams),
    env.DB.prepare(
      `SELECT car_number, COUNT(*) AS count, COALESCE(SUM(is_suspicious), 0) AS suspicious,
              COALESCE(SUM(fee), 0) AS fee_sum, COALESCE(SUM(status = 0), 0) AS unprocessed,
              COALESCE(SUM(status = 1), 0) AS processed, COALESCE(SUM(status = 2), 0) AS misreported
       FROM anomalies GROUP BY car_number ORDER BY car_number`,
    ),
  ])

  if (
    !kpiResult ||
    !dailyResult ||
    !recentResult ||
    !plateResult ||
    kpiResult.error ||
    dailyResult.error ||
    recentResult.error ||
    plateResult.error
  ) {
    return httpError(500, '查询概览失败')
  }

  const kpiRow = kpiResult.results[0] as KpiRow | undefined
  const daily = (dailyResult.results as unknown as DailyRow[]).map((r) => ({
    logDate: r.log_date,
    total: r.total,
    suspicious: r.suspicious,
  }))
  const recent = (recentResult.results as unknown as DbRow[]).map(mapRecord)
  const plateStats: PlateStat[] = (plateResult.results as unknown as PlateStatRow[]).map((r) => ({
    carNumber: r.car_number,
    count: r.count,
    suspicious: r.suspicious,
    feeSum: sum(r.fee_sum),
    unprocessed: r.unprocessed,
    processed: r.processed,
    misreported: r.misreported,
  }))

  const data: OverviewData = {
    kpi: {
      total: kpiRow?.total ?? 0,
      suspicious: sum(kpiRow?.suspicious),
      unprocessed: sum(kpiRow?.unprocessed),
      plates: kpiRow?.plates ?? 0,
      feeSum: sum(kpiRow?.fee_sum),
      feeMax: kpiRow?.fee_max ?? null,
    },
    daily,
    recent,
    plateStats,
  }
  return json(data)
}
