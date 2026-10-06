/** API 响应统一 JSON 输出 */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** 业务错误响应 */
export function httpError(status: number, message: string): Response {
  return json({ error: message }, status)
}

/** 解析请求体 JSON，失败返回 null */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
