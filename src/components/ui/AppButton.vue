<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'primary' | 'soft' | 'ghost' | 'danger'
    small?: boolean
    icon?: string
    disabled?: boolean
  }>(),
  { tone: 'soft', small: false, icon: '', disabled: false },
)
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-control font-medium transition-all disabled:pointer-events-none disabled:opacity-50"
    :class="[
      small ? 'px-3 py-1.5 text-caption' : 'px-4 py-2 text-body',
      {
        primary:
          'bg-accent-gradient text-foam shadow-surface hover:brightness-[1.04] focus-visible:outline-accent',
        soft: 'bg-accent-mist text-accent-deep hover:bg-accent-mist/70',
        ghost:
          'border border-stroke-strong bg-foam/40 text-ink-soft hover:border-stroke hover:bg-foam',
        danger:
          'bg-status-alert/12 text-status-alert hover:bg-status-alert/20 border border-status-alert/25',
      }[tone],
    ]"
    :disabled="disabled"
  >
    <svg
      v-if="icon"
      viewBox="0 0 24 24"
      class="size-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      v-html="icon"
    />
    <slot />
  </button>
</template>