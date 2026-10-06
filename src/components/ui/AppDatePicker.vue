<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

/**
 * 网页日期选择：输入框唤起悬浮日历弹窗。
 * - single：单选，选中即关闭；range：日期范围，可点击起止或按住拖拽框选，选完不自动关闭
 * - 手动输入编辑（YYYY-MM-DD 或 “起 ~ 止”），与日历双向下发
 * - 周一作为周起始；今日独立标记；溢出 / 越界日期置灰禁用
 * - 弹窗按可用空间智能上下定位；点击外部 / ESC 关闭
 * - 键盘可导航日历格（方向键 / Home / End / PageUp / PageDown / Enter / Space）
 */
export type DatePickerValue = string | readonly [string, string] | null

type DpMode = 'single' | 'range'
type DpSize = 'normal' | 'small'

interface GridCell {
  date: Date
  iso: string
  inMonth: boolean
}

interface DownInfo {
  date: Date
  iso: string
  x: number
  y: number
}

const props = withDefaults(
  defineProps<{
    mode?: DpMode
    /** 可选范围下限，默认 2000-01-01 */
    min?: string
    /** 可选范围上限，默认今天（审批场景不允许选未来） */
    max?: string
    placeholder?: string
    size?: DpSize
    clearable?: boolean
  }>(),
  {
    mode: 'single',
    min: '2000-01-01',
    max: '',
    placeholder: '',
    size: 'normal',
    clearable: true,
  },
)

const model = defineModel<DatePickerValue>({ default: null })

// ===== 日期工具（本地时区，避免 UTC 偏移） =====
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const
const pad2 = (n: number) => String(n).padStart(2, '0')

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null
  return dt
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const todayIso = toISO(new Date())
const todayDate = new Date()
const maxIso = computed(() => props.max || todayIso)

// ===== 选中与输入 =====
const sel = ref<{ start: Date | null; end: Date | null }>({ start: null, end: null })
const draft = ref('')
const inputFocused = ref(false)

function loadSel(v: DatePickerValue) {
  if (typeof v === 'string' && v) {
    const d = parseISO(v)
    return { start: d, end: d }
  }
  if (Array.isArray(v) && v.length >= 2) {
    const a = parseISO(v[0])
    const b = parseISO(v[1])
    return { start: a, end: b }
  }
  return { start: null, end: null }
}

function writeModel() {
  if (props.mode === 'range') {
    const s = sel.value.start
    const e = sel.value.end
    // 范围模式：起止都选定后才写回，避免出现“半段”选中态
    if (s && e) {
      const [a, b] = s <= e ? [s, e] : [e, s]
      model.value = [toISO(a), toISO(b)] as const
    }
  } else {
    model.value = sel.value.start ? toISO(sel.value.start) : null
  }
}

function formatDraft(): string {
  if (props.mode === 'range') {
    const s = sel.value.start
    const e = sel.value.end
    if (s && e) return `${toISO(s)} ~ ${toISO(e)}`
    if (s) return toISO(s)
    return ''
  }
  return sel.value.start ? toISO(sel.value.start) : ''
}

/** 手动输入解析：单选只认一个日期；范围认 1~2 个日期（自动排序） */
function parseDraft(text: string): { start: Date; end: Date } | null {
  if (props.mode === 'single') {
    const d = parseISO(text)
    return d ? { start: d, end: d } : null
  }
  const tokens = text.match(/\d{4}-\d{1,2}-\d{1,2}/g) ?? []
  const dates = tokens.map((t) => parseISO(t)).filter((d): d is Date => d !== null)
  if (dates.length === 0) return null
  const first = dates[0] as Date
  const second = dates[1] ?? first
  return second < first ? { start: second, end: first } : { start: first, end: second }
}

/** 输入的提交归一化：合法则写入模型，非法则回退为当前模型文案 */
function commitOrRevert() {
  const parsed = parseDraft(draft.value)
  if (props.mode === 'single') {
    if (parsed) {
      sel.value = parsed
      writeModel()
    }
    draft.value = formatDraft()
    return
  }
  // 范围模式：只把输入同步到「待确认」选区，绝不写模型——查询由「确定」按钮触发
  if (parsed) sel.value = parsed
  draft.value = formatDraft()
}

