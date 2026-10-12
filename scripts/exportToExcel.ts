/**
 * exportToExcel.ts — exports all tasks to Excel.
 * Columns per sheet: שם משימה | קטגוריה
 * Tabs: "כל המשימות" + one tab per category.
 *
 * Usage:
 *   npx tsx scripts/exportToExcel.ts
 */

import dotenv from 'dotenv'
import { resolve } from 'path'
dotenv.config({ path: resolve(process.cwd(), '.env.local') })
dotenv.config({ path: resolve(process.cwd(), '.env') })

import * as XLSX from 'xlsx'
import mongoose from 'mongoose'
import { connectToDatabase } from '../src/infrastructure/db'
import CategoryModel from '../src/infrastructure/models/Category'
import TaskModel from '../src/infrastructure/models/Task'

const COLS = [colW(40), colW(22)]

function colW(n: number) { return { wch: n } }

function makeSheet(rows: [string, string][]) {
  const data = [['שם משימה', 'קטגוריה'], ...rows]
  const ws   = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = COLS
  return ws
}

async function main() {
  console.log('\n[exportToExcel] Connecting…')
  await connectToDatabase()

  const [categories, tasks] = await Promise.all([
    CategoryModel.find({}).lean(),
    TaskModel.find({}).lean(),
  ])

  console.log(`  Tasks: ${tasks.length}  |  Categories: ${categories.length}\n`)

  const nameBySlug = new Map(categories.map((c) => [c.slug, `${c.emoji ?? ''} ${c.name}`.trim()]))

  // group by category slug
  const bySlug = new Map<string, typeof tasks>()
  for (const t of tasks) {
    const slug = t.category ?? 'other'
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), t])
  }

  const wb = XLSX.utils.book_new()

  // ── Tab 1: כל המשימות ──────────────────────────────────────────────────────
  const allRows: [string, string][] = tasks.map((t) => [
    t.title ?? '',
    nameBySlug.get(t.category ?? '') ?? t.category ?? '',
  ])
  XLSX.utils.book_append_sheet(wb, makeSheet(allRows), 'כל המשימות')
  console.log(`  ✓ כל המשימות (${allRows.length})`)

  // ── One tab per category (ordered by categories list) ─────────────────────
  for (const cat of categories) {
    const catTasks = bySlug.get(cat.slug) ?? []
    const catName  = `${cat.emoji ?? ''} ${cat.name}`.trim()
    const rows: [string, string][] = catTasks.map((t) => [t.title ?? '', catName])
    const sheetName = catName.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, makeSheet(rows), sheetName)
    console.log(`  ✓ ${sheetName.padEnd(28)} (${catTasks.length})`)
  }

  // ── Tasks with unknown category ────────────────────────────────────────────
  const knownSlugs = new Set(categories.map((c) => c.slug))
  const orphans    = tasks.filter((t) => !knownSlugs.has(t.category ?? ''))
  if (orphans.length > 0) {
    const rows: [string, string][] = orphans.map((t) => [t.title ?? '', t.category ?? ''])
    XLSX.utils.book_append_sheet(wb, makeSheet(rows), 'ללא קטגוריה')
    console.log(`  ✓ ללא קטגוריה (${orphans.length})`)
  }

  const outPath = resolve(process.cwd(), 'wedding-tasks-export.xlsx')
  XLSX.writeFile(wb, outPath)
  console.log(`\n✅ נשמר: ${outPath}\n`)

  await mongoose.connection.close()
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
