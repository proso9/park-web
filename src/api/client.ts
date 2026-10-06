import type {
  AnomalyRecord,
  OverviewData,
  PlateCounts,
  PlateGroupsPage,
  RecordStatus,
  RecordsPage,
  RecordsQuery,
} from '@/data/types'

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

const JSON_HEADERS = { 'content-type': 'application/json' }

/** Worker /api 客户端（本地 dev 走 vite proxy → wrangler dev，线上同源） */
export const api = {
  /** 明细列表（服务端分页） */
  records(query: RecordsQuery): Promise<RecordsPage> {
    return request<RecordsPage>(`/api/records?${recordsSearchParams(query)}`)
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

  /** 概览聚合（from/to 可选日期范围） */
  overview(from?: string, to?: string): Promise<OverviewData> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return request<OverviewData>(`/api/overview${qs ? `?${qs}` : ''}`)
  },

  /** 审批页车牌分组（两段式服务端分页） */
  plateGroups(query: {
    page?: number
    pageSize?: number
    from?: string
    to?: string
    plate?: string
  }): Promise<PlateGroupsPage> {
    const params = new URLSearchParams()
    if (query.page) params.set('page', String(query.page))
    if (query.pageSize) params.set('pageSize', String(query.pageSize))
    if (query.from) params.set('from', query.from)
    if (query.to) params.set('to', query.to)
    if (query.plate) params.set('plate', query.plate)
    return request<PlateGroupsPage>(`/api/plate-groups?${params.toString()}`)
  },

  /** 车牌模糊候选（快速移除面板输入建议） */
  plates(q: string): Promise<{ plates: string[] }> {
    const params = new URLSearchParams({ q })
    return request<{ plates: string[] }>(`/api/plates?${params.toString()}`)
  },

  /** 全量车牌 + 黑名单（status=1）车牌列表 */
  allPlates(): Promise<{ plates: string[]; blacklisted: string[] }> {
    return request<{ plates: string[]; blacklisted: string[] }>('/api/plates?all=1')
  },

  /** 某车牌各状态记录数（判定拉黑/移除方向） */
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
