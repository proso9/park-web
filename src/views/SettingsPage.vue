<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useParkStore } from '@/stores/park'
import { AppButton, AppSurface } from '@/components/ui'
import type { AbnormalVehicle } from '@/data/types'

const store = useParkStore()

// ===== 图标（描边风格） =====
const ICON = {
  repeat: '<path d="M4 10a8 8 0 0114-5"/><path d="M20 14a8 8 0 01-14 5"/><path d="M18 3v4h-4"/><path d="M6 21v-4h4"/>',
  wallet: '<path d="M3 7a2 2 0 012-2h12a2 2 0 012 2"/><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2H3z"/><path d="M16 14h2"/>',
  reset: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-4"/>',
  check: '<path d="M5 12l4 4L19 6"/>',
} as const

// ===== 阈值草稿（保存前可修改） =====
const repeatDraft = ref(store.repeatThreshold)
const feeDraft = ref(store.highFeeThreshold)
const saved = reactive({ repeat: store.repeatThreshold, fee: store.highFeeThreshold })
const saveMsg = ref('')

/** 数字输入框通用样式：半透明 foam 底 + 描边 + 弹簧聚焦 */
const inputCls =
  'h-11 w-32 rounded-control border border-stroke-strong bg-foam/60 px-3 text-right ' +
  'nums-tabular text-body font-semibold text-ink outline-none transition-all ' +
  'duration-[var(--duration-spring)] ease-spring ' +
  'hover:border-stroke focus:border-accent focus:bg-foam focus:ring-2 focus:ring-accent/20'

/** 按当前草稿预演命中车辆数 */
const preview = computed(() => {
  const plates = [...new Set(store.sourceRecords.map((r) => r.plate))].filter((p) => p && p !== '-')
  const byPlate = (p: string): AbnormalVehicle[] =>
    store.sourceRecords.filter((r) => r.plate === p)
  const r = repeatDraft.value > 0 ? repeatDraft.value : store.repeatThreshold
  const f = feeDraft.value > 0 ? feeDraft.value : store.highFeeThreshold
  return {
    repeat: plates.filter((p) => byPlate(p).filter((x) => x.abnormal).length >= r).length,
    fee: plates.filter((p) => byPlate(p).reduce((sum, x) => sum + x.fee, 0) >= f).length,
  }
})

const repeatInvalid = computed(() => repeatDraft.value <= 0 || repeatDraft.value > 100)
const feeInvalid = computed(() => feeDraft.value <= 0 || feeDraft.value > 100000)

const isDirty = computed(() => repeatDraft.value !== saved.repeat || feeDraft.value !== saved.fee)
const canSave = computed(() => isDirty.value && !repeatInvalid.value && !feeInvalid.value)

function save() {
  if (!canSave.value) return
  store.setThresholds(repeatDraft.value, feeDraft.value)
  saved.repeat = store.repeatThreshold
  saved.fee = store.highFeeThreshold
  saveMsg.value = '已保存，概览页已同步生效'
  window.setTimeout(() => (saveMsg.value = ''), 2600)
}

