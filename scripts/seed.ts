/**
 * db:seed — clears the tasks collection and reseeds it from a JSON file.
 *
 * Usage:
 *   npm run db:seed -- <path/to/tasks.json>           # prompts before clearing
 *   npm run db:seed -- <path/to/tasks.json> --force   # skips confirmation
 *
 * tsx compiles this file to CJS, so the dotenv.config() calls below run
 * synchronously in the module body — before connectToDatabase() reads
 * process.env.MONGODB_URI inside its function body.
 */

import dotenv from 'dotenv'
import { resolve } from 'path'

// Load env vars before any module reads process.env
dotenv.config({ path: resolve(process.cwd(), '.env.local') })
dotenv.config({ path: resolve(process.cwd(), '.env') }) // fallback

import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import { connectToDatabase } from '../src/infrastructure/db'
import TaskModel from '../src/infrastructure/models/Task'
import type { Task } from '../src/domain/types'

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
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
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
    id: t.id ?? crypto.randomUUID(),
    status: t.status ?? 'TODO',
    estimatedCost: t.estimatedCost ?? 0,
    actualCost: t.actualCost ?? 0,
    createdAt: t.createdAt ?? now,
    updatedAt: t.updatedAt ?? now,
  }))

  console.log(`[seed] Loaded ${hydrated.length} task(s) from "${jsonArg}"`)

  // ── Connect ───────────────────────────────────────────────────────────────
  console.log('[seed] Connecting to MongoDB…')
  await connectToDatabase()

  // ── Safety gate ──────────────────────────────────────────────────────────
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

  // ── Insert ────────────────────────────────────────────────────────────────
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
