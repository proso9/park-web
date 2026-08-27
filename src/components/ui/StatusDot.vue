<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'ok' | 'warn' | 'idle' | 'alert'
    label?: string
  }>(),
  { tone: 'idle' },
)
</script>

<template>
  <span
    class="inline-block size-2 shrink-0 rounded-full"
    :class="{
      'bg-status-ok': tone === 'ok',
      'bg-status-warn': tone === 'warn',
      'bg-status-idle': tone === 'idle',
      'bg-status-alert': tone === 'alert',
    }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>
