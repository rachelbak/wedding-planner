import { Schema, model, models, type Document, type Model } from 'mongoose'
import type { Task } from '@/domain/types'

// ---------------------------------------------------------------------------
// Runtime enum arrays — single source of truth for Mongoose validation.
// Category is no longer validated against a closed enum; tasks accept any slug
// that corresponds to a document in the categories collection.
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const

export const PRIORITIES = ['high', 'medium', 'low'] as const

export const ASSIGNED_TO_VALUES = [
  'bride',
  'groom',
  'parents_bride',
  'parents_groom',
] as const

// ---------------------------------------------------------------------------
// Document interface — merges domain Task with Mongoose Document while
// keeping `id` typed as string (overriding Document's `id?: any` virtual).
// ---------------------------------------------------------------------------

export interface ITaskDocument extends Omit<Task, 'id'>, Document {
  id: string
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const taskSchema = new Schema<ITaskDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      required: true,
      default: 'TODO' satisfies Task['status'],
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    subcategory: {
      type: String,
      trim: true,
    },
    timeframe: {
      type: String,
      required: true,
    },
    assignedDay: {
      type: String,
      required: true,
    },
    dueDate: {
      type: String,
    },
    assignedTo: {
      type: String,
      enum: ASSIGNED_TO_VALUES,
      required: true,
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      required: true,
    },
    estimatedCost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    actualCost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: String,
      required: true,
    },
    updatedAt: {
      type: String,
      required: true,
    },
  },
  {
    id: false,        // Disable Mongoose's virtual `id` — our schema field IS the UUID
    timestamps: false, // We store createdAt / updatedAt manually as ISO strings
    versionKey: false, // Remove __v from documents
  },
)

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

// Primary lookups: tasks for a given category on a specific day
taskSchema.index({ category: 1, assignedDay: 1 })

// Board-style filtering: status column + priority sort
taskSchema.index({ status: 1, priority: -1 })

// Person-based filtering
taskSchema.index({ assignedTo: 1 })

// ---------------------------------------------------------------------------
// Model — guarded against Next.js hot-reload recompilation
// ---------------------------------------------------------------------------

const TaskModel: Model<ITaskDocument> =
  (models['Task'] as Model<ITaskDocument>) ?? model<ITaskDocument>('Task', taskSchema)

export default TaskModel
