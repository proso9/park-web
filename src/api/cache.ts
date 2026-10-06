/**
 * 前端 SWR 读缓存（内存级，会话内有效，不占任何服务端额度）：
 * - TTL 内直接回缓存，不发请求；
 * - 过期数据先回缓存渲染，同时后台静默重拉，新数据经 onUpdate 交给调用方覆盖界面；
 * - 写操作后调用 invalidateApiCache() 全量失效；
 * - epoch 计数：失效时在途的旧请求作废，不会把写前的旧数据回写进缓存。
 */

type CacheEntry = { data: unknown; time: number }

/** 缓存 TTL（毫秒）：聚合/全量类读得多变得少 60s；列表类 15s */
export const TTL_AGGREGATE = 60_000
export const TTL_LIST = 15_000

const entries = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()
/** 缓存条目上限（防搜索类高基数键撑爆内存），超出按插入序淘汰最旧 */
const MAX_ENTRIES = 300

let epoch = 0

/** 全量失效（写操作后调用） */
export function invalidateApiCache(): void {
  epoch += 1
  entries.clear()
  inflight.clear()
}

/**
 * SWR 读：缓存未命中走网络；命中则按 ttl 判断——
 * 新鲜直接回缓存，过期先回旧数据再后台重拉（同 URL 在途去重）。
 */
export function swrGet<T>(
  url: string,
  ttl: number,
  fetcher: () => Promise<T>,
  onUpdate?: (data: T) => void,
): Promise<T> {
  const hit = entries.get(url)
  if (!hit) return startFetch(url, fetcher)
  if (Date.now() - hit.time >= ttl) revalidate(url, fetcher, onUpdate)
  return Promise.resolve(hit.data as T)
}

function startFetch<T>(url: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(url)
  if (existing) return existing as Promise<T>
  const started = epoch
  const promise = fetcher()
    .then((data) => {
      if (started === epoch) remember(url, data)
      return data
    })
    .finally(() => {
      if (inflight.get(url) === promise) inflight.delete(url)
    })
  inflight.set(url, promise)
  return promise
}

function revalidate<T>(url: string, fetcher: () => Promise<T>, onUpdate?: (data: T) => void): void {
  const started = epoch
  void startFetch(url, fetcher)
    .then((data) => {
      if (started === epoch && onUpdate) onUpdate(data)
    })
    .catch(() => {
      // 后台重拉失败：界面继续用旧数据，下次访问再试
    })
}

function remember(url: string, data: unknown): void {
  if (!entries.has(url) && entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest !== undefined) entries.delete(oldest)
  }
  entries.set(url, { data, time: Date.now() })
}
