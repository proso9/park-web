<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AppAtmosphere from '@/components/AppAtmosphere.vue'
import AppShell from '@/components/AppShell.vue'
import LoginPage from '@/views/LoginPage.vue'
import { useAuthStore } from '@/stores/auth'
import { prefetchRouteChunks } from '@/router'

// 认证门：启动先探测会话，未登录只渲染登录页（AppShell 与业务页面不挂载）
const auth = useAuthStore()
onMounted(() => {
  void auth.check()
})

// 登录成功（含会话探测直接通过）后才空闲预取业务页 chunk：
// 登录页上不预取，避免和 Turnstile 的第三方脚本抢带宽
watch(
  () => auth.status,
  (status) => {
    if (status === 'authed') prefetchRouteChunks()
  },
)
</script>

<template>
  <AppAtmosphere>
    <AppShell v-if="auth.status === 'authed'" />
    <LoginPage v-else-if="auth.status === 'guest'" />
    <!-- checking：会话探测期间的静默占位，避免登录页闪现 -->
    <div v-else class="min-h-dvh" aria-hidden="true" />
  </AppAtmosphere>
</template>
