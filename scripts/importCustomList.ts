/**
 * importCustomList.ts — idempotent import of custom wedding list items.
 *
 * Rules:
 *   • If a category slug already exists it is reused as-is.
 *   • If a category slug is missing it is created (emoji 📦, subcategory ["כללי"]).
 *   • Tasks are only inserted when no document with the same (title, category) exists.
 *   • Safe to run multiple times — never overwrites or duplicates data.
 *
 * Usage:
 *   npx tsx scripts/importCustomList.ts
 */

import dotenv from 'dotenv'
import { resolve } from 'path'

// Load env vars before any module reads process.env.MONGODB_URI
dotenv.config({ path: resolve(process.cwd(), '.env.local') })
dotenv.config({ path: resolve(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectToDatabase } from '../src/infrastructure/db'
import CategoryModel from '../src/infrastructure/models/Category'
import TaskModel from '../src/infrastructure/models/Task'

// ── Data to import ────────────────────────────────────────────────────────────

interface ImportEntry {
  name:  string
  slug:  string
  emoji: string
  items: string[]
}

const DATA: ImportEntry[] = [
  {
    name:  'ציוד לבית מטבח',
    slug:  'kitchen_equipment',
    emoji: '🍳',
    items: [
      'סט סירים',
      'סיר לביצים',
      'ששת',
      'סכינים',
      'סכו"ם בשרי חלבי',
      'כוסות זכוכית לקפה',
      'סט חלבי',
      'סט בשרי',
      'מחבת בשרי וחלבי',
      'מסננת בשרי וחלבי',
      'קרש חיתוך',
      'מיבש לכלים ולסכו"ם',
      'מערוך',
      'פטיש לשניצל',
      'פותחן לקופסאות',
      'פותחן ליין',
      'קערות פלסטיק',
      'מגבים לשיש',
    ],
  },
  {
    name:  'חדר אמבטיה',
    slug:  'bathroom',
    emoji: '🛁',
    items: [
      'קערות וספלים לנטילת ידיים',
      'דלי',
      'טינקו',
      'מגבים',
      'מטאטא',
      'כף אשפה',
      'כלים לסבון',
      'מפיץ ריח',
      'סבונים למצעים',
    ],
  },
  {
    name:  'מוצרי ניקוי והיגיינה',
    slug:  'cleaning_hygiene',
    emoji: '🧹',
    items: [
      'ננס, ספוג',
      'ספוג הפלא',
      'טישו',
      'פדים',
      'מקלות אוזניים',
      'שמפו',
      'תחליב רחצה',
      'קסמי שיניים',
      'מברשת שיניים',
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureCategory(entry: ImportEntry): Promise<string> {
  const existing = await CategoryModel.findOne({ slug: entry.slug }, { slug: 1 })
  if (existing) {
    console.log(`  [category] "${entry.slug}" already exists — skipping.`)
    return entry.slug
  }

  await CategoryModel.create({
    id:            crypto.randomUUID(),
    name:          entry.name,
    slug:          entry.slug,
    emoji:         entry.emoji,
    subcategories: ['כללי'],
    createdAt:     new Date().toISOString(),
  })
  console.log(`  [category] ✓ Created "${entry.name}" (${entry.slug})`)
  return entry.slug
}

async function importItems(slug: string, items: string[]): Promise<{ inserted: number; skipped: number }> {
  const now = new Date().toISOString()
  let inserted = 0
  let skipped  = 0

  for (const title of items) {
    const exists = await TaskModel.exists({ title, category: slug })
    if (exists) {
      skipped++
      continue
    }

    await TaskModel.create({
      id:            crypto.randomUUID(),
      title,
      status:        'TODO',
      category:      slug,
      subcategory:   'כללי',
      timeframe:     'backlog',
      assignedDay:   'backlog',
      assignedTo:    'bride',
      priority:      'medium',
      estimatedCost: 0,
      actualCost:    0,
      createdAt:     now,
      updatedAt:     now,
    })
    inserted++
  }

  return { inserted, skipped }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n[importCustomList] Connecting to MongoDB…')
  await connectToDatabase()
  console.log('[importCustomList] Connected.\n')

  let totalInserted = 0
  let totalSkipped  = 0

  for (const entry of DATA) {
    console.log(`\n──── ${entry.emoji} ${entry.name} ────`)
    const slug = await ensureCategory(entry)
    const { inserted, skipped } = await importItems(slug, entry.items)
    console.log(`  [tasks] ✓ inserted ${inserted}, skipped ${skipped} (already existed)`)
    totalInserted += inserted
    totalSkipped  += skipped
  }

  console.log('\n══════════════════════════════════════════')
  console.log(`[importCustomList] Done.`)
  console.log(`  Total inserted : ${totalInserted}`)
  console.log(`  Total skipped  : ${totalSkipped}`)
  console.log('══════════════════════════════════════════\n')

  await mongoose.connection.close()
}

main().catch((err) => {
  console.error('[importCustomList] Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
