<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    options: { value: string; label: string }[]
    label?: string
    placeholder?: string
  }>(),
  {
    label: '',
    placeholder: '请选择',
  },
)

// 下拉面板打开状态与定位（Teleport 到 body 以避开外层折叠面板的 overflow 裁切）
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const menuStyle = ref({ left: '0px', top: '0px', width: '0px' })

const selected = computed(() => props.options.find((o) => o.value === model.value))

const ICON = {
  chevron: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
} as const

function openMenu() {
  const el = trigger.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  menuStyle.value = {
    left: `${rect.left}px`,
    top: `${rect.bottom + 6}px`,
    width: `${rect.width}px`,
  }
  open.value = true
}

function toggle() {
  if (open.value) open.value = false
  else openMenu()
}

function pick(value: string) {
  model.value = value
  open.value = false
}

// 页面滚动 / 缩放时面板跟随触发按钮定位
function positionMenu() {
  if (!open.value || !trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  menuStyle.value = {
    left: `${rect.left}px`,
    top: `${rect.bottom + 6}px`,
    width: `${rect.width}px`,
  }
}

function onDocClick(e: MouseEvent) {
  if (!open.value) return
  if (root.value?.contains(e.target as Node)) return
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', positionMenu)
  document.addEventListener('scroll', positionMenu, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', positionMenu)
  document.removeEventListener('scroll', positionMenu, true)
})
</script>

<template>
  <div ref="root" class="relative block w-full">
    <button
      ref="trigger"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      class="flex w-full items-center rounded-control border py-2.5 pl-14 pr-8 text-left text-body text-ink transition-colors duration-[var(--duration-spring)] ease-spring focus:outline-none"
      :class="open ? 'border-accent bg-foam/80' : 'border-stroke bg-foam/70 hover:border-accent/60'"
    >
      <span
        v-if="label"
        class="pointer-events-none absolute left-3.5 top-2.5 text-caption text-ink-faint"
        >{{ label }}</span
      >

      <span class="min-w-0 truncate">{{ selected?.label ?? placeholder }}</span>

      <svg
        viewBox="0 0 24 24"
        class="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint transition-transform duration-[var(--duration-spring)] ease-spring"
        :class="open ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        v-html="ICON.chevron"
      />
    </button>

    <Teleport to="body">
      <Transition name="ddown">
        <div v-if="open" class="fixed z-50" :style="menuStyle">
          <ul
            role="listbox"
            class="max-h-64 overflow-auto rounded-surface border border-stroke bg-foam/95 p-1.5 shadow-lift"
          >
            <li
              v-for="o in options"
              :key="o.value"
              role="option"
              :aria-selected="o.value === model"
              @click="pick(o.value)"
              class="flex cursor-pointer items-center justify-between gap-2 rounded-control px-3 py-2 text-body transition-colors duration-[var(--duration-spring)] ease-spring hover:bg-accent-mist/60"
              :class="o.value === model ? 'font-medium text-accent-deep' : 'text-ink-soft'"
            >
              {{ o.label }}
              <svg
                v-if="o.value === model"
                viewBox="0 0 24 24"
                class="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="ICON.check"
              />
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* 下拉面板弹出：透明度从运动起点渐变到运动终点，线性弹簧，与全局动效一致
   面板不用 backdrop-filter 玻璃（opacity<1 期间 blur 不生效，结束瞬间会突变） */
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
