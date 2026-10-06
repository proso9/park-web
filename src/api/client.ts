import type {
  AnomalyRecord,
  OverviewData,
  PlateCounts,
  PlateGroupsPage,
  RecordStatus,
  RecordsPage,
  RecordsQuery,
} from '@/data/types'
import { TTL_AGGREGATE, TTL_LIST, swrGet } from './cache'

/** 统一请求：非 2xx 抛出后端 error 文案 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) {
    throw new Error(data?.error ?? `请求失败（HTTP ${res.status}）`)
  }
  return data as T
}

function recordsSearchParams(query: RecordsQuery): string {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.plate) params.set('plate', query.plate)
  if (query.status !== undefined) params.set('status', String(query.status))
  if (query.suspicious !== undefined) params.set('suspicious', String(query.suspicious))
  if (query.entryMissing) params.set('entryMissing', '1')
  return params.toString()
}

function plateGroupsSearchParams(query: {
  page?: number
  pageSize?: number
  from?: string
  to?: string
  plate?: string
}): string {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.plate) params.set('plate', query.plate)
  return params.toString()
}

const JSON_HEADERS = { 'content-type': 'application/json' }

/**
 * Worker /api 客户端（本地 dev 走 vite proxy → wrangler dev，线上同源）。
 * 读接口走 SWR 缓存（聚合/全量 60s、列表 15s，写操作后全量失效）；
 * 写前判定与导出绕过缓存，保证拿到的是当下数据。
 */
export const api = {
  /** 明细列表（SWR：15s 内同查询直接回缓存，过期先回旧数据再后台重拉） */
  swrRecords(query: RecordsQuery, onUpdate?: (page: RecordsPage) => void): Promise<RecordsPage> {
    const url = `/api/records?${recordsSearchParams(query)}`
    return swrGet(url, TTL_LIST, () => request<RecordsPage>(url), onUpdate)
  },

  /** 明细列表（绕过缓存）：黑名单导出需要一次性拉全量的一致快照 */
  records(query: RecordsQuery): Promise<RecordsPage> {
    return request<RecordsPage>(`/api/records?${recordsSearchParams(query)}`)
  },

  /** 概览聚合（SWR：60s；from/to 可选日期范围） */
  swrOverview(
    from?: string,
    to?: string,
    onUpdate?: (data: OverviewData) => void,
  ): Promise<OverviewData> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    const url = `/api/overview${qs ? `?${qs}` : ''}`
    return swrGet(url, TTL_AGGREGATE, () => request<OverviewData>(url), onUpdate)
  },

  /** 审批页车牌分组（SWR：15s；两段式服务端分页） */
  swrPlateGroups(
    query: {
      page?: number
      pageSize?: number
      from?: string
      to?: string
      plate?: string
    },
    onUpdate?: (page: PlateGroupsPage) => void,
  ): Promise<PlateGroupsPage> {
    const url = `/api/plate-groups?${plateGroupsSearchParams(query)}`
    return swrGet(url, TTL_LIST, () => request<PlateGroupsPage>(url), onUpdate)
  },

  /** 全量车牌 + 黑名单（status=1）车牌列表（SWR：60s） */
  swrAllPlates(
    onUpdate?: (data: { plates: string[]; blacklisted: string[] }) => void,
  ): Promise<{ plates: string[]; blacklisted: string[] }> {
    return swrGet(
      '/api/plates?all=1',
      TTL_AGGREGATE,
      () => request<{ plates: string[]; blacklisted: string[] }>('/api/plates?all=1'),
      onUpdate,
    )
  },

  /** 单条人工处理：只允许 status / remark */
  updateRecord(
    id: number,
    patch: { status?: RecordStatus; remark?: string | null },
  ): Promise<{ record: AnomalyRecord }> {
    return request<{ record: AnomalyRecord }>(`/api/records/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    })
  },

  /** 某车牌各状态记录数（写前判定拉黑/移除方向，绕过缓存） */
  plateCounts(plate: string): Promise<PlateCounts> {
    return request<PlateCounts>(`/api/plates/${encodeURIComponent(plate)}/counts`)
  },

  /** 车牌级批量状态变更（拉黑/移除/恢复，可限定原状态并附带备注） */
  setPlateStatus(
    plate: string,
    body: { to: RecordStatus; from?: RecordStatus; remark?: string },
  ): Promise<{ changed: number }> {
    return request<{ changed: number }>(`/api/plates/${encodeURIComponent(plate)}/status`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
  },
}
