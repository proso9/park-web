import { createRouter, createWebHistory } from 'vue-router'
import StyleGuide from '@/views/StyleGuide.vue'
import OverviewPage from '@/views/OverviewPage.vue'
import DetailsPage from '@/views/DetailsPage.vue'
import ApprovalPage from '@/views/ApprovalPage.vue'
import SettingsPage from '@/views/SettingsPage.vue'

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
      component: OverviewPage,
    },
    {
      path: '/details',
      name: 'details',
      component: DetailsPage,
    },
    {
      path: '/approval',
      name: 'approval',
      component: ApprovalPage,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
    },
    {
      path: '/style-guide',
      name: 'style-guide',
      component: StyleGuide,
    },
  ],
})

export default router