// 外部改动模型时同步（父组件清空 / 回填等）
watch(model, (v) => {
  sel.value = loadSel(v)
  if (!inputFocused.value) draft.value = formatDraft()
})

// ===== 弹窗开关与智能定位 =====
const open = ref(false)
const wrapEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const pos = reactive({ left: 0, top: 0, dir: 'below' as 'below' | 'above' })
const EST_PANEL_H = 372

function positionPanel() {
  const wrap = wrapEl.value
  if (!wrap) return
  const r = wrap.getBoundingClientRect()
  const panelW = panelEl.value?.offsetWidth || r.width
  const panelH = panelEl.value?.offsetHeight || EST_PANEL_H
  const below = window.innerHeight - r.bottom
  const above = r.top
  const dir: 'below' | 'above' = below >= panelH + 12 || below >= above ? 'below' : 'above'
  pos.left = Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8))
  pos.top = dir === 'below' ? r.bottom + 8 : Math.max(8, r.top - panelH - 8)
  pos.dir = dir
}

const panelStyle = computed<CSSProperties>(
  () =>
    ({
      left: `${pos.left}px`,
      top: `${pos.top}px`,
      '--dp-offset': pos.dir === 'below' ? '-8px' : '8px',
    }) as CSSProperties,
)

function openPanel() {
  if (open.value) return
  // 有选中日期时，打开即跳转到对应月份
  const s = sel.value.start
  if (
    s &&
    (s.getFullYear() !== view.value.getFullYear() || s.getMonth() !== view.value.getMonth())
  ) {
    view.value = new Date(s.getFullYear(), s.getMonth(), 1)
  }
  open.value = true
  positionPanel()
  void nextTick(positionPanel)
  const base = s ?? (todayIso < minIso.value ? parseISO(props.min) : todayDate)
  cursor.value = base
  void nextTick(() => focusCell(cursorIndex.value))
}

function closePopup() {
  open.value = false
  resetDrag()
  commitOrRevert()
}

function toggle() {
  if (open.value) closePopup()
  else openPanel()
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value) return
  if (wrapEl.value?.contains(e.target as Node)) return
  if (panelEl.value?.contains(e.target as Node)) return
  closePopup()
}

function onDocKeydown(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') closePopup()
}

function onWrapFocusOut(e: FocusEvent) {
  if (!open.value) return
  const next = e.relatedTarget as Node | null
  if (next && wrapEl.value?.contains(next)) return
  if (next && panelEl.value?.contains(next)) return
  closePopup()
}

function onWindowScroll() {
  if (open.value) positionPanel()
}

// ===== 日历视图 =====
const view = ref(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))

const grid = computed<GridCell[]>(() => {
  const y = view.value.getFullYear()
  const m = view.value.getMonth()
  const first = new Date(y, m, 1)
  const lead = (first.getDay() + 6) % 7 // 周一为 0
  const start = new Date(y, m, 1 - lead)
  const cells: GridCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({ date: d, iso: toISO(d), inMonth: d.getMonth() === m })
  }
  return cells
})

const title = computed(() => `${view.value.getFullYear()} 年 ${view.value.getMonth() + 1} 月`)
const minIso = computed(() => props.min || '2000-01-01')
const canPrev = computed(() => {
  const prev = toISO(new Date(view.value.getFullYear(), view.value.getMonth() - 1, 1))
  return prev >= minIso.value
})
const canNext = computed(() => {
  const next = toISO(new Date(view.value.getFullYear(), view.value.getMonth() + 1, 1))
  return next <= maxIso.value
})

function goMonth(n: number) {
  const y = view.value.getFullYear()
  const m = view.value.getMonth()
  const lastDay = new Date(y, m + 1 + n, 0).getDate()
  const day = Math.min(cursor.value?.getDate() ?? 1, lastDay)
  view.value = new Date(y, m + n, 1)
  cursor.value = new Date(y, m + n, day)
  void nextTick(() => focusCell(cursorIndex.value))
}

// ===== 单元格状态 =====
function isDisabledCell(c: GridCell): boolean {
  return !c.inMonth || c.iso < minIso.value || c.iso > maxIso.value
}

function isTodayCell(c: GridCell): boolean {
  return c.iso === todayIso
}

const rangeStart = computed(() => (props.mode === 'range' ? sel.value.start : null))
const rangeEnd = computed(() => (props.mode === 'range' ? sel.value.end : null))

