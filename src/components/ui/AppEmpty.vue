<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title?: string
    hint?: string
  }>(),
  { icon: '', title: '', hint: '' },
)
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-16 text-center">
    <span
      class="grid size-14 place-items-center rounded-surface bg-accent-mist/60 text-ink-faint"
      aria-hidden="true"
    >
      <svg
        v-if="icon"
        viewBox="0 0 24 24"
        class="size-6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        v-html="icon"
      />
    </span>
    <div class="space-y-1">
      <p v-if="title" class="text-heading font-semibold text-ink">{{ title }}</p>
      <p v-if="hint" class="text-body text-ink-muted">{{ hint }}</p>
    </div>
    <div v-if="$slots.default" class="mt-1">
      <slot />
    </div>
  </div>
</template>
