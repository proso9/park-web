<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { AppButton, AppSurface } from '@/components/ui'

const auth = useAuthStore()

const password = ref('')
const error = ref('')
const submitting = ref(false)

// ===== Cloudflare Turnstile 人机验证：显式渲染，token 一次性，登录失败后 reset 重取 =====
// sitekey 与服务端 TURNSTILE_SECRET 必须配套：dev 用官方测试对（自动通过，配 .dev.vars
// 的测试 secret 即可完整联调登录）；生产构建用真实 sitekey（配 wrangler secret put 的真实 secret）。
const TURNSTILE_SITE_KEY = import.meta.env.DEV
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAFP97LcPO5tyGOwU'
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TURNSTILE_ACTION = 'login'

interface TurnstileApi {
  render: (el: HTMLElement, params: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

function getTurnstile(): TurnstileApi | null {
  return (window as { turnstile?: TurnstileApi }).turnstile ?? null
}

type WidgetState = 'loading' | 'ready' | 'failed'
const widgetBox = ref<HTMLElement | null>(null)
const widgetState = ref<WidgetState>('loading')
const turnstileToken = ref('')
let widgetId: string | null = null

function loadTurnstileScript(): Promise<void> {
  if (getTurnstile() !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = TURNSTILE_SRC
    el.async = true
    el.addEventListener('load', () => resolve())
    el.addEventListener('error', () => reject(new Error('Turnstile 脚本加载失败')))
    document.head.appendChild(el)
  })
}

async function mountTurnstile(): Promise<void> {
  widgetState.value = 'loading'
  try {
    await loadTurnstileScript()
  } catch {
    widgetState.value = 'failed'
    return
  }
  const api = getTurnstile()
  if (api === null || widgetBox.value === null) return
  widgetId = api.render(widgetBox.value, {
    sitekey: TURNSTILE_SITE_KEY,
    action: TURNSTILE_ACTION,
    theme: 'light',
    size: 'flexible',
    callback: (token: unknown) => {
      turnstileToken.value = typeof token === 'string' ? token : ''
    },
    'expired-callback': () => {
      turnstileToken.value = ''
    },
    'error-callback': () => {
      turnstileToken.value = ''
    },
  })
  widgetState.value = 'ready'
}

/** token 已在服务端核销：无论哪一步失败都要换新 token，重跑一次验证 */
function resetTurnstile(): void {
  turnstileToken.value = ''
  if (widgetId !== null) getTurnstile()?.reset(widgetId)
}

// 登录卡片入场：透明上浮一次，统一线性弹簧
const entered = ref(false)
onMounted(() => {
  entered.value = true
  void mountTurnstile()
})
onBeforeUnmount(() => {
  if (widgetId !== null) getTurnstile()?.remove(widgetId)
})

const ICON_LOCK =
  '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>'

/** 输入框样式与全站控件一致：foam 底 + 弹簧聚焦 */
const inputCls =
  'h-11 w-full rounded-control border border-stroke-strong bg-foam/60 px-4 text-body ' +
  'font-medium text-ink outline-none transition-all duration-[var(--duration-spring)] ease-spring ' +
  'placeholder:text-ink-faint hover:border-stroke focus:border-accent focus:bg-foam ' +
  'focus:ring-2 focus:ring-accent/20 disabled:pointer-events-none disabled:opacity-60'

async function submit() {
  if (submitting.value) return
  if (!password.value) {
    error.value = '请输入访问密码'
    return
  }
  if (!turnstileToken.value) {
    error.value = '请先完成人机验证'
    return
  }
  submitting.value = true
  error.value = ''
  const message = await auth.login(password.value, turnstileToken.value)
  if (message !== null) {
    error.value = message
    password.value = ''
    resetTurnstile()
  }
  submitting.value = false
}
</script>

<template>
  <main class="relative flex min-h-dvh items-center justify-center px-6">
    <div
      class="w-full max-w-sm transition-all duration-[var(--duration-spring)] ease-spring"
      :class="entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
    >
      <AppSurface tone="strong" class="p-8">
        <div class="flex flex-col items-center text-center">
          <span
            class="grid size-12 place-items-center rounded-control bg-accent-mist/70 text-accent-deep"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              v-html="ICON_LOCK"
            />
          </span>
          <h1 class="mt-4 text-title font-bold text-ink">访问验证</h1>
          <p class="mt-1.5 text-caption text-ink-muted">仅限授权访问，请输入密码查看停车异常数据</p>
        </div>

        <!-- AppButton 是 type=button：点击与输入框回车都汇到 submit，submitting 做防重入 -->
        <form class="mt-7 space-y-4" @submit.prevent="submit">
          <div>
            <label class="sr-only" for="access-password">访问密码</label>
            <input
              id="access-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="访问密码"
              :disabled="submitting"
              :class="inputCls"
            />
          </div>
          <!-- Turnstile widget 注入位：脚本/组件加载失败时用浮层占位提示，渲染成功后浮层消失 -->
          <div class="relative min-h-[65px] overflow-hidden rounded-control">
            <span
              v-if="widgetState === 'loading'"
              class="absolute inset-0 grid place-items-center text-micro text-ink-faint"
            >
              人机验证加载中…
            </span>
            <span
              v-else-if="widgetState === 'failed'"
              class="absolute inset-0 grid place-items-center text-micro font-medium text-status-alert"
            >
              人机验证组件加载失败，请刷新页面重试
            </span>
            <div ref="widgetBox" />
          </div>
          <AppButton
            tone="primary"
            class="w-full justify-center"
            :disabled="submitting || turnstileToken === ''"
            @click="submit"
          >
            {{ submitting ? '验证中…' : turnstileToken ? '进入' : '完成验证后进入' }}
          </AppButton>
        </form>

        <p v-if="error" class="mt-4 text-center text-caption font-medium text-status-alert">
          {{ error }}
        </p>
        <p v-else-if="auth.expired" class="mt-4 text-center text-caption text-status-warn">
          登录已过期，请重新输入密码
        </p>
      </AppSurface>

      <p class="mt-6 text-center text-micro text-ink-faint">Park · 异常车辆监控台</p>
    </div>
  </main>
</template>