function isSelectedCell(c: GridCell): boolean {
  if (props.mode === 'range') {
    return (
      c.iso === (rangeStart.value && toISO(rangeStart.value)) ||
      c.iso === (rangeEnd.value && toISO(rangeEnd.value))
    )
  }
  return sel.value.start !== null && c.iso === toISO(sel.value.start)
}

type BandRole = 'start' | 'end' | 'band'

function startEndRole(c: GridCell, s: string | null, e: string | null): BandRole | null {
  if (!s || !e) return null
  const [a, b] = s <= e ? [s, e] : [e, s]
  if (c.iso === a) return a === b ? 'band' : 'start'
  if (c.iso === b) return 'end'
  if (c.iso > a && c.iso < b) return 'band'
  return null
}

const finalRole = (c: GridCell): BandRole | null => {
  const s = rangeStart.value
  const e = rangeEnd.value
  return startEndRole(c, s ? toISO(s) : null, e ? toISO(e) : null)
}

// ===== 拖拽框选（仅范围模式） =====
const DRAG_THRESHOLD = 6 // 手抖容差（像素），未越过阈值视为点击

const drag = reactive<{
  mode: 'idle' | 'pending' | 'dragging'
  pointerId: number
  down: DownInfo | null
  hover: GridCell | null
}>({ mode: 'idle', pointerId: -1, down: null, hover: null })

const cellEls = ref<(HTMLElement | null)[]>([])
const gridEl = ref<HTMLElement | null>(null)

const preview = computed<{ start: string; end: string } | null>(() => {
  if (drag.mode !== 'dragging' || !drag.down) return null
  const h = drag.hover
  const end = h ? h.iso : drag.down.iso
  const [a, b] = drag.down.iso <= end ? [drag.down.iso, end] : [end, drag.down.iso]
  return { start: a, end: b }
})

const previewRoleCell = (c: GridCell): BandRole | null => {
  const p = preview.value
  return startEndRole(c, p ? p.start : null, p ? p.end : null)
}

/** 单元格底色：内部分隔段用方形色条，端点格直接作深色/预览色胶囊端（半圆），接缝平直无方框 */
function cellCls(c: GridCell): string {
  if (props.mode !== 'range') return ''
  // 拖拽预览：只渲染新预览这条平滑胶囊（端部半圆），不再叠加旧确认区的方形底，避免残留直角矩形
  if (drag.mode === 'dragging') {
    const pr = previewRoleCell(c)
    const p = preview.value
    const single = isSingleDayIso(p ? p.start : null, p ? p.end : null)
    if (pr === 'band') return single ? 'bg-accent/35 rounded-full' : 'bg-accent/30'
    if (pr === 'start') return single ? 'bg-accent/35 rounded-full' : 'bg-accent/35 rounded-l-full'
    if (pr === 'end') return single ? 'bg-accent/35 rounded-full' : 'bg-accent/35 rounded-r-full'
    return ''
  }
  const fr = finalRole(c)
  const single = isSingleDay(sel.value.start, sel.value.end)
  // 单日范围（起止同日）显示为圆形深色强调；多日范围内部为方形色条、端点为胶囊半圆
  if (fr === 'band') return single ? 'bg-accent-gradient rounded-full' : 'bg-accent-mist/70'
  if (fr === 'start')
    return single ? 'bg-accent-gradient rounded-full' : 'bg-accent-gradient rounded-l-full'
  if (fr === 'end')
    return single ? 'bg-accent-gradient rounded-full' : 'bg-accent-gradient rounded-r-full'
  // 范围模式只选了起点：该起点格显示为圆形深色强调，形成日期范围后变为胶囊端
  if (isRangeStartOnly(c)) return 'bg-accent-gradient rounded-full'
  return ''
}

/** 范围模式是否「仅选起点、尚未定终点」 */
function isRangeStartOnly(c: GridCell): boolean {
  return (
    props.mode === 'range' &&
    sel.value.start !== null &&
    sel.value.end === null &&
    c.iso === toISO(sel.value.start)
  )
}

/** 范围是否单日（起止同一天）：渲染为圆形深色强调，而非浅色色条 */
function isSingleDay(s: Date | null, e: Date | null): boolean {
  return !!s && !!e && s.getTime() === e.getTime()
}
function isSingleDayIso(s: string | null, e: string | null): boolean {
  return !!s && !!e && s === e
}

