import type { AbnormalVehicle } from './types'

/** 汉字逗号或半角逗号分隔 */
const DELIMITER = /[,，]/
/** 占位的缺失时间标记 */
const MISSING = '-'

/** 去掉 CSV 开头的 BOM 并按下划线切分文件名，抽取日期，如 异常车辆_2026-08-20.csv → 2026-08-20 */
export function dateFromFilename(filename: string): string {
  const base = filename.replace(/\.csv$/i, '').replace(/^\uFEFF/, '')
  const match = base.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1]! : base
}

/** 把单个 CSV 文件原始文本解析成记录数组 */
export function parseCsv(raw: string, date: string): AbnormalVehicle[] {
  const text = raw.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

  // 跳过表头行（以“入场时间”开头）
  const dataLines = lines.filter((line) => !line.trim().startsWith('入场时间'))

  return dataLines
    .map((line) => line.split(DELIMITER).map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean))
    .map((cells) => {
      const [entry = MISSING, exit = MISSING, plate = MISSING, feeText = '0', abnormalText = '0'] =
        cells
      return {
        date,
        plate,
        entryTime: entry === MISSING ? null : entry,
        exitTime: exit === MISSING ? null : exit,
        fee: Number.isFinite(Number(feeText)) ? Number(feeText) : 0,
        abnormal: abnormalText === '1',
      }
    })
}

/** 用 Vite glob 动态加载 src/data 下所有“异常车辆_*.csv”，未来新增日期文件自动纳入 */
const csvModules: Record<string, string> = import.meta.glob('./异常车辆_*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** 按文件名（含日期，字典序即时间序）排序后，把全部 CSV 汇总成记录数组 */
export function loadAllVehicles(): AbnormalVehicle[] {
  const filenames = Object.keys(csvModules).sort()
  const records: AbnormalVehicle[] = []
  for (const filename of filenames) {
    records.push(...parseCsv(csvModules[filename]!, dateFromFilename(filename)))
  }
  return records
}