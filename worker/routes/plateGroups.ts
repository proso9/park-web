import type { PlateGroup, PlateGroupsPage } from '../../src/data/types'
import { mapRecord, pushRange, type DbRow } from '../db'
import { httpError, json } from '../http'


interface GroupRow {
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
 * GET /api/plate-groups?page&pageSize&from&to&plate —— 审批页按车牌分组分页。
 * 两段式：先 GROUP BY car_number 取一页车牌，再取这些车牌（IN，≤20 个参数）
 * 在筛选范围内的记录。计数与记录都跟随日期筛选。
 */
export async function plateGroups(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const pageRaw = Number(url.searchParams.get('page'))
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const sizeRaw = Number(url.searchParams.get('pageSize'))
  const pageSize = Number.isInteger(sizeRaw) ? Math.min(Math.max(sizeRaw, 1), 20) : 10

  const where: string[] = []
  const params: (string | number)[] = []

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  pushRange(where, params, {
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
  })

  const plate = url.searchParams.get('plate')?.trim()
  if (plate) {
    where.push('car_number LIKE ?')
    params.push(`%${plate}%`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const offset = (page - 1) * pageSize

  const [countResult, groupsResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(DISTINCT car_number) AS total FROM anomalies ${whereSql}`,
    ).bind(...params),
    env.DB.prepare(
      `SELECT car_number, COUNT(*) AS count, COALESCE(SUM(is_suspicious), 0) AS suspicious,
              COALESCE(SUM(fee), 0) AS fee_sum, COALESCE(SUM(status = 0), 0) AS unprocessed,
              COALESCE(SUM(status = 1), 0) AS processed, COALESCE(SUM(status = 2), 0) AS misreported
       FROM anomalies ${whereSql}
       GROUP BY car_number ORDER BY car_number LIMIT ? OFFSET ?`,
    ).bind(...params, pageSize, offset),
  ])

  if (!countResult || !groupsResult || countResult.error || groupsResult.error) {
    return httpError(500, '查询分组失败')
  }

  const total = (countResult.results[0] as { total: number } | undefined)?.total ?? 0
  const groupRows = groupsResult.results as unknown as GroupRow[]
  if (groupRows.length === 0) {
    return json({ groups: [], total, page, pageSize })
  }

  // 第二段：取这页车牌的记录（IN 参数 ≤ pageSize ≤ 20，远低于 100 绑定参数上限）
  const placeholders = groupRows.map(() => '?').join(', ')
  const recordsResult = await env.DB.prepare(
    `SELECT id, log_date, log_file, entry_time, exit_time, car_number, fee, is_suspicious, status, remark, created_at
     FROM anomalies ${whereSql} ${whereSql ? 'AND' : 'WHERE'} car_number IN (${placeholders})
     ORDER BY exit_time DESC, id DESC`,
  )
    .bind(...params, ...groupRows.map((g) => g.car_number))
    .all()

  if (recordsResult.error) return httpError(500, '查询分组记录失败')
  const records = recordsResult.results as unknown as DbRow[]

  const groups: PlateGroup[] = groupRows.map((g) => ({
    carNumber: g.car_number,
    count: g.count,
    suspicious: g.suspicious,
    feeSum: sum(g.fee_sum),
    unprocessed: g.unprocessed,
    processed: g.processed,
    misreported: g.misreported,
    records: records.filter((r) => r.car_number === g.car_number).map(mapRecord),
  }))

  const result: PlateGroupsPage = { groups, total, page, pageSize }
  return json(result)
}
