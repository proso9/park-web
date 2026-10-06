import type { RecordStatus } from '../../src/data/types'
import { httpError, json, readJson } from '../http'

import { parseStatus } from './records'

interface PlateCountsRaw {
  status: number
  n: number
}

/**
 * GET /api/plates?q= —— 车牌模糊候选（快速移除面板）；`all=1` 时返回全量车牌
 * 与已处理（status=1，即黑名单）车牌列表。
 */
export async function listPlates(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  if (url.searchParams.get('all') === '1') {
    const [allResult, blacklistResult] = await env.DB.batch([
      env.DB.prepare(
        'SELECT DISTINCT car_number FROM anomalies ORDER BY car_number',
      ),
      env.DB.prepare(
        'SELECT DISTINCT car_number FROM anomalies WHERE status = 1 ORDER BY car_number',
      ),
    ])
    if (!allResult || !blacklistResult || allResult.error || blacklistResult.error) {
      return httpError(500, '查询车牌失败')
    }
    return json({
      plates: allResult.results.map((r) => (r as { car_number: string }).car_number),
      blacklisted: blacklistResult.results.map((r) => (r as { car_number: string }).car_number),
    })
  }

  const q = (url.searchParams.get('q') ?? '').trim()
  const result = await env.DB.prepare(
    'SELECT DISTINCT car_number FROM anomalies WHERE car_number LIKE ? ORDER BY car_number LIMIT 20',
  )
    .bind(`%${q}%`)
    .all<{ car_number: string }>()

  if (result.error) return httpError(500, '查询车牌失败')
  return json({ plates: result.results.map((r) => r.car_number) })
}

/** GET /api/plates/:carNumber/counts —— 该车牌各状态记录数（判定拉黑/移除方向） */
export async function plateCounts(
  request: Request,
  env: Env,
  carNumber: string,
): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT status, COUNT(*) AS n FROM anomalies WHERE car_number = ? GROUP BY status',
  )
    .bind(carNumber)
    .all<PlateCountsRaw>()

  if (result.error) return httpError(500, '查询车牌状态失败')

  const counts: Record<RecordStatus, number> = { 0: 0, 1: 0, 2: 0 }
  let total = 0
  for (const row of result.results) {
    const status = parseStatus(row.status)
    if (status === null) continue
    counts[status] = row.n
    total += row.n
  }
  return json({ counts, total })
}

interface PlateStatusBody {
  to?: number
  from?: number
  remark?: string
}

/**
 * POST /api/plates/:carNumber/status —— 车牌级批量状态变更（拉黑/移除/恢复）。
 * 一条参数化 UPDATE 按车牌（可限定原状态）改 status，并可一并写 remark。
 */
export async function setPlateStatus(
  request: Request,
  env: Env,
  carNumber: string,
): Promise<Response> {
  const body = await readJson<PlateStatusBody>(request)
  if (!body) return httpError(400, '请求体不是合法 JSON')

  const to = parseStatus(body.to)
  if (to === null) return httpError(400, 'to 只能是 0、1、2')
  const from = body.from === undefined ? undefined : parseStatus(body.from)
  if (body.from !== undefined && from === null) {
    return httpError(400, 'from 只能是 0、1、2')
  }

  let remark: string | null | undefined
  if (body.remark !== undefined) {
    if (typeof body.remark !== 'string') return httpError(400, 'remark 必须是字符串')
    remark = body.remark.trim() === '' ? null : body.remark.trim()
    if (remark !== null && remark.length > 500) return httpError(400, '备注不能超过 500 字')
  }

  const sets = ['status = ?']
  const params: (string | number | null)[] = [to]
  if (remark !== undefined) {
    sets.push('remark = ?')
    params.push(remark)
  }

  let sql = `UPDATE anomalies SET ${sets.join(', ')} WHERE car_number = ?`
  params.push(carNumber)
  if (from !== undefined) {
    sql += ' AND status = ?'
    params.push(from)
  }

  const result = await env.DB.prepare(sql)
    .bind(...params)
    .run()

  if (result.error) return httpError(500, '更新失败')
  return json({ changed: result.meta.changes ?? 0 })
}
