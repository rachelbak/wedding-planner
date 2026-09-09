'use client'

import { useState } from 'react'
import { X, Loader2, Save, Trash2 } from 'lucide-react'
import { updateTask, deleteTask } from '@/app/actions/tasks'
import type { Task, Category, Priority, AssignedTo } from '@/domain/types'

// ============================================================================
// TYPES
// ============================================================================

interface EditForm {
  title:       string
  notes:       string
  priority:    Priority
  assignedTo:  AssignedTo
  category:    string
  subcategory: string
}

export interface EditTaskModalProps {
  task:       Task
  categories: Category[]
  onSave:     (updated: Task) => void
  onDelete?:  (id: string) => void   // optional — callers that support delete pass it
  onClose:    () => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EditTaskModal({ task, categories, onSave, onDelete, onClose }: EditTaskModalProps) {
  const [form, setForm] = useState<EditForm>({
    title:       task.title,
    notes:       task.notes ?? '',
    priority:    task.priority,
    assignedTo:  task.assignedTo,
    category:    task.category,
    subcategory: task.subcategory ?? '',
  })
  const [isSaving,        setIsSaving]        = useState(false)
  const [isDeleting,      setIsDeleting]      = useState(false)
  const [deleteConfirm,   setDeleteConfirm]   = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const patch = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  function handleCategoryChange(slug: string) {
    setForm((prev) => ({ ...prev, category: slug, subcategory: '' }))
  }

  const activeCat = categories.find((c) => c.slug === form.category)

  async function handleSave() {
    if (!form.title.trim()) return
    setIsSaving(true)
    setError(null)

    const result = await updateTask(task.id, {
      title:      form.title.trim(),
      notes:      form.notes.trim() || undefined,
      priority:   form.priority,
      assignedTo: form.assignedTo,
      category:   form.category,
      subcategory: form.subcategory || null,
    })

    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onSave(result.data)
    onClose()
  }

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    const result = await deleteTask(task.id)
    setIsDeleting(false)
    if (!result.success) {
      setError(result.error)
      setDeleteConfirm(false)
      return
    }
    onDelete?.(task.id)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSave()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800">עריכת משימה</h2>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Title */}
          <label className="block">
            <span className="text-xs font-medium text-slate-500 block mb-1.5">
              שם המשימה <span className="text-red-400">*</span>
            </span>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={(e) => patch('title', e.target.value)}
              maxLength={500}
              placeholder="שם המשימה"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400"
            />
          </label>

          {/* Notes */}
          <label className="block">
            <span className="text-xs font-medium text-slate-500 block mb-1.5">הערות</span>
            <textarea
              value={form.notes}
              onChange={(e) => patch('notes', e.target.value)}
              rows={3}
              placeholder="הוסיפי הערות (אופציונלי)"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400 resize-none"
            />
          </label>

          {/* Priority + Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-500 block mb-1.5">עדיפות</span>
              <select
                value={form.priority}
                onChange={(e) => patch('priority', e.target.value as Priority)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="high">גבוה 🔴</option>
                <option value="medium">בינוני 🟡</option>
                <option value="low">נמוך ⚪</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-500 block mb-1.5">אחראי</span>
              <select
                value={form.assignedTo}
                onChange={(e) => patch('assignedTo', e.target.value as AssignedTo)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="bride">כלה</option>
                <option value="groom">חתן</option>
                <option value="parents_bride">הורי כלה</option>
                <option value="parents_groom">הורי חתן</option>
              </select>
            </label>
          </div>

          {/* Category */}
          <label className="block">
            <span className="text-xs font-medium text-slate-500 block mb-1.5">קטגוריה</span>
            {categories.length === 0 ? (
              <p className="text-xs text-slate-400 italic">טוען קטגוריות...</p>
            ) : (
              <select
                value={form.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.emoji} {cat.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Subcategory */}
          {(activeCat?.subcategories?.length ?? 0) > 0 && (
            <label className="block">
              <span className="text-xs font-medium text-slate-500 block mb-1.5">תת-קטגוריה</span>
              <select
                value={form.subcategory}
                onChange={(e) => patch('subcategory', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">כללי</option>
                {activeCat!.subcategories.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-2">

          {/* Save / Cancel row */}
          <div className="flex gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={isSaving || isDeleting || !form.title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {isSaving ? (
                <><Loader2 size={15} className="animate-spin" />שומר...</>
              ) : (
                <><Save size={15} />שמור שינויים</>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-60"
            >
              ביטול
            </button>
          </div>

          {/* Delete row — only when caller supports it */}
          {onDelete && (
            deleteConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={() => void handleDelete()}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {isDeleting ? (
                    <><Loader2 size={14} className="animate-spin" />מוחק...</>
                  ) : (
                    <><Trash2 size={14} />אשרי מחיקה</>
                  )}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  בטלי
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                disabled={isSaving || isDeleting}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40"
              >
                <Trash2 size={14} />
                מחק משימה
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