/** 日期格按钮文字：端点深色胶囊上用浅字、预览胶囊端用深字描边，内部间隔普通墨字；今日加粗区分 */
function dayBtnClass(c: GridCell): string[] {
  if (isDisabledCell(c)) return ['cursor-not-allowed', 'text-ink-faint']
  const cls: string[] = []
  if (props.mode === 'range') {
    const previewing = drag.mode === 'dragging'
    // 预览期内整段受预览管控，避免与旧确认区间颜色混淆
    const role = previewing ? previewRoleCell(c) : finalRole(c)
    if (role === 'band') {
      // 已确认的单日范围是深色圆点，用浅字；多日色条用墨字
      if (!previewing && isSingleDay(sel.value.start, sel.value.end)) {
        cls.push('font-semibold', 'text-foam')
      } else {
        cls.push('text-ink-soft')
        if (isTodayCell(c)) cls.push('font-semibold', 'text-accent-deep')
      }
    } else if (role) {
      // 端点胶囊端：确认=深色底用浅字；预览=浅色底用深字
      cls.push('font-semibold')
      if (previewing) cls.push('text-accent-deep')
      else cls.push('text-foam')
    } else if (isRangeStartOnly(c)) {
      // 仅选起点：圆形深色强调，浅字
      cls.push('font-semibold', 'text-foam')
    } else {
      cls.push('text-ink-soft', 'hover:bg-accent-mist/70', 'hover:text-accent-deep')
      if (isTodayCell(c)) cls.push('font-semibold', 'text-accent-deep')
    }
  } else if (isSelectedCell(c)) {
    cls.push('bg-accent-gradient', 'font-semibold', 'text-foam', 'shadow-surface')
  } else {
    cls.push('text-ink-soft', 'hover:bg-accent-mist/70', 'hover:text-accent-deep')
    if (isTodayCell(c)) cls.push('font-semibold', 'text-accent-deep')
  }
  return cls
}

/** 今日小圆点颜色：深色端点（确认区间/single选中）上用浅色，其余用强调色 */
function todayDotCls(c: GridCell): string {
  if (isDisabledCell(c)) return 'bg-ink-faint'
  if (props.mode === 'single') return isSelectedCell(c) ? 'bg-foam/90' : 'bg-accent'
  // 仅确认区间的深色端点或「仅选起点」圆形上用浅色圆点；预览期端点仍是浅底，用强调色
  const fr = finalRole(c)
  if (drag.mode === 'dragging') return 'bg-accent'
  const onDark =
    fr === 'start' ||
    fr === 'end' ||
    isRangeStartOnly(c) ||
    (fr === 'band' && isSingleDay(sel.value.start, sel.value.end))
  return onDark ? 'bg-foam/90' : 'bg-accent'
}

function setCellRef(i: number, el: unknown) {
  cellEls.value[i] = el as HTMLElement | null
}

function cellFromTarget(target: EventTarget | null): GridCell | null {
  const el = target instanceof Element ? target.closest<HTMLElement>('[data-idx]') : null
  if (!el) return null
  const idx = Number(el.dataset.idx)
  return grid.value[idx] ?? null
}

function cellAtPoint(x: number, y: number): GridCell | null {
  for (let i = 0; i < cellEls.value.length; i++) {
    const el = cellEls.value[i]
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      const cell = grid.value[i]
      if (cell && !isDisabledCell(cell)) return cell
    }
  }
  return null
}

