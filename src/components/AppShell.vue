<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
</script>

<template>
  <div class="min-h-dvh">
    <AppSidebar />
    <main class="relative ml-20 min-h-dvh overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>