function resetDefaults() {
  repeatDraft.value = 2
  feeDraft.value = 500
}
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-14 sm:px-10 lg:px-14">
    <header class="mb-8 max-w-xl space-y-2">
      <h1 class="text-title font-bold text-ink">设置</h1>
      <p class="text-body text-ink-soft">
        自定义概览页「重点车辆标签」的判定阈值，保存后立即生效并本地保留。
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- 阈值配置表单 -->
      <section class="lg:col-span-2">
        <AppSurface tone="glass" as="section" class="p-6">
          <h2 class="text-heading font-semibold text-ink">概览页阈值</h2>
          <p class="mt-1 text-caption text-ink-muted">
            影响概览页「重点车辆标签」中「屡次异常」与「高额欠费」两类图标的命中范围。
          </p>

          <div class="mt-6 divide-y divide-stroke/70">
            <!-- 屡次异常 -->
            <div class="flex flex-wrap items-center gap-x-6 gap-y-3 py-5">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-control bg-accent-mist/70 text-accent-deep"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  v-html="ICON.repeat"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-body font-medium text-ink">屡次异常阈值</p>
                <p class="mt-0.5 text-caption text-ink-muted">
                  单台车累计 <span class="nums-tabular">≥ {{ repeatDraft }}</span> 条异常记录即计入「屡次异常」
                </p>
              </div>
              <div class="flex items-center gap-2">
                <label class="sr-only" for="repeat-threshold">屡次异常阈值</label>
                <input
                  id="repeat-threshold"
                  v-model.number="repeatDraft"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  class="spring-input"
                  :class="[inputCls, { err: repeatInvalid }]"
                />
                <span class="text-caption text-ink-muted">条</span>
              </div>
            </div>

            <!-- 高额欠费 -->
            <div class="flex flex-wrap items-center gap-x-6 gap-y-3 py-5">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-control bg-mint/15 text-mint"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  v-html="ICON.wallet"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-body font-medium text-ink">高额欠费阈值</p>
                <p class="mt-0.5 text-caption text-ink-muted">
                  单台车累计费用 <span class="nums-tabular">≥ ¥{{ feeDraft }}</span> 即计入「高额欠费」
                </p>
              </div>
              <div class="flex items-center gap-2">
                <label class="sr-only" for="fee-threshold">高额欠费阈值</label>
                <span class="text-caption text-ink-muted">¥</span>
                <input
                  id="fee-threshold"
                  v-model.number="feeDraft"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  class="spring-input"
                  :class="[inputCls, { err: feeInvalid }]"
                />
              </div>
            </div>
          </div>

          <!-- 操作区 -->
          <div class="mt-6 flex flex-wrap items-center gap-3">
            <AppButton
              tone="primary"
              :icon="ICON.check"
              :disabled="!canSave"
              @click="save"
            >
              保存设置
            </AppButton>
            <AppButton tone="ghost" :icon="ICON.reset" @click="resetDefaults">
              恢复默认
            </AppButton>
            <span
              v-if="saveMsg"
              class="inline-flex items-center gap-1.5 text-caption font-medium text-status-ok"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="ICON.check"
              />
              {{ saveMsg }}
            </span>
          </div>
          <p v-if="repeatInvalid || feeInvalid" class="mt-3 text-caption text-status-alert">
            请输入有效阈值：屡次异常 1–100 条，高额欠费 ¥1–¥100000。
          </p>
        </AppSurface>
      </section>

      <!-- 实时预演侧栏 -->
      <aside class="lg:sticky lg:top-8 lg:self-start">
        <AppSurface tone="glass" as="section" class="p-5">
          <h3 class="text-heading font-semibold text-ink">实时预演</h3>
          <p class="mt-1 text-caption text-ink-muted">按当前输入，概览标签会命中以下车辆数</p>

          <ul class="mt-5 space-y-4">
            <li class="flex items-center justify-between gap-3">
              <span class="inline-flex items-center gap-2 text-caption font-medium text-ink-soft">
                <span class="size-2 rounded-full bg-accent-deep" aria-hidden="true" />屡次异常
              </span>
              <span class="nums-tabular text-title font-bold text-ink">{{ preview.repeat }} 台</span>
            </li>
            <li class="flex items-center justify-between gap-3">
              <span class="inline-flex items-center gap-2 text-caption font-medium text-ink-soft">
                <span class="size-2 rounded-full bg-mint" aria-hidden="true" />高额欠费
              </span>
              <span class="nums-tabular text-title font-bold text-ink">{{ preview.fee }} 台</span>
            </li>
          </ul>

          <p class="mt-5 text-micro text-ink-faint">
            {{ isDirty ? '有未保存的修改，保存后概览页即会更新。' : '当前阈值与概览页一致。' }}
          </p>
        </AppSurface>
      </aside>
    </div>
  </main>
</template>

<style scoped>
/* 数字输入清掉原生微调按钮的浏览器默认外观留白更干净，但保留可点击 */
.spring-input {
  appearance: textfield;
}
.spring-input::-webkit-outer-spin-button,
.spring-input::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
}
.spring-input.err {
  border-color: color-mix(in oklab, var(--color-status-alert) 55%, transparent);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-status-alert) 18%, transparent);
}
</style>