function isInsideGrid(x: number, y: number): boolean {
  const el = gridEl.value
  if (!el) return false
  const r = el.getBoundingClientRect()
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

function onGridPointerDown(e: PointerEvent) {
  if (props.mode !== 'range' || e.button !== 0) return
  const cell = cellFromTarget(e.target)
  if (!cell || isDisabledCell(cell)) return
  drag.mode = 'pending'
  drag.pointerId = e.pointerId
  drag.down = { date: cell.date, iso: cell.iso, x: e.clientX, y: e.clientY }
  drag.hover = cell
  gridEl.value?.setPointerCapture(e.pointerId)
}

function onGridPointerMove(e: PointerEvent) {
  if (props.mode !== 'range' || drag.mode === 'idle' || e.pointerId !== drag.pointerId) return
  const down = drag.down
  if (!down) return
  if (drag.mode === 'pending') {
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    if (dist < DRAG_THRESHOLD) return
    drag.mode = 'dragging'
  }
  const cell = cellAtPoint(e.clientX, e.clientY)
  if (cell) drag.hover = cell
}

function onGridPointerUp(e: PointerEvent) {
  if (props.mode !== 'range' || drag.mode === 'idle' || e.pointerId !== drag.pointerId) return
  const down = drag.down
  const inside = isInsideGrid(e.clientX, e.clientY)
  if (down) {
    if (drag.mode === 'pending') {
      // 未越过阈值：视为点击；若在面板外松开则放弃
      if (inside) {
        const cell = grid.value.find((c) => c.iso === down.iso)
        if (cell) chooseDate(cell)
      }
    } else if (inside && drag.hover) {
      // 拖拽框选：松开只写入「待确认」选区，绝不写模型——查询由「确定」按钮触发
      const a = down.date <= drag.hover.date ? down.date : drag.hover.date
      const b = down.date <= drag.hover.date ? drag.hover.date : down.date
      sel.value = { start: a, end: b }
      draft.value = formatDraft()
    }
    // inside === false：拖出面板松开 → 取消选择，保留原状
  }
  resetDrag()
}

function onGridPointerCancel() {
  resetDrag()
}

function resetDrag() {
  drag.mode = 'idle'
  drag.pointerId = -1
  drag.down = null
  drag.hover = null
}

// ===== 选择动作 =====
/** 点击选择：单选直接用 click；范围模式由指针事件统一处理（拖拽/点击），这里仅兜底 */
function onDayClick(cell: GridCell) {
  if (props.mode === 'single') chooseDate(cell)
}

function chooseDate(cell: GridCell) {
  if (isDisabledCell(cell)) return
  // 拖拽单格（未越阈值但释放时已移动）以按下格为准
  const d = cell.date
  if (props.mode === 'single') {
    sel.value = { start: d, end: d }
    writeModel()
    draft.value = formatDraft()
    closePopup()
    return
  }
  const s = sel.value.start
  const e = sel.value.end
  if (s && e) {
    // 已有完整范围：重新开始选
    sel.value = { start: d, end: null }
  } else if (!s) {
    sel.value = { start: d, end: null }
  } else {
    // 有起点：点终点收尾（写模型由「确定」触发，避免未确认就查询）
    sel.value = d < s ? { start: d, end: s } : { start: s, end: d }
    draft.value = formatDraft()
  }
  // 范围模式不自动关闭
}

/** 拖拽未越阈值释放时的悬停格回调（保持与点击一致） */
function chooseDateFromUp(cell: GridCell) {
  chooseDate(cell)
}

function clearValue() {
  sel.value = { start: null, end: null }
  model.value = null
  draft.value = formatDraft()
  if (props.mode === 'single') closePopup()
}

function goToday() {
  const today = parseISO(todayIso)
  if (!today) return
  const cell = grid.value.find((c) => c.iso === todayIso)
  if (cell && isDisabledCell(cell)) return
  sel.value = { start: today, end: props.mode === 'single' ? null : today }
  if (props.mode === 'single') {
    writeModel()
    draft.value = formatDraft()
    closePopup()
  } else {
    // 范围模式仅更新待确认选区，查询由「确定」触发
    draft.value = formatDraft()
  }
}

/** 确定：提交当前选择并关闭弹窗，触发父级查询日期 */
function confirmSelect() {
  // 范围模式仅选起点时，确认为单日范围
  if (props.mode === 'range' && sel.value.start !== null && sel.value.end === null) {
    sel.value = { start: sel.value.start, end: sel.value.start }
  }
  writeModel()
  draft.value = formatDraft()
  closePopup()
}

// ===== 键盘导航 =====
const cursor = ref<Date | null>(null)

const cursorIndex = computed(() => {
  const c = cursor.value
  if (c) {
    const idx = grid.value.findIndex((g) => sameDay(g.date, c))
    if (idx >= 0) return idx
  }
  return grid.value.findIndex((g) => !isDisabledCell(g))
})

function focusCell(i: number | null) {
  if (i == null || i < 0 || i >= cellEls.value.length) return
  cellEls.value[i]?.focus()
}

function onCellKeydown(e: KeyboardEvent, i: number) {
  let next = i
  switch (e.key) {
    case 'ArrowLeft':
      next = i - 1
      break
    case 'ArrowRight':
      next = i + 1
      break
    case 'ArrowUp':
      next = i - 7
      break
    case 'ArrowDown':
      next = i + 7
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = 41
      break
    case 'PageUp':
      e.preventDefault()
      goMonth(-1)
      return
    case 'PageDown':
      e.preventDefault()
      goMonth(1)
      return
    case 'Enter':
    case ' ':
    case 'Spacebar':
      e.preventDefault()
      chooseDateFromUp(grid.value[i] as GridCell)
      return
    case 'Escape':
      e.preventDefault()
      closePopup()
      return
    default:
      return
  }
  next = Math.min(Math.max(next, 0), grid.value.length - 1)
  e.preventDefault()
  cursor.value = grid.value[next]!.date
  focusCell(next)
}

function cellLabel(c: GridCell): string {
  const wd = `日一二三四五六`[c.date.getDay()] ?? '日'
  let s = `${c.date.getFullYear()}年${c.date.getMonth() + 1}月${c.date.getDate()}日，星期${wd}`
  if (isTodayCell(c)) s += '，今天'
  if (isDisabledCell(c)) s += '，不可选'
  else if (isSelectedCell(c)) s += '，已选中'
  return s
}

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitOrRevert()
    if (props.mode === 'single') closePopup()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closePopup()
  }
}

