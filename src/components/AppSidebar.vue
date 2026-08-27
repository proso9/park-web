<script setup lang="ts">
import { useRoute } from 'vue-router'

interface NavItem {
  name: string
  to: string
  label: string
  icon: string
}

const route = useRoute()

const navItems: NavItem[] = [
  {
    name: 'overview',
    to: '/overview',
    label: '概览',
    icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  },
  {
    name: 'details',
    to: '/details',
    label: '详细',
    icon: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>',
  },
  {
    name: 'approval',
    to: '/approval',
    label: '审批',
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12l2.4 2.4 4.6-4.8"/>',
  },
  {
    name: 'settings',
    to: '/settings',
    label: '设置',
    icon: '<path d="M4 7h16"/><circle cx="9" cy="7" r="2"/><path d="M4 17h16"/><circle cx="15" cy="17" r="2"/>',
  },
]

const isActive = (item: NavItem) => item.name === route.name
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-30 flex w-20 flex-col bg-canvas"
    aria-label="主导航"
  >
    <!-- 顶部 logo 占位：墨色字标，不是大色块 -->
    <div class="flex justify-center pt-8">
      <span class="text-title font-extrabold tracking-tight text-ink">AI</span>
    </div>

    <!-- 四个模块垂直居中，间隔留松 -->
    <nav class="flex flex-1 flex-col justify-center gap-8 py-10">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        class="group flex flex-col items-center gap-2.5 rounded-control px-2 py-4 transition-colors"
        :class="isActive(item) ? 'bg-accent-mist' : 'hover:bg-accent-mist/50'"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="isActive(item) ? 'text-accent-deep' : 'text-ink-faint group-hover:text-ink-muted'"
          aria-hidden="true"
          v-html="item.icon"
        />
        <span
          class="text-micro"
          :class="
            isActive(item) ? 'font-medium text-ink' : 'text-ink-faint group-hover:text-ink-muted'
          "
        >
          {{ item.label }}
        </span>
      </RouterLink>
    </nav>
  </aside>
</template>
