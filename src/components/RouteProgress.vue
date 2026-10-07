<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

/**
 * 路由懒加载 chunk 的下载指示：固定顶部的细进度条。
 * 导航开始 200ms 后仍未完成才淡入（预取命中时全程不可见）；
 * 宽度两段式推进（60% → 100%）后淡出，缓动沿用全站弹簧 token。
 */
const router = useRouter()

const visible = ref(false)
const width = ref('0%')

let showTimer: number | undefined
let hideTimer: number | undefined
const removers: Array<() => void> = []

function clearTimers() {
  if (showTimer !== undefined) window.clearTimeout(showTimer)
  if (hideTimer !== undefined) window.clearTimeout(hideTimer)
  showTimer = undefined
  hideTimer = undefined
}

function reset() {
  clearTimers()
  visible.value = false
  width.value = '0%'
}

onMounted(() => {
  removers.push(
    router.beforeEach(() => {
      reset()
      showTimer = window.setTimeout(() => {
        width.value = '60%'
        visible.value = true
      }, 200)
    }),
  )
  removers.push(
    router.afterEach(() => {
      if (!visible.value) {
        reset()
        return
      }
      clearTimers()
      width.value = '100%'
      hideTimer = window.setTimeout(reset, 420)
    }),
  )
  removers.push(router.onError(reset))
})

onBeforeUnmount(() => {
  reset()
  for (const remove of removers) remove()
})
</script>

<template>
  <!-- 纯视觉指示：路由目标页本身会渲染内容，无需向读屏器播报 -->
  <div class="pointer-events-none fixed inset-x-0 top-0 z-50" aria-hidden="true">
    <div
      class="h-[2px] bg-accent-gradient transition-[width,opacity] ease-spring duration-[var(--duration-spring)]"
      :class="visible ? 'opacity-100' : 'opacity-0'"
      :style="{ width }"
    />
  </div>
</template>
