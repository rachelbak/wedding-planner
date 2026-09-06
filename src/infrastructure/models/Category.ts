import { Schema, model, models, type Document, type Model } from 'mongoose'
import type { Category } from '@/domain/types'

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface ICategoryDocument extends Omit<Category, 'id'>, Document {
  id: string
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const categorySchema = new Schema<ICategoryDocument>(
  {
    id:            { type: String, required: true, unique: true },
    name:          { type: String, required: true, trim: true, maxlength: 200 },
    slug:          { type: String, required: true, unique: true, trim: true },
    emoji:         { type: String, required: true, default: '📋' },
    subcategories: [{ type: String, trim: true }],
    createdAt:     { type: String, required: true },
  },
  {
    id: false,        // Our UUID field IS the id — disable Mongoose's virtual
    versionKey: false,
  },
)

// Slug is the foreign key used in Task.category — must be fast
categorySchema.index({ slug: 1 }, { unique: true })
categorySchema.index({ createdAt: 1 })

// ---------------------------------------------------------------------------
// Model — guarded against Next.js hot-reload recompilation
// ---------------------------------------------------------------------------

const CategoryModel: Model<ICategoryDocument> =
  (models['Category'] as Model<ICategoryDocument>) ??
  model<ICategoryDocument>('Category', categorySchema)

export default CategoryModel
