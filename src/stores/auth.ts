import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api, setUnauthorizedHandler } from '@/api/client'
import { invalidateApiCache } from '@/api/cache'

/** 认证状态：checking 启动探测中 / guest 未登录 / authed 已登录 */
export type AuthStatus = 'checking' | 'guest' | 'authed'

/**
 * 单密码认证 store：App.vue 挂载时 check() 探测会话决定进登录页还是应用；
 * 任何业务 API 返回 401（会话过期）经 client 全局回调切回 guest，
 * 重新登录后全量失效读缓存，避免残留上个会话的数据。
 */
export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('checking')
  /** 会话中途过期被切回登录页时为 true，登录页据此提示「登录已过期」 */
  const expired = ref(false)

  setUnauthorizedHandler(() => {
    if (status.value === 'authed') expired.value = true
    status.value = 'guest'
  })

  /** 启动探测：200 直接进应用，401 进登录页 */
  async function check() {
    try {
      await api.checkAuth()
      status.value = 'authed'
    } catch {
      status.value = 'guest'
    }
  }

  /** 登录：成功返回 null，失败返回错误文案（密码不正确 / 人机验证未通过 / 未配置） */
  async function login(password: string, turnstileToken: string): Promise<string | null> {
    try {
      await api.login(password, turnstileToken)
    } catch (err) {
      return err instanceof Error ? err.message : '登录失败，请重试'
    }
    expired.value = false
    invalidateApiCache()
    status.value = 'authed'
    return null
  }

  /** 退出：服务端清 Cookie，前端全量失效缓存；此后任何请求都会回到登录页 */
  async function logout() {
    try {
      await api.logout()
    } catch {
      // 清 Cookie 失败也照常回登录页（本地状态已切 guest）
    }
    invalidateApiCache()
    expired.value = false
    status.value = 'guest'
  }

  return { status, expired, check, login, logout }
})
