import { createRouter, createWebHistory } from 'vue-router'

// 页面组件全部懒加载：按需拉取路由 chunk，避免首访一次性下载全部视图
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/overview',
    },
    {
      path: '/overview',
      name: 'overview',
      component: () => import('@/views/OverviewPage.vue'),
    },
    {
      path: '/details',
      name: 'details',
      component: () => import('@/views/DetailsPage.vue'),
    },
    {
      path: '/approval',
      name: 'approval',
      component: () => import('@/views/ApprovalPage.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue'),
    },
    {
      path: '/style-guide',
      name: 'style-guide',
      component: () => import('@/views/StyleGuide.vue'),
    },
  ],
})

// 浏览器空闲时预取登录后要用的业务页 chunk，侧栏切换不卡在下载上（不占用首屏关键路径）
export function prefetchRouteChunks(): void {
  const run = () => {
    void import('@/views/OverviewPage.vue')
    void import('@/views/DetailsPage.vue')
    void import('@/views/ApprovalPage.vue')
    void import('@/views/SettingsPage.vue')
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 4000 })
  } else {
    setTimeout(run, 1500)
  }
}

export default router
