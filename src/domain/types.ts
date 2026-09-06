export type TaskCategory =
  | 'halacha_and_prep'
  | 'groom_gifts'
  | 'trousseau_and_home'
  | 'bride_clothing'
  | 'logistics_and_vendors'
  | 'sheva_brachot'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export type Priority = 'high' | 'medium' | 'low'

export type AssignedTo =
  | 'bride'
  | 'groom'
  | 'parents_bride'
  | 'parents_groom'

export interface Task {
  id: string
  title: string
  notes?: string
  status: TaskStatus
  category: TaskCategory
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
