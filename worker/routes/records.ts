import type { RecordStatus } from '../../src/data/types'
import { mapRecord, RECORD_COLUMNS, type DbRow } from '../db'
import { httpError, json, readJson } from '../http'


const RECORD_SELECT = `SELECT ${RECORD_COLUMNS} FROM anomalies`

/** 解析并钳制正整数查询参数 */
function intParam(raw: string | null, min: number, max?: number): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number(raw)
  if (!Number.isInteger(n)) return undefined
  if (n < min) return min
  if (max !== undefined && n > max) return max
  return n
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function dateParam(raw: string | null): string | undefined {
  return raw && DATE_RE.test(raw) ? raw : undefined
}

/**
 * GET /api/records —— 明细列表：分页 + 日期范围 / 车牌模糊 / 状态 / 可疑 / 缺入场筛选。
 * 全部参数化绑定；每页上限 50 行，避免全表拉取。
 */
export async function listRecords(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const page = intParam(url.searchParams.get('page'), 1) ?? 1
  const pageSize = intParam(url.searchParams.get('pageSize'), 1, 50) ?? 20

  const where: string[] = []
  const params: (string | number | null)[] = []

  const from = dateParam(url.searchParams.get('from'))
  const to = dateParam(url.searchParams.get('to'))
  if (from) {
    where.push('log_date >= ?')
    params.push(from)
  }
  if (to) {
    where.push('log_date <= ?')
    params.push(to)
  }

  const plate = url.searchParams.get('plate')?.trim()
  if (plate) {
    where.push('car_number LIKE ?')
    params.push(`%${plate}%`)
  }

  const statusRaw = url.searchParams.get('status')
  if (statusRaw === '0' || statusRaw === '1' || statusRaw === '2') {
    where.push('status = ?')
    params.push(Number(statusRaw))
  }

  const suspiciousRaw = url.searchParams.get('suspicious')
  if (suspiciousRaw === '1' || suspiciousRaw === '0') {
    where.push('is_suspicious = ?')
    params.push(Number(suspiciousRaw))
  }

  if (url.searchParams.get('entryMissing') === '1') {
    where.push('entry_time IS NULL')
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const offset = (page - 1) * pageSize

  const [countResult, rowsResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM anomalies ${whereSql}`).bind(...params),
    env.DB.prepare(
      `${RECORD_SELECT} ${whereSql} ORDER BY exit_time DESC, id DESC LIMIT ? OFFSET ?`,
    ).bind(...params, pageSize, offset),
  ])

  if (!countResult || !rowsResult || countResult.error || rowsResult.error) {
    return httpError(500, '查询明细失败')
  }

  const total = (countResult.results[0] as { total: number } | undefined)?.total ?? 0
  const rows = (rowsResult.results as unknown as DbRow[]).map(mapRecord)
  return json({ rows, total, page, pageSize })
}

interface RecordPatch {
  status?: number
  remark?: string | null
}

/**
 * PATCH /api/records/:id —— 人工处理：只允许修改 status / remark 两个字段。
 * 使用 RETURNING 直接返回更新后的行；dedup_key 等其余字段绝不触碰。
 */
export async function updateRecord(
  request: Request,
  env: Env,
  rawId: string,
): Promise<Response> {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return httpError(400, '无效的记录 ID')

  const body = await readJson<RecordPatch>(request)
  if (!body) return httpError(400, '请求体不是合法 JSON')

  const sets: string[] = []
  const params: (string | number | null)[] = []

  if (body.status !== undefined) {
    const status = body.status
    if (status !== 0 && status !== 1 && status !== 2) return httpError(400, 'status 只能是 0、1、2')
    sets.push('status = ?')
    params.push(status)
  }

  if (body.remark !== undefined) {
    if (body.remark !== null && typeof body.remark !== 'string') {
      return httpError(400, 'remark 必须是字符串')
    }
    const remark = body.remark === null || body.remark.trim() === '' ? null : body.remark.trim()
    if (remark !== null && remark.length > 500) return httpError(400, '备注不能超过 500 字')
    sets.push('remark = ?')
    params.push(remark)
  }

  if (sets.length === 0) return httpError(400, '没有需要更新的字段')

  const result = await env.DB.prepare(
    `UPDATE anomalies SET ${sets.join(', ')} WHERE id = ? RETURNING ${RECORD_COLUMNS}`,
  )
    .bind(...params, id)
    .first<DbRow>()

  if (!result) return httpError(404, '记录不存在')
  return json({ record: mapRecord(result) })
}

/** 校验状态值并收窄类型 */
export function parseStatus(raw: unknown): RecordStatus | null {
  return raw === 0 || raw === 1 || raw === 2 ? raw : null
}
