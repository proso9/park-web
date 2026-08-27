<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    direction: 'up' | 'down'
    favorable?: boolean
    arrow?: boolean
  }>(),
  { arrow: true },
)

const isFavorable = computed(() => props.favorable ?? props.direction === 'up')

const colorClass = computed(() => {
  if (props.direction === 'up') return 'text-trend-up'
  return isFavorable.value ? 'text-trend-down' : 'text-status-alert'
})

const glyph = computed(() => (props.direction === 'up' ? '↗' : '↘'))
</script>

<template>
  <span class="inline-flex items-center gap-1 text-caption font-medium" :class="colorClass">
    <span v-if="arrow" aria-hidden="true">{{ glyph }}</span>
    <slot />
  </span>
</template>
