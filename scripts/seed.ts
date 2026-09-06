/**
 * db:seed — seeds the categories collection (idempotent) then clears and
 * reseeds the tasks collection from a JSON file.
 *
 * Usage:
 *   npm run db:seed -- <path/to/tasks.json>           # prompts before clearing
 *   npm run db:seed -- <path/to/tasks.json> --force   # skips confirmation
 *
 * tsx compiles this file to CJS, so dotenv.config() runs synchronously in the
 * module body — before connectToDatabase() reads process.env.MONGODB_URI.
 */

import dotenv from 'dotenv'
import { resolve } from 'path'

// Load env vars before any module reads process.env
dotenv.config({ path: resolve(process.cwd(), '.env.local') })
dotenv.config({ path: resolve(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import { connectToDatabase } from '../src/infrastructure/db'
import TaskModel from '../src/infrastructure/models/Task'
import CategoryModel from '../src/infrastructure/models/Category'
import type { Task, Category } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Initial category seed data — mirrors the 6 original hardcoded categories
// so all existing tasks continue to resolve correctly via their slug values.
// ---------------------------------------------------------------------------

const INITIAL_CATEGORIES: Omit<Category, 'id'>[] = [
  {
    name: 'הלכה והכנות רוחניות',
    slug: 'halacha_and_prep',
    emoji: '✡️',
    subcategories: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    name: 'מתנות לחתן',
    slug: 'groom_gifts',
    emoji: '🎁',
    subcategories: [],
    createdAt: '2026-01-01T00:01:00.000Z',
  },
  {
    name: 'נדוניה ובית',
    slug: 'trousseau_and_home',
    emoji: '🏠',
    subcategories: [],
    createdAt: '2026-01-01T00:02:00.000Z',
  },
  {
    name: 'ביגוד וטיפוח כלה',
    slug: 'bride_clothing',
    emoji: '👗',
    subcategories: [],
    createdAt: '2026-01-01T00:03:00.000Z',
  },
  {
    name: 'לוגיסטיקה וספקים',
    slug: 'logistics_and_vendors',
    emoji: '📋',
    subcategories: [],
    createdAt: '2026-01-01T00:04:00.000Z',
  },
  {
    name: 'שבע ברכות ואירועים',
    slug: 'sheva_brachot',
    emoji: '🎊',
    subcategories: [],
    createdAt: '2026-01-01T00:05:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confirm(question: string): Promise<boolean> {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      res(answer.trim().toLowerCase() === 'y')
    })
  })
}

function loadJson(filePath: string): Task[] {
  const abs = resolve(process.cwd(), filePath)
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf-8'))
  } catch {
    throw new Error(`Cannot read or parse file: ${abs}`)
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('JSON file must contain a non-empty array.')
  }
  return parsed as Task[]
}

// ---------------------------------------------------------------------------
// Seed categories — idempotent: inserts only slugs that do not yet exist
// ---------------------------------------------------------------------------

async function seedCategories(): Promise<void> {
  console.log('[seed] Checking categories collection…')

  const existingSlugs = new Set(
    (await CategoryModel.find({}, { slug: 1 })).map((d) => d.slug),
  )

  const toInsert = INITIAL_CATEGORIES.filter((c) => !existingSlugs.has(c.slug))

  if (toInsert.length === 0) {
    console.log('[seed] Categories already seeded — skipping.')
    return
  }

  const docs = toInsert.map((c) => ({ ...c, id: crypto.randomUUID() }))
  await CategoryModel.insertMany(docs, { ordered: true })
  console.log(`[seed] ✓ Inserted ${docs.length} category/ies.`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args   = process.argv.slice(2)
  const force  = args.includes('--force')
  const jsonArg = args.find((a) => !a.startsWith('--'))

  if (!jsonArg) {
    console.error('Usage:   npm run db:seed -- <path/to/tasks.json> [--force]')
    console.error('Example: npm run db:seed -- data/tasks.json --force')
    process.exit(1)
  }

  // ── Load and hydrate tasks ────────────────────────────────────────────────
  let tasks: Task[]
  try {
    tasks = loadJson(jsonArg)
  } catch (err) {
    console.error('[seed]', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const now = new Date().toISOString()
  const hydrated: Task[] = tasks.map((t) => ({
    ...t,
    id:            t.id            ?? crypto.randomUUID(),
    status:        t.status        ?? 'TODO',
    estimatedCost: t.estimatedCost ?? 0,
    actualCost:    t.actualCost    ?? 0,
    createdAt:     t.createdAt     ?? now,
    updatedAt:     t.updatedAt     ?? now,
  }))

  console.log(`[seed] Loaded ${hydrated.length} task(s) from "${jsonArg}"`)

  // ── Connect ───────────────────────────────────────────────────────────────
  console.log('[seed] Connecting to MongoDB…')
  await connectToDatabase()

  // ── Seed categories first (idempotent) ───────────────────────────────────
  await seedCategories()

  // ── Safety gate for tasks ────────────────────────────────────────────────
  const existingCount = await TaskModel.countDocuments()

  if (existingCount > 0) {
    if (!force) {
      const ok = await confirm(
        `[seed] ⚠️  Found ${existingCount} existing task(s). Clear and reseed? (y/N): `,
      )
      if (!ok) {
        console.log('[seed] Aborted — no changes made.')
        await mongoose.connection.close()
        process.exit(0)
      }
    }
    await TaskModel.deleteMany({})
    console.log(`[seed] Cleared ${existingCount} existing task(s).`)
  }

  // ── Insert tasks ──────────────────────────────────────────────────────────
  try {
    await TaskModel.insertMany(hydrated, { ordered: true })
    console.log(`[seed] ✓ Inserted ${hydrated.length} task(s) successfully.`)
  } catch (err) {
    console.error('[seed] insertMany failed:', err)
    await mongoose.connection.close()
    process.exit(1)
  }

  await mongoose.connection.close()
  console.log('[seed] Connection closed — done.')
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
