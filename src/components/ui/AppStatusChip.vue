<script setup lang="ts">
import type { ApprovalStatus } from '@/data/types'

const LABELS: Record<ApprovalStatus, string> = {
  pending: '待处理',
  blacklisted: '已拉黑',
  removed: '已移除',
}

withDefaults(
  defineProps<{
    status: ApprovalStatus
  }>(),
  {},
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-medium"
    :class="{
      pending: 'bg-accent-mist text-accent-deep',
      blacklisted: 'bg-status-alert/12 text-status-alert',
      removed: 'bg-accent-mist/60 text-ink-muted',
    }[status]"
  >
    <span
      class="size-1.5 rounded-full"
      :class="{
        pending: 'bg-accent',
        blacklisted: 'bg-status-alert',
        removed: 'bg-ink-faint',
      }[status]"
      aria-hidden="true"
    />
    {{ LABELS[status] }}
  </span>
</template>