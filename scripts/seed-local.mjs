#!/usr/bin/env node
/**
 * 本地开发种子脚本：把 scripts/seed-data/异常车辆_*.csv 合成 anomalies 行，
 * 导入 wrangler 本地 D1（Miniflare SQLite）。仅用于 `npm run dev` 联调，
 * 线上数据由上游检测工具写入。
 *
 * 用法：npm run seed
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DB_NAME = 'test'
const SEED_DIR = new URL('./seed-data/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SEED_SQL = new URL('./seed.sql', import.meta.url)

const DATE_RE = /(\d{4}-\d{2}-\d{2})/
const DELIMITER = /[,，]/
const MISSING = '-'

function readRows() {
  const files = readdirSync(SEED_DIR).filter((f) => /^异常车辆_\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort()
  if (files.length === 0) {
    console.error(`scripts/seed-data/ 下没有种子 CSV（该目录不进 git，需要本地保留）`)
    process.exit(1)
  }
  const rows = []
  for (const file of files) {
    const logDate = file.match(DATE_RE)?.[1]
    if (!logDate) continue
    const text = readFileSync(join(SEED_DIR, file), 'utf8').replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('入场时间'))
    for (const line of lines) {
      const [entry = MISSING, exit = MISSING, plate = '', feeText = '', suspiciousText = '0'] =
        line.split(DELIMITER).map((c) => c.trim())
      if (!plate) continue
      const entryTime = entry === MISSING ? null : `${logDate} ${entry}`
      // exit_time 在表里 NOT NULL，缺失时兜底为当日 00:00:00
      const exitTime = exit === MISSING ? `${logDate} 00:00:00` : `${logDate} ${exit}`
      const feeNum = Number(feeText)
      const fee = Number.isFinite(feeNum) && feeText !== '' ? feeNum : null
      const isSuspicious = suspiciousText === '1' ? 1 : 0
      // dedup_key 只在本地种子中需要唯一：对内容做 sha256
      const dedupKey = createHash('sha256')
        .update([logDate, entryTime ?? '-', exitTime, plate].join('|'))
        .digest('hex')
      rows.push({ logDate, file, entryTime, exitTime, plate, fee, isSuspicious, dedupKey })
    }
  }
  return rows
}

function sqlString(value) {
  return value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`
}

const rows = readRows()
const statements = ['DELETE FROM anomalies;']
for (const r of rows) {
  statements.push(
    `INSERT INTO anomalies (log_date, log_file, entry_time, exit_time, car_number, fee, is_suspicious, dedup_key) ` +
      `VALUES (${sqlString(r.logDate)}, ${sqlString(r.file)}, ${sqlString(r.entryTime)}, ` +
      `${sqlString(r.exitTime)}, ${sqlString(r.plate)}, ${sqlString(r.fee)}, ${r.isSuspicious}, ` +
      `${sqlString(r.dedupKey)});`,
  )
}
writeFileSync(SEED_SQL, statements.join('\n') + '\n', 'utf8')
console.log(`生成 ${rows.length} 条种子记录 → scripts/seed.sql`)

// 本地先应用索引迁移，再清库重灌
execSync(`npx wrangler d1 migrations apply ${DB_NAME} --local`, { stdio: 'inherit' })
execSync(`npx wrangler d1 execute ${DB_NAME} --local --file scripts/seed.sql`, { stdio: 'inherit' })
console.log('本地 D1 种子导入完成')
