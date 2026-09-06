'use server'

import { revalidatePath } from 'next/cache'
import { connectToDatabase } from '@/infrastructure/db'
import CategoryModel, { type ICategoryDocument } from '@/infrastructure/models/Category'
import type { Category } from '@/domain/types'
import type { ActionResult } from './tasks'

// ---------------------------------------------------------------------------
// Serialization — strips Mongoose internals, returns plain Category
// ---------------------------------------------------------------------------

function serialize(doc: ICategoryDocument): Category {
  const raw = doc.toObject({ versionKey: false }) as Record<string, unknown>
  delete raw['_id']
  return raw as unknown as Category
}

// ---------------------------------------------------------------------------
// Slug generation
//
// Preserves Hebrew characters, ASCII alphanumeric, and hyphens.
// Falls back to a timestamp suffix if the name produces an empty slug.
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9֐-׿-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

// ---------------------------------------------------------------------------
// getCategories — ordered by creation date (stable for tab ordering)
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<ActionResult<Category[]>> {
  try {
    await connectToDatabase()
    const docs = await CategoryModel.find({}).sort({ createdAt: 1 })
    return { success: true, data: docs.map(serialize) }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בטעינת קטגוריות',
    }
  }
}

// ---------------------------------------------------------------------------
// createCategory — generates UUID + slug, persists, revalidates
// ---------------------------------------------------------------------------

export async function createCategory(
  name: string,
  emoji: string,
  subcategories: string[],
): Promise<ActionResult<Category>> {
  try {
    await connectToDatabase()
    const slug = toSlug(name) || `cat-${Date.now()}`
    const now = new Date().toISOString()
    const doc = await CategoryModel.create({
      id: crypto.randomUUID(),
      name: name.trim(),
      slug,
      emoji: emoji.trim() || '📋',
      subcategories: subcategories.map((s) => s.trim()).filter(Boolean),
      createdAt: now,
    })
    revalidatePath('/')
    return { success: true, data: serialize(doc) }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה ביצירת קטגוריה',
    }
  }
}

// ---------------------------------------------------------------------------
// updateCategory — name / emoji / subcategories; re-derives slug from name
// ---------------------------------------------------------------------------

export async function updateCategory(
  id: string,
  name: string,
  emoji: string,
  subcategories: string[],
): Promise<ActionResult<Category>> {
  try {
    await connectToDatabase()
    const slug = toSlug(name) || id
    const doc = await CategoryModel.findOneAndUpdate(
      { id },
      {
        $set: {
          name: name.trim(),
          slug,
          emoji: emoji.trim() || '📋',
          subcategories: subcategories.map((s) => s.trim()).filter(Boolean),
        },
      },
      { new: true, runValidators: true },
    )
    if (!doc) return { success: false, error: `קטגוריה לא נמצאה: ${id}` }
    revalidatePath('/')
    return { success: true, data: serialize(doc) }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון קטגוריה',
    }
  }
}

// ---------------------------------------------------------------------------
// deleteCategory — removes by UUID, revalidates
// ---------------------------------------------------------------------------

export async function deleteCategory(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await connectToDatabase()
    const deleted = await CategoryModel.findOneAndDelete({ id })
    if (!deleted) return { success: false, error: `קטגוריה לא נמצאה: ${id}` }
    revalidatePath('/')
    return { success: true, data: { id } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה במחיקת קטגוריה',
    }
  }
}
