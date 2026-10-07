import { httpError } from './http'

import { handleCheck, handleLogin, handleLogout, isAuthed } from './auth'
import { listRecords, updateRecord } from './routes/records'
import { listPlates, plateCounts, setPlateStatus } from './routes/plates'
import { overview } from './routes/overview'
import { plateGroups } from './routes/plateGroups'

/**
 * /api 路由分发。wrangler.jsonc 里 `run_worker_first: ["/api/*"]` 保证
 * /api 一定进入 Worker；其余路径由静态资源 + SPA 回退承接（不会走到这里）。
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    try {
      return await route(request, env, url.pathname, request.method)
    } catch (err) {
      console.error('[api]', err)
      return httpError(500, '服务器内部错误')
    }
  },
} satisfies ExportedHandler<Env>

async function route(
  request: Request,
  env: Env,
  pathname: string,
  method: string,
): Promise<Response> {
  // /api/ 之后的路径段
  const segments = pathname.slice('/api/'.length).split('/').filter(Boolean)

  // 认证端点：无会话时的唯一入口，不做守卫
  if (segments[0] === 'auth') {
    if (method === 'POST' && segments.length === 2 && segments[1] === 'login') {
      return handleLogin(request, env)
    }
    if (method === 'GET' && segments.length === 2 && segments[1] === 'check') {
      return handleCheck(request, env)
    }
    if (method === 'POST' && segments.length === 2 && segments[1] === 'logout') {
      return handleLogout(request)
    }
    return httpError(404, '未知接口')
  }

  // 其余 /api 一律要求有效会话（单密码门禁，见 auth.ts）
  if (!(await isAuthed(request, env))) return httpError(401, '未登录或会话已过期')

  if (segments[0] === 'records') {
    if (method === 'GET' && segments.length === 1) return listRecords(request, env)
    if (method === 'PATCH' && segments.length === 2) return updateRecord(request, env, segments[1]!)
  }

  if (segments[0] === 'plates') {
    if (method === 'GET' && segments.length === 1) return listPlates(request, env)
    if (method === 'GET' && segments.length === 3 && segments[2] === 'counts') {
      return plateCounts(request, env, decodeURIComponent(segments[1]!))
    }
    if (method === 'POST' && segments.length === 3 && segments[2] === 'status') {
      return setPlateStatus(request, env, decodeURIComponent(segments[1]!))
    }
  }

  if (segments[0] === 'overview' && method === 'GET' && segments.length === 1) {
    return overview(request, env)
  }

  if (segments[0] === 'plate-groups' && method === 'GET' && segments.length === 1) {
    return plateGroups(request, env)
  }

  return httpError(404, '未知接口')
}