const ICON = {
  calendar:
    '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
} as const

const hasValue = computed(() => {
  if (props.mode === 'range') return sel.value.start !== null && sel.value.end !== null
  return sel.value.start !== null
})

const inputCls = computed(() => {
  const size = props.size === 'small' ? 'py-2 text-caption' : 'py-2.5 text-body'
  const pad = hasValue.value && props.clearable ? 'pl-10 pr-9' : 'pl-10 pr-8'
  return [
    size,
    pad,
    'w-full rounded-control border bg-foam/70 transition-colors duration-[var(--duration-spring)] ease-spring focus:outline-none',
    open.value ? 'border-accent bg-foam/80' : 'border-stroke hover:border-accent/60',
  ].join(' ')
})

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
  document.addEventListener('scroll', onWindowScroll, true)
  window.addEventListener('resize', onWindowScroll)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('scroll', onWindowScroll, true)
  window.removeEventListener('resize', onWindowScroll)
})

// 初始同步
sel.value = loadSel(model.value)
draft.value = formatDraft()

/** 输入框聚焦：打开日历面板并标记焦点态（内联多语句会被格式化工具改坏，抽成方法） */
function onInputFocus() {
  openPanel()
  inputFocused.value = true
}
</script>

<template>
  <div ref="wrapEl" class="relative block w-full" @focusout="onWrapFocusOut">
    <input
      :value="draft"
      :placeholder="placeholder || (mode === 'range' ? '选择日期范围' : '选择日期')"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      spellcheck="false"
      :aria-label="mode === 'range' ? '筛选日期范围' : '选择日期'"
      @input="onInput"
      @keydown="onInputKeydown"
      @focus="onInputFocus"
      @blur="inputFocused = false"
      :class="inputCls"
    />

    <!-- 日历图标触发按钮 -->
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      aria-label="打开日历"
      @click="toggle"
      class="absolute left-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-control text-ink-muted transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60 hover:text-accent-deep"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        v-html="ICON.calendar"
      />
    </button>

    <!-- 清除按钮 -->
    <button
      v-if="hasValue && clearable"
      type="button"
      aria-label="清除日期"
      @pointerdown.prevent="clearValue"
      class="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60 hover:text-accent-deep"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        v-html="ICON.close"
      />
    </button>

    <Teleport to="body">
      <Transition name="dp">
        <div
          v-if="open"
          ref="panelEl"
          role="dialog"
          :aria-label="mode === 'range' ? '选择日期范围' : '选择日期'"
          :style="panelStyle"
          class="fixed z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-surface border border-stroke bg-foam p-3 shadow-lift"
        >
          <!-- 月份导航 -->
          <div class="mb-1 flex items-center justify-between px-1">
            <button
              type="button"
              :disabled="!canPrev"
              :aria-label="'上个月'"
              @click="goMonth(-1)"
              class="flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60 hover:text-accent-deep disabled:pointer-events-none disabled:opacity-30"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="ICON.chevronLeft"
              />
            </button>
            <p class="text-heading font-semibold text-ink">{{ title }}</p>
            <button
              type="button"
              :disabled="!canNext"
              :aria-label="'下个月'"
              @click="goMonth(1)"
              class="flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60 hover:text-accent-deep disabled:pointer-events-none disabled:opacity-30"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="ICON.chevronRight"
              />
            </button>
          </div>

          <!-- 星期表头：周一为一周起始 -->
          <div class="grid grid-cols-7">
            <span
              v-for="w in WEEKDAYS"
              :key="w"
              class="py-1 text-center text-micro font-medium text-ink-faint"
            >
              {{ w }}
            </span>
          </div>

          <!-- 日期网格（拖拽仅范围模式生效） -->
          <div
            ref="gridEl"
            role="grid"
            class="grid grid-cols-7 select-none gap-y-1 touch-none rounded-control"
            :aria-label="title + '日历'"
            @dragstart.prevent
            @pointerdown="onGridPointerDown"
            @pointermove="onGridPointerMove"
            @pointerup="onGridPointerUp"
            @pointercancel="onGridPointerCancel"
          >
            <div
              v-for="(c, i) in grid"
              :key="c.iso"
              role="gridcell"
              :aria-selected="
                mode === 'range' ? finalRole(c) !== null || isRangeStartOnly(c) : isSelectedCell(c)
              "
              class="flex h-9 items-center justify-center"
              :class="cellCls(c)"
            >
              <button
                type="button"
                :data-idx="i"
                :ref="(el) => setCellRef(i, el)"
                :tabindex="i === cursorIndex ? 0 : -1"
                :disabled="isDisabledCell(c)"
                :aria-label="cellLabel(c)"
                :aria-current="isTodayCell(c) ? 'date' : undefined"
                @click="onDayClick(c)"
                @keydown="onCellKeydown($event, i)"
                class="relative mx-auto flex size-8 items-center justify-center rounded-full text-caption transition-colors duration-[var(--duration-spring)] ease-spring focus:outline-none"
                :class="dayBtnClass(c)"
              >
                {{ c.date.getDate() }}
                <span
                  v-if="isTodayCell(c)"
                  aria-hidden="true"
                  class="absolute bottom-px left-1/2 size-1 -translate-x-1/2 rounded-full"
                  :class="todayDotCls(c)"
                />
              </button>
            </div>
          </div>

          <!-- 底部：快捷操作 -->
          <div
            class="mt-2 flex items-center justify-between gap-2 border-t border-stroke px-1 pt-2"
          >
            <span class="truncate text-micro text-ink-faint">
              <template v-if="mode === 'range'">按住拖拽可框选，或依次点击起止日期</template>
              <template v-else>按 Enter 确认，支持手动输入</template>
            </span>
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                v-if="mode === 'single'"
                type="button"
                @click="goToday"
                class="rounded-pill px-2.5 py-1 text-caption font-medium text-accent-deep transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60"
              >
                今天
              </button>
              <button
                v-if="hasValue && clearable"
                type="button"
                @click="clearValue"
                class="rounded-pill bg-mint px-3.5 py-1 text-caption font-semibold text-foam shadow-surface transition-colors duration-[var(--duration-spring)] ease-spring hover:brightness-105"
              >
                清除
              </button>
              <button
                type="button"
                @click="confirmSelect"
                class="rounded-pill bg-accent-gradient px-3.5 py-1 text-caption font-semibold text-foam shadow-surface transition-colors duration-[var(--duration-spring)] ease-spring hover:brightness-105"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dp-enter-active,
.dp-leave-active {
  /* 透明度用线性做平滑渐变：运动开始时透明，随位移推进到静止时变为不透明；
     位移仍用线性弹簧，避免透明度过早拉满看起来像“固定透明度” */
  transition:
    opacity var(--duration-spring) linear,
    transform var(--duration-spring) var(--ease-spring);
}
.dp-enter-from,
.dp-leave-to {
  opacity: 0;
  transform: translateY(var(--dp-offset, -8px));
}
.dp-enter-to,
.dp-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
