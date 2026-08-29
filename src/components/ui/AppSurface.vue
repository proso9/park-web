<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: 'div' | 'section' | 'article' | 'ul'
    tone?: 'glass' | 'strong' | 'ghost'
  }>(),
  {
    as: 'div',
    tone: 'glass',
  },
)
</script>

<template>
  <component
    :is="as"
    :class="{
      surface: tone === 'glass',
      'surface-strong': tone === 'strong',
      'surface-ghost': tone === 'ghost',
    }"
  >
    <slot />
  </component>
</template>
