<script setup lang="ts">
withDefaults(
  defineProps<{
    orbs?: boolean
  }>(),
  { orbs: true },
)
</script>

<template>
  <div class="relative min-h-dvh overflow-x-hidden bg-canvas text-ink">
    <div
      v-if="orbs"
      class="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute -top-24 right-[8%] size-[min(70vw,540px)] rounded-full bg-accent/40 blur-orb"
      />
      <div
        class="absolute top-[38%] -left-32 size-[min(50vw,380px)] rounded-full bg-accent-soft/30 blur-orb"
      />
      <div
        class="absolute right-[30%] -bottom-28 size-[min(40vw,280px)] rounded-full bg-accent-muted/35 blur-orb"
      />
    </div>
    <div class="relative z-10">
      <slot />
    </div>
  </div>
</template>
