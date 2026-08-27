import { createRouter, createWebHistory } from 'vue-router'
import StyleGuide from '@/views/StyleGuide.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'style-guide',
      component: StyleGuide,
    },
  ],
})

export default router
