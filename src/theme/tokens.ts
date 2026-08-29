/**
 * Visual language tokens.
 * Hex values must stay in sync with `src/assets/main.css` `@theme`.
 */
export const colorSpecimens = [
  { group: '基调', name: 'canvas', className: 'bg-canvas', hex: '#F5EFE6', role: '页面底色' },
  {
    group: '基调',
    name: 'canvas-deep',
    className: 'bg-canvas-deep',
    hex: '#EDE4D6',
    role: '沉一点的奶油',
  },
  {
    group: '基调',
    name: 'accent-mist',
    className: 'bg-accent-mist',
    hex: '#F8E0D4',
    role: '淡桃色衬底',
  },
  { group: '强调', name: 'mint', className: 'bg-mint', hex: '#5FA99C', role: '薄荷青' },
  { group: '基调', name: 'foam', className: 'bg-foam', hex: '#FFFBF7', role: '表面色素' },
  { group: '墨色', name: 'ink', className: 'bg-ink', hex: '#2C241C', role: '主文案' },
  { group: '墨色', name: 'ink-soft', className: 'bg-ink-soft', hex: '#5E534A', role: '次级文案' },
  { group: '墨色', name: 'ink-muted', className: 'bg-ink-muted', hex: '#9A8B7C', role: '辅助说明' },
  {
    group: '墨色',
    name: 'ink-faint',
    className: 'bg-ink-faint',
    hex: '#C4B5A5',
    role: '禁用 / 占位',
  },
  { group: '强调', name: 'accent', className: 'bg-accent', hex: '#FF8C6B', role: '主强调' },
  {
    group: '强调',
    name: 'accent-soft',
    className: 'bg-accent-soft',
    hex: '#FFAA85',
    role: '渐变末端',
  },
  {
    group: '强调',
    name: 'accent-deep',
    className: 'bg-accent-deep',
    hex: '#E56B4A',
    role: '强调上的字',
  },
  {
    group: '强调',
    name: 'accent-muted',
    className: 'bg-accent-muted',
    hex: '#E8A090',
    role: '大面积填充',
  },
  { group: '趋势', name: 'trend-up', className: 'bg-trend-up', hex: '#E56B4A', role: '上升' },
  {
    group: '趋势',
    name: 'trend-down',
    className: 'bg-trend-down',
    hex: '#6B9B7A',
    role: '有利下降',
  },
  {
    group: '趋势',
    name: 'trend-neutral',
    className: 'bg-trend-neutral',
    hex: '#9A8B7C',
    role: '持平',
  },
  { group: '状态', name: 'status-ok', className: 'bg-status-ok', hex: '#7A9E82', role: '正常' },
  { group: '状态', name: 'status-warn', className: 'bg-status-warn', hex: '#D4926A', role: '注意' },
  { group: '状态', name: 'status-idle', className: 'bg-status-idle', hex: '#C4B5A5', role: '空闲' },
  {
    group: '状态',
    name: 'status-alert',
    className: 'bg-status-alert',
    hex: '#C97B6A',
    role: '告警',
  },
] as const

export const colorGroups = ['基调', '墨色', '强调', '趋势', '状态'] as const

export const radiusSpecimens = [
  { name: 'control', className: 'rounded-control', value: '14px', role: '控件' },
  { name: 'surface', className: 'rounded-surface', value: '24px', role: '容器' },
  { name: 'pill', className: 'rounded-pill', value: '9999px', role: '胶囊' },
] as const

export const shadowSpecimens = [
  { name: 'surface', className: 'shadow-surface', role: '静止' },
  { name: 'lift', className: 'shadow-lift', role: '悬浮' },
  { name: 'glow', className: 'shadow-glow', role: '光晕' },
] as const
