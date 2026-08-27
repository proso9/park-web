<script setup lang="ts">
import { AppSurface, StatusDot, TrendMark } from '@/components/ui'
import { colorGroups, colorSpecimens, radiusSpecimens, shadowSpecimens } from '@/theme/tokens'

const groupedColors = colorGroups.map((group) => ({
  group,
  items: colorSpecimens.filter((item) => item.group === group),
}))

const typeRamp = [
  {
    name: 'display',
    sample: '12,842',
    className: 'text-display font-extrabold tracking-display text-ink nums-tabular',
    meta: 'text-display · font-extrabold · tracking-display · nums-tabular',
    role: '核心数据',
  },
  {
    name: 'title',
    sample: '早上好',
    className: 'text-title font-bold text-ink',
    meta: 'text-title · font-bold',
    role: '页面标题',
  },
  {
    name: 'heading',
    sample: '概览',
    className: 'text-heading font-semibold text-ink',
    meta: 'text-heading · font-semibold',
    role: '区块标题',
  },
  {
    name: 'body',
    sample: '用留白和柔光把界面撑开，让信息自己呼吸。',
    className: 'text-body text-ink-soft',
    meta: 'text-body · text-ink-soft',
    role: '正文',
  },
  {
    name: 'caption',
    sample: '辅助说明使用小字号、浅灰褐，而不是纯灰。',
    className: 'text-caption text-ink-muted',
    meta: 'text-caption · text-ink-muted',
    role: '辅助说明',
  },
  {
    name: 'micro',
    sample: 'accent  ·  surface  ·  shadow',
    className: 'text-micro text-ink-faint',
    meta: 'text-micro · text-ink-faint',
    role: '标注 / 元信息',
  },
] as const
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-20 sm:px-12 lg:px-16 lg:py-28">
    <header class="max-w-xl space-y-5">
      <p class="text-caption text-ink-muted">Park · Visual language</p>
      <h1 class="text-4xl font-bold tracking-tight text-ink sm:text-5xl">视觉语言</h1>
      <p class="text-body text-ink-soft">
        现代、极简、温暖、高级。奶油底，桃色光晕，深棕墨色。大面积留白，容器极大圆角、半透明、极柔的暖色阴影。
      </p>
    </header>

    <div class="mt-28 space-y-28">
      <section class="space-y-10">
        <header class="space-y-2">
          <h2 class="text-heading font-semibold text-ink">字体层级</h2>
          <p class="text-caption text-ink-muted">
            核心数据超大、超粗；说明文字缩小、降低存在感。对比要够，不要纯黑。
          </p>
        </header>
        <ol class="space-y-10">
          <li v-for="level in typeRamp" :key="level.name" class="space-y-3">
            <p class="text-micro text-ink-faint">{{ level.role }} · {{ level.meta }}</p>
            <p :class="level.className">{{ level.sample }}</p>
          </li>
        </ol>
        <p class="text-title font-bold">
          <span class="text-accent-gradient">强调词</span>
          <span class="text-ink"> 也可以走桃色渐变。</span>
        </p>
        <p class="text-micro text-ink-faint">text-accent-gradient</p>
      </section>

      <section class="space-y-10">
        <header class="space-y-2">
          <h2 class="text-heading font-semibold text-ink">色彩</h2>
          <p class="text-caption text-ink-muted">一律偏暖、饱和度收着。没有冷灰，也没有纯黑。</p>
        </header>
        <div class="space-y-12">
          <div v-for="group in groupedColors" :key="group.group" class="space-y-5">
            <p class="text-caption text-ink-muted">{{ group.group }}</p>
            <ul class="flex flex-wrap gap-8">
              <li v-for="item in group.items" :key="item.name" class="space-y-3">
                <div class="size-16 rounded-full ring-1 ring-stroke" :class="item.className" />
                <div class="space-y-0.5">
                  <p class="text-caption font-medium text-ink">{{ item.name }}</p>
                  <p class="text-micro text-ink-muted">{{ item.hex }}</p>
                  <p class="text-micro text-ink-faint">{{ item.role }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="space-y-10">
        <header class="space-y-2">
          <h2 class="text-heading font-semibold text-ink">渐变与光晕</h2>
          <p class="text-caption text-ink-muted">
            强调色走 accent → accent-soft 的线性渐变。页面级光晕是大面积、高模糊的抽象色块，不是装饰插画。
          </p>
        </header>
        <div class="space-y-6">
          <div>
            <div class="h-24 rounded-surface bg-accent-gradient shadow-surface" />
            <p class="mt-3 text-micro text-ink-faint">bg-accent-gradient</p>
          </div>
          <div>
            <div class="h-24 rounded-surface bg-canvas-deep bg-accent-sheer" />
            <p class="mt-3 text-micro text-ink-faint">bg-accent-sheer</p>
          </div>
          <div>
            <div class="relative h-56 overflow-hidden rounded-surface bg-foam/70">
              <div
                class="absolute -top-10 -right-8 size-64 rounded-full bg-accent/50 blur-orb"
                aria-hidden="true"
              />
            </div>
            <p class="mt-3 text-micro text-ink-faint">
              容器内光晕 · absolute + bg-accent/50 + blur-orb
            </p>
          </div>
        </div>
      </section>

      <section class="space-y-10">
        <header class="space-y-2">
          <h2 class="text-heading font-semibold text-ink">圆角</h2>
          <p class="text-caption text-ink-muted">容器用极大圆角。控件略收，胶囊走满圆。</p>
        </header>
        <ul class="flex flex-wrap items-end gap-10">
          <li v-for="item in radiusSpecimens" :key="item.name" class="space-y-3">
            <div
              class="bg-accent-muted"
              :class="[item.className, item.name === 'pill' ? 'h-10 w-32' : 'size-24']"
            />
            <div class="space-y-0.5">
              <p class="text-caption font-medium text-ink">{{ item.name }}</p>
              <p class="text-micro text-ink-muted">{{ item.value }}</p>
              <p class="text-micro text-ink-faint">{{ item.role }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section class="space-y-10">
        <header class="space-y-2">
          <h2 class="text-heading font-semibold text-ink">阴影</h2>
          <p class="text-caption text-ink-muted">
            阴影要几乎看不见，并带一点主色透色。宁可太淡，不要发灰发脏。
          </p>
        </header>
        <ul class="flex flex-wrap gap-10">
          <li v-for="item in shadowSpecimens" :key="item.name" class="space-y-3">
            <div class="size-24 rounded-surface bg-foam" :class="item.className" />
            <div class="space-y-0.5">
              <p class="text-caption font-medium text-ink">{{ item.name }}</p>
              <p class="text-micro text-ink-faint">shadow-{{ item.name }} · {{ item.role }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section class="space-y-10">
        <header class="space-y-2">
          <h2 class="text-heading font-semibold text-ink">表面</h2>
          <p class="text-caption text-ink-muted">
            半透明暖白 + 毛玻璃 + 内高光。这是材质，不是布局。
          </p>
        </header>
        <div class="relative overflow-hidden rounded-surface bg-accent-sheer p-10">
          <div class="flex flex-wrap gap-6">
            <AppSurface class="grid h-32 w-44 place-items-center">
              <span class="text-caption text-ink-muted">glass</span>
            </AppSurface>
            <AppSurface tone="strong" class="grid h-32 w-44 place-items-center">
              <span class="text-caption text-ink-muted">strong</span>
            </AppSurface>
            <AppSurface tone="ghost" class="grid h-32 w-44 place-items-center">
              <span class="text-caption text-ink-muted">ghost</span>
            </AppSurface>
          </div>
        </div>
        <p class="text-micro text-ink-faint">AppSurface · tone: glass | strong | ghost</p>
      </section>

      <section class="space-y-10">
        <header class="space-y-2">
          <h2 class="text-heading font-semibold text-ink">点缀</h2>
          <p class="text-caption text-ink-muted">
            状态用低饱和小圆点。上升用桃橙；若下降是有利的（耗时变短），用sage绿。
          </p>
        </header>
        <div class="space-y-8">
          <ul class="flex flex-wrap gap-8">
            <li class="flex items-center gap-2">
              <StatusDot tone="ok" label="正常" />
              <span class="text-caption text-ink-soft">正常</span>
            </li>
            <li class="flex items-center gap-2">
              <StatusDot tone="warn" label="注意" />
              <span class="text-caption text-ink-soft">注意</span>
            </li>
            <li class="flex items-center gap-2">
              <StatusDot tone="idle" label="空闲" />
              <span class="text-caption text-ink-soft">空闲</span>
            </li>
            <li class="flex items-center gap-2">
              <StatusDot tone="alert" label="告警" />
              <span class="text-caption text-ink-soft">告警</span>
            </li>
          </ul>
          <ul class="flex flex-wrap gap-4">
            <li>
              <span class="chip">
                <TrendMark direction="up">18.6%</TrendMark>
              </span>
            </li>
            <li>
              <span class="chip-sage">
                <TrendMark direction="down" :favorable="true">6.1%</TrendMark>
              </span>
            </li>
            <li>
              <TrendMark direction="down" :favorable="false">2.4%</TrendMark>
            </li>
          </ul>
          <p class="text-micro text-ink-faint">StatusDot · TrendMark · chip / chip-sage</p>
        </div>
      </section>
    </div>

    <p class="mt-28 text-micro text-ink-faint">Tokens · src/assets/main.css</p>
  </main>
</template>
