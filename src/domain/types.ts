export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

// Previously a closed union — now an open string to support dynamic categories.
// Existing slugs ('halacha_and_prep', etc.) remain valid values.
export type TaskCategory = string

export type Priority = 'high' | 'medium' | 'low'

export type AssignedTo =
  | 'bride'
  | 'groom'
  | 'parents_bride'
  | 'parents_groom'

// ---------------------------------------------------------------------------
// Category — managed in MongoDB, replaces hardcoded CATEGORY_CONFIG constants
// ---------------------------------------------------------------------------

export interface Category {
  id: string          // UUID
  name: string        // Display label, e.g. "הלכה והכנות"
  slug: string        // Stable key used in Task.category, e.g. "halacha_and_prep"
  emoji: string       // Single emoji for tab display
  subcategories: string[] // Optional sub-filters, e.g. ["חורף", "קיץ"]
  createdAt: string   // ISO string — controls display order
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export interface Task {
  id: string
  title: string
  notes?: string
  status: TaskStatus
  category: string    // matches Category.slug
  subcategory?: string
  timeframe: string
  assignedDay: string
  dueDate?: string
  assignedTo: AssignedTo
  priority: Priority
  estimatedCost: number
  actualCost: number
  createdAt: string
  updatedAt: string
}
