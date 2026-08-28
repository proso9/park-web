<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'

const route = useRoute()

// 导航顺序：在顺序内前进 = 新页从右侧进入，后退 = 新页从左侧进入
const NAV_ORDER = ['overview', 'details', 'approval', 'settings', 'style-guide']

const indexOf = (name: unknown) => {
  const i = NAV_ORDER.indexOf(String(name ?? ''))
  return i < 0 ? 0 : i
}

const transitionName = ref('')
let prevIndex = indexOf(route.name)

watch(
  () => route.path,
  () => {
    const idx = indexOf(route.name)
    transitionName.value = idx >= prevIndex ? 'page-slide-right' : 'page-slide-left'
    prevIndex = idx
  },
)
</script>

<template>
  <div class="min-h-dvh">
    <AppSidebar />
    <main class="relative ml-20 min-h-dvh overflow-hidden">
      <RouterView v-slot="{ Component }">
        <Transition :name="transitionName" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>