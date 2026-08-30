<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useParkStore } from '@/stores/park'
import { AppButton, AppSurface } from '@/components/ui'

const store = useParkStore()

// ===== 图标（描边风格，与审批页一致） =====
const ICON = {
  minus: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  car: '<rect x="3" y="8" width="18" height="9" rx="2.5"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  trash:
    '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M7 7l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
} as const

// ===== 车牌规范化：全角转半角 + 统一大写 + 去掉空格与间隔点/横线等符号，只留字母数字与汉字 =====
function normalizePlate(raw: string): string {
  return raw
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^0-9A-Z\u4e00-\u9fff]/g, '')
}

// 匹配范围是全量记录车牌（移除适用于任何审批状态的车辆），排除缺失占位「-」
const allPlates = computed<string[]>(() =>
  [...new Set(store.sourceRecords.map((r) => r.plate))]
    .filter((p) => p !== '' && p !== '-')
    .sort((a, b) => a.localeCompare(b)),
)

const normIndex = computed<[string, string][]>(() =>
  allPlates.value.map((p) => [p, normalizePlate(p)]),
)

const plateByNorm = computed<Map<string, string>>(() => {
  const map = new Map<string, string>()
  for (const [plate, np] of normIndex.value) {
    if (!map.has(np)) map.set(np, plate)
  }
  return map
})

// ===== 已选车牌 =====
const selected = ref<string[]>([])
const resultMsg = ref('')

function addSelected(plate: string) {
  if (!selected.value.includes(plate)) selected.value = [...selected.value, plate]
}

function dropSelected(plate: string) {
  selected.value = selected.value.filter((p) => p !== plate)
}

// ===== 手动输入 + 模糊建议（悬浮下拉，定位与关闭处理同 AppSelect） =====
const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const inputBox = ref<HTMLElement | null>(null)
const suggestOpen = ref(false)
const suggestIndex = ref(-1)
const menuStyle = ref({ left: '0px', top: '0px', width: '0px' })

const suggestions = computed<string[]>(() => {
  const q = normalizePlate(query.value)
  if (!q) return []
  const starts: string[] = []
  const contains: string[] = []
  for (const [plate, np] of normIndex.value) {
    if (np.startsWith(q)) starts.push(plate)
    else if (np.includes(q)) contains.push(plate)
  }
  return [...starts, ...contains].slice(0, 6)
})

watch(query, () => {
  suggestIndex.value = -1
  if (suggestions.value.length) openSuggest()
  else suggestOpen.value = false
})

function positionMenu() {
  const el = inputEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  menuStyle.value = {
    left: `${rect.left}px`,
    top: `${rect.bottom + 6}px`,
    width: `${rect.width}px`,
  }
}

function openSuggest() {
  positionMenu()
  suggestOpen.value = true
}

function closeSuggest() {
  suggestOpen.value = false
}

function pickSuggestion(plate: string) {
  addSelected(plate)
  query.value = ''
  resultMsg.value = ''
  inputEl.value?.focus()
}

function onKeydown(dir: 'down' | 'up') {
  if (!suggestOpen.value) {
    if (suggestions.value.length) openSuggest()
    return
  }
  const len = suggestions.value.length
  if (!len) return
  suggestIndex.value =
    dir === 'down' ? (suggestIndex.value + 1) % len : (suggestIndex.value - 1 + len) % len
}

function onEnter() {
  if (!suggestOpen.value || !suggestions.value.length) return
  const idx = suggestIndex.value >= 0 ? suggestIndex.value : 0
  const plate = suggestions.value[idx]
  if (plate) pickSuggestion(plate)
}

function onFocus() {
  if (query.value && suggestions.value.length) openSuggest()
}

function onDocClick(e: MouseEvent) {
  if (!suggestOpen.value) return
  if (inputBox.value?.contains(e.target as Node)) return
  suggestOpen.value = false
}

function onReposition() {
  if (suggestOpen.value) positionMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('resize', onReposition)
  document.addEventListener('scroll', onReposition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', onReposition)
  document.removeEventListener('scroll', onReposition, true)
})

// ===== 模式切换 =====
type Mode = 'input' | 'import'
const mode = ref<Mode>('input')

function setMode(next: Mode) {
  mode.value = next
  if (next !== 'input') closeSuggest()
}

