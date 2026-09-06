'use server'

import { revalidatePath } from 'next/cache'
import mongoose from 'mongoose'
import { connectToDatabase } from '@/infrastructure/db'
import TaskModel, { type ITaskDocument } from '@/infrastructure/models/Task'
import type { Task } from '@/domain/types'

// ---------------------------------------------------------------------------
// Response envelope — discriminated union for all server action returns.
// Client components narrow on `result.success` before reading `.data`.
// ---------------------------------------------------------------------------

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Serialization
//
// Mongoose documents carry ObjectId `_id` and internal prototype methods.
// `toObject()` flattens to a POJO; we then strip `_id` so the shape exactly
// satisfies the domain `Task` interface (which uses our UUID `id` field).
// ---------------------------------------------------------------------------

function serialize(doc: ITaskDocument): Task {
  const raw = doc.toObject({ versionKey: false }) as Record<string, unknown>
  delete raw['_id']
  return raw as unknown as Task
}

// ---------------------------------------------------------------------------
// Error formatting
//
// Mongoose ValidationErrors carry per-field messages; we surface them as a
// single joined string.  MongoDB duplicate-key errors (code 11000) get a
// human-friendly message.  Everything else falls back to `err.message`.
// ---------------------------------------------------------------------------

function formatError(err: unknown): string {
  if (err instanceof mongoose.Error.ValidationError) {
    return Object.values(err.errors)
      .map((e) => e.message)
      .join('; ')
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['code'] === 11000
  ) {
    return 'A task with this identifier already exists.'
  }
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred.'
}

// ---------------------------------------------------------------------------
// getTasks — read all tasks, sorted for consistent board ordering
// ---------------------------------------------------------------------------

export async function getTasks(): Promise<ActionResult<Task[]>> {
  try {
    await connectToDatabase()
    const docs = await TaskModel.find({}).sort({ category: 1, assignedDay: 1, priority: 1 })
    return { success: true, data: docs.map(serialize) }
  } catch (err) {
    return { success: false, error: formatError(err) }
  }
}

// ---------------------------------------------------------------------------
// createTask — generates UUID + timestamps, persists, revalidates cache
// ---------------------------------------------------------------------------

export async function createTask(
  input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ActionResult<Task>> {
  try {
    await connectToDatabase()
    const now = new Date().toISOString()
    const doc = await TaskModel.create({
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })
    revalidatePath('/')
    return { success: true, data: serialize(doc) }
  } catch (err) {
    return { success: false, error: formatError(err) }
  }
}

// ---------------------------------------------------------------------------
// updateTask — guards immutable fields, stamps updatedAt, revalidates cache
// ---------------------------------------------------------------------------

export async function updateTask(
  id: string,
  updates: Partial<Task>,
): Promise<ActionResult<Task>> {
  try {
    await connectToDatabase()

    // Strip fields that must never change after creation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _guardId, createdAt: _guardCreatedAt, ...mutableFields } = updates

    const doc = await TaskModel.findOneAndUpdate(
      { id },
      { $set: { ...mutableFields, updatedAt: new Date().toISOString() } },
      { new: true, runValidators: true },
    )

    if (!doc) {
      return { success: false, error: `Task not found: ${id}` }
    }

    revalidatePath('/')
    return { success: true, data: serialize(doc) }
  } catch (err) {
    return { success: false, error: formatError(err) }
  }
}

// ---------------------------------------------------------------------------
// deleteTask — removes by UUID, revalidates cache
// ---------------------------------------------------------------------------

export async function deleteTask(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await connectToDatabase()
    const deleted = await TaskModel.findOneAndDelete({ id })
    if (!deleted) {
      return { success: false, error: `Task not found: ${id}` }
    }
    revalidatePath('/')
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: formatError(err) }
  }
}
