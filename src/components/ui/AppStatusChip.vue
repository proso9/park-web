<script setup lang="ts">
import { computed } from 'vue'
import type { RecordStatus } from '@/data/types'

const props = defineProps<{
  status: RecordStatus
}>()

// 状态配色沿用低饱和 token：未处理桃色、已处理薄荷青、误报中性淡
const chipCls = computed(
  () =>
    ({
      0: 'bg-accent-mist text-accent-deep',
      1: 'bg-status-ok/12 text-status-ok',
      2: 'bg-accent-mist/60 text-ink-muted',
    })[props.status],
)

const dotCls = computed(
  () =>
    ({
      0: 'bg-accent',
      1: 'bg-status-ok',
      2: 'bg-ink-faint',
    })[props.status],
)

const LABELS: Record<RecordStatus, string> = {
  0: '未处理',
  1: '已处理',
  2: '误报',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-medium"
    :class="chipCls"
  >
    <span class="size-1.5 rounded-full" :class="dotCls" aria-hidden="true" />
    {{ LABELS[status] }}
  </span>
</template>