// ===== 批量导入：每行一个车牌，唯一候选自动加入，多候选待确认，无候选标记未找到 =====
interface ImportRow {
  raw: string
  status: 'added' | 'confirm' | 'missing'
  plate: string
  candidates: string[]
}

const importText = ref('')
const importRows = ref<ImportRow[]>([])

const importStats = computed(() => ({
  added: importRows.value.filter((r) => r.status === 'added').length,
  confirm: importRows.value.filter((r) => r.status === 'confirm').length,
  missing: importRows.value.filter((r) => r.status === 'missing').length,
}))

function parseImport() {
  const lines = [
    ...new Set(
      importText.value
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ]
  const rows: ImportRow[] = []
  for (const raw of lines) {
    const nq = normalizePlate(raw)
    if (!nq) continue
    const exact = plateByNorm.value.get(nq)
    if (exact) {
      addSelected(exact)
      rows.push({ raw, status: 'added', plate: exact, candidates: [] })
      continue
    }
    const cands: string[] = []
    for (const [plate, np] of normIndex.value) {
      if (np.includes(nq) || nq.includes(np)) cands.push(plate)
      if (cands.length >= 8) break
    }
    if (cands.length === 1 && cands[0]) {
      addSelected(cands[0])
      rows.push({ raw, status: 'added', plate: cands[0], candidates: [] })
    } else if (cands.length > 1) {
      rows.push({ raw, status: 'confirm', plate: '', candidates: cands })
    } else {
      rows.push({ raw, status: 'missing', plate: '', candidates: [] })
    }
  }
  importRows.value = rows
}

function confirmCandidate(row: ImportRow, plate: string) {
  row.status = 'added'
  row.plate = plate
  row.candidates = []
  addSelected(plate)
  resultMsg.value = ''
}

// ===== 执行移除 =====
function runRemove() {
  if (!selected.value.length) return
  const affected = store.removePlates(selected.value)
  const skipped = selected.value.length - affected
  resultMsg.value =
    skipped > 0
      ? `已移除 ${affected} 台 · ${skipped} 台此前已是移除状态`
      : `已移除 ${affected} 台车辆`
  selected.value = []
  importRows.value = []
  importText.value = ''
  query.value = ''
}
</script>

<template>
  <AppSurface tone="glass" as="section" class="mt-4 p-5">
    <div class="flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        class="size-4 text-status-alert"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        v-html="ICON.minus"
      />
      <h2 class="text-heading font-semibold text-ink">快速移除</h2>
    </div>
    <p class="mt-1 text-caption text-ink-muted">
      输入或导入车牌，批量标记为已移除，之后可在列表中逐台恢复。
    </p>

    <div class="mt-4 flex gap-2">
      <AppButton
        :tone="mode === 'input' ? 'primary' : 'ghost'"
        small
        :icon="ICON.car"
        @click="setMode('input')"
      >
        输入车牌
      </AppButton>
      <AppButton
        :tone="mode === 'import' ? 'primary' : 'ghost'"
        small
        :icon="ICON.list"
        @click="setMode('import')"
      >
        批量导入
      </AppButton>
    </div>

    <!-- 手动输入：模糊匹配建议 -->
    <div v-if="mode === 'input'" ref="inputBox" class="mt-3">
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        role="combobox"
        :aria-expanded="suggestOpen"
        placeholder="输入部分车牌，如 ADN060"
        class="w-full rounded-control border border-stroke bg-foam/70 px-3 py-2 text-body text-ink transition-colors duration-[var(--duration-spring)] ease-spring placeholder:text-ink-faint focus:border-accent focus:outline-none"
        @focus="onFocus"
        @keydown.down.prevent="onKeydown('down')"
        @keydown.up.prevent="onKeydown('up')"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="closeSuggest"
      />
      <p class="mt-2 text-micro text-ink-faint">回车或点击建议加入已选，支持不完整输入。</p>
    </div>

    <!-- 批量导入：每行一个车牌 -->
    <div v-else class="mt-3">
      <textarea
        v-model="importText"
        rows="4"
        placeholder="每行一个车牌号，支持不完整输入"
        class="w-full resize-none rounded-control border border-stroke bg-foam/70 px-3 py-2 text-body text-ink transition-colors duration-[var(--duration-spring)] ease-spring placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <AppButton
          tone="soft"
          small
          :icon="ICON.check"
          :disabled="!importText.trim()"
          @click="parseImport"
        >
          解析并加入
        </AppButton>
        <span v-if="importRows.length" class="text-caption text-ink-muted">
          自动匹配 {{ importStats.added }} · 待确认 {{ importStats.confirm }} · 未找到
          {{ importStats.missing }}
        </span>
      </div>

      <ul
        v-if="importRows.length"
        class="scrollbar-slim mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-0.5"
      >
        <li
          v-for="(row, i) in importRows"
          :key="`${row.raw}-${i}`"
          class="flex flex-wrap items-center gap-2 rounded-control border border-stroke bg-foam/40 px-3 py-1.5 text-caption"
        >
          <template v-if="row.status === 'added'">
            <svg
              viewBox="0 0 24 24"
              class="size-3.5 shrink-0 text-status-ok"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              v-html="ICON.check"
            />
            <span class="nums-tabular text-ink">{{ row.plate }}</span>
            <span v-if="row.raw !== row.plate" class="text-ink-faint">来自「{{ row.raw }}」</span>
          </template>
          <template v-else-if="row.status === 'confirm'">
            <span class="nums-tabular text-ink-soft">{{ row.raw }}</span>
            <span class="text-ink-faint">待确认</span>
            <button
              v-for="c in row.candidates"
              :key="c"
              type="button"
              class="chip transition-transform duration-[var(--duration-spring)] ease-spring hover:-translate-y-px"
              @click="confirmCandidate(row, c)"
            >
              {{ c }}
            </button>
          </template>
          <template v-else>
            <span class="nums-tabular text-ink-faint">{{ row.raw }}</span>
            <span class="text-ink-faint">未找到</span>
          </template>
        </li>
      </ul>
    </div>

    <!-- 已选车牌 -->
    <div v-if="selected.length" class="mt-4 border-t border-stroke/60 pt-3">
      <div class="flex items-center justify-between">
        <p class="text-caption font-medium text-ink-muted">已选 {{ selected.length }} 台</p>
        <button
          type="button"
          class="text-micro text-ink-faint transition-colors duration-[var(--duration-spring)] ease-spring hover:text-status-alert"
          @click="selected = []"
        >
          清空
        </button>
      </div>
      <ul class="scrollbar-slim mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
        <li v-for="p in selected" :key="p" class="chip">
          <span class="nums-tabular">{{ p }}</span>
          <button
            type="button"
            aria-label="从已选中移除"
            class="flex size-4 items-center justify-center rounded-pill text-accent-deep/70 transition-colors duration-[var(--duration-spring)] ease-spring hover:text-accent-deep"
            @click="dropSelected(p)"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-3"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              v-html="ICON.x"
            />
          </button>
        </li>
      </ul>
    </div>

    <div class="mt-4">
      <AppButton
        tone="danger"
        class="w-full"
        :icon="ICON.trash"
        :disabled="!selected.length"
        @click="runRemove"
      >
        移除所选{{ selected.length ? `（${selected.length} 台）` : '车辆' }}
      </AppButton>
      <p v-if="resultMsg" class="mt-2 text-caption text-status-ok">{{ resultMsg }}</p>
    </div>

    <!-- 建议下拉：Teleport 到 body，避开侧栏圆角裁切 -->
    <Teleport to="body">
      <Transition name="ddown">
        <div v-if="suggestOpen" class="fixed z-50" :style="menuStyle">
          <ul
            role="listbox"
            class="scrollbar-slim max-h-48 overflow-auto rounded-surface border border-stroke bg-foam/95 p-1.5 shadow-lift"
          >
            <li
              v-for="(p, i) in suggestions"
              :key="p"
              role="option"
              :aria-selected="i === suggestIndex"
              class="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-body transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60"
              :class="i === suggestIndex ? 'bg-accent-mist/60 text-accent-deep' : 'text-ink-soft'"
              @mousedown.prevent
              @click="pickSuggestion(p)"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-3.5 shrink-0 text-ink-faint"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="ICON.car"
              />
              <span class="nums-tabular">{{ p }}</span>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </AppSurface>
</template>

<style scoped>
/* 建议下拉弹出：与 AppSelect 相同的线性弹簧过渡（不用 backdrop-filter，避免透明期 blur 突变） */
.ddown-enter-active,
.ddown-leave-active {
  transition:
    opacity var(--duration-spring) var(--ease-spring),
    transform var(--duration-spring) var(--ease-spring);
}

.ddown-enter-from,
.ddown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.ddown-enter-to,
.ddown-leave-from {
  transform: translateY(0);
}
</style>
