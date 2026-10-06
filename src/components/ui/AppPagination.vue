<script setup lang="ts">
import { computed } from 'vue'
import AppButton from './AppButton.vue'

/**
 * 轻量分页：上一页 / 下一页 + 页码与总量。
 * 服务端分页专用，不持有状态，页码由父组件写回。
 */
const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    total: number
    /** 条数文案，如「条记录」「台车辆」 */
    unit?: string
  }>(),
  { unit: '条记录' },
)

const emit = defineEmits<{
  update: [page: number]
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const canPrev = computed(() => props.page > 1)
const canNext = computed(() => props.page < pageCount.value)
const pageLabel = computed(() => `第 ${props.page} / ${pageCount.value} 页`)
const totalLabel = computed(() => `共 ${props.total} ${props.unit}`)
</script>

<template>
  <div
    v-if="total > 0"
    class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-stroke/60 px-5 py-3.5"
  >
    <span class="text-caption text-ink-muted">{{ totalLabel }}</span>
    <span class="text-caption nums-tabular text-ink-soft">{{ pageLabel }}</span>
    <div class="flex items-center gap-1.5">
      <AppButton tone="ghost" small :disabled="!canPrev" @click="emit('update', page - 1)">
        ← 上一页
      </AppButton>
      <AppButton tone="ghost" small :disabled="!canNext" @click="emit('update', page + 1)">
        下一页 →
      </AppButton>
    </div>
  </div>
</template>
