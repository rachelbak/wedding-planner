'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Search,
  X,
  Loader2,
  ListTodo,
  Settings,
  ArrowRight,
  Mail,
} from 'lucide-react'
import { updateTask, deleteTask, createTask } from '@/app/actions/tasks'
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/app/actions/categories'
import type { Task, Category, Priority, AssignedTo, TaskStatus } from '@/domain/types'
import EditTaskModal from './EditTaskModal'
import EmailModal from '@/components/ui/EmailModal'

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIORITY_CONFIG: Record<Priority, { label: string; cls: string }> = {
  high:   { label: 'גבוה',   cls: 'bg-red-50   text-red-700   border-red-200'   },
  medium: { label: 'בינוני', cls: 'bg-amber-50  text-amber-700 border-amber-200' },
  low:    { label: 'נמוך',   cls: 'bg-slate-50  text-slate-500 border-slate-200' },
}

const ASSIGNEE_LABELS: Record<AssignedTo, string> = {
  bride:         'כלה',
  groom:         'חתן',
  parents_bride: 'הורי כלה',
  parents_groom: 'הורי חתן',
}

// ============================================================================
// LOCAL TYPES
// ============================================================================

type StatusFilter   = 'all' | 'todo' | 'done'
type AssigneeFilter = 'all' | 'bride' | 'groom' | 'parents'

interface ToastState { id: number; message: string }

interface AddFormData {
  title:      string
  notes:      string
  priority:   Priority
  assignedTo: AssignedTo
  subcategory: string
}

// Category modal state
interface CatForm {
  name:         string
  emoji:        string
  subcategories: string[]
  subInput:     string   // in-progress text before the user presses Enter
}

interface ModalState {
  isOpen:      boolean
  view:        'list' | 'form'
  editId:      string | null   // null = create mode
  form:        CatForm
  isSaving:    boolean
  deletingId:  string | null
}

const BLANK_FORM: CatForm = { name: '', emoji: '📋', subcategories: [], subInput: '' }

// ============================================================================
// TOAST
// ============================================================================

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div
      role="alert"
      className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-88 z-[100] flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium"
    >
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        aria-label="סגור הודעה"
        className="shrink-0 p-0.5 hover:opacity-70 transition-opacity"
      >
        <X size={15} />
      </button>
    </div>
  )
}

// ============================================================================
// TASK ITEM
// ============================================================================

interface TaskItemProps {
  task:       Task
  isExpanded: boolean
  isPending:  boolean
  onToggle:   () => void
  onDelete:   () => void
  onExpand:   () => void
  onEdit:     () => void
}

function TaskItem({ task, isExpanded, isPending, onToggle, onDelete, onExpand, onEdit }: TaskItemProps) {
  const isDone = task.status === 'DONE'
  const pCfg   = PRIORITY_CONFIG[task.priority]

  return (
    <div
      onClick={onEdit}
      className={`group bg-white rounded-xl border transition-all duration-200 cursor-pointer ${
        isDone
          ? 'border-slate-100 opacity-60'
          : 'border-slate-200 hover:border-violet-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3 p-4">

        {/* Checkbox — stopPropagation so it doesn't open edit modal */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          disabled={isPending}
          aria-label={isDone ? 'סמן כלא הושלם' : 'סמן כהושלם'}
          className="mt-0.5 shrink-0 text-slate-300 hover:text-violet-500 transition-colors disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 size={20} className="animate-spin text-violet-400" />
          ) : isDone ? (
            <CheckCircle2 size={20} className="text-violet-600" />
          ) : (
            <Circle size={20} />
          )}
        </button>

        {/* Title + Notes */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-relaxed transition-all duration-200 ${
              isDone ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
          >
            {task.title}
          </p>

          {task.subcategory && !isDone && (
            <span className="inline-block mt-1 text-[10px] font-medium text-violet-500 bg-violet-50 rounded-full px-2 py-0.5">
              {task.subcategory}
            </span>
          )}

          {task.notes && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onExpand() }}
                className="flex items-center gap-1 mt-1.5 text-xs text-slate-400 hover:text-violet-500 transition-colors"
              >
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                <span>{isExpanded ? 'הסתר הערות' : 'הצג הערות'}</span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isExpanded ? 'max-h-48 mt-2' : 'max-h-0'
                }`}
              >
                <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
                  {task.notes}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Badges + Delete */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className="text-xs text-slate-500 bg-slate-50 rounded-full px-2.5 py-0.5 border border-slate-100 whitespace-nowrap">
            {ASSIGNEE_LABELS[task.assignedTo]}
          </span>
          <span
            className={`text-xs font-medium rounded-full px-2.5 py-0.5 border whitespace-nowrap ${pCfg.cls}`}
          >
            {pCfg.label}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            disabled={isPending}
            aria-label="מחק משימה"
            className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ADD TASK FORM
// ============================================================================

interface AddTaskFormProps {
  activeCategory: Category | null
  isSubmitting:   boolean
  onSubmit:       (data: AddFormData) => void
  onCancel:       () => void
}

function AddTaskForm({ activeCategory, isSubmitting, onSubmit, onCancel }: AddTaskFormProps) {
  const [form, setForm] = useState<AddFormData>({
    title:       '',
    notes:       '',
    priority:    'medium',
    assignedTo:  'bride',
    subcategory: '',
  })

  const patch = <K extends keyof AddFormData>(key: K, value: AddFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSubmit(form)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-violet-50 rounded-xl border border-violet-200 p-4 space-y-3 shadow-sm"
    >
      <p className="text-sm font-semibold text-violet-800">
        {activeCategory?.emoji ?? '📋'} הוספת משימה
        {activeCategory ? ` — ${activeCategory.name}` : ''}
      </p>

      <input
        autoFocus
        type="text"
        value={form.title}
        onChange={(e) => patch('title', e.target.value)}
        placeholder="שם המשימה (חובה)"
        required
        maxLength={500}
        className="w-full px-3 py-2 text-sm rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400"
      />

      <textarea
        value={form.notes}
        onChange={(e) => patch('notes', e.target.value)}
        placeholder="הערות (אופציונלי)"
        rows={2}
        className="w-full px-3 py-2 text-sm rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400 resize-none"
      />

      <div className="flex flex-wrap gap-4">
        {/* Subcategory — shown only when the active category has subcategories */}
        {(activeCategory?.subcategories?.length ?? 0) > 0 && (
          <label className="flex items-center gap-2 text-xs">
            <span className="font-medium text-violet-700 whitespace-nowrap">תת-קטגוריה:</span>
            <select
              value={form.subcategory}
              onChange={(e) => patch('subcategory', e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">כללי</option>
              {activeCategory!.subcategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-xs">
          <span className="font-medium text-violet-700 whitespace-nowrap">עדיפות:</span>
          <select
            value={form.priority}
            onChange={(e) => patch('priority', e.target.value as Priority)}
            className="text-xs px-2 py-1.5 rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="high">גבוה 🔴</option>
            <option value="medium">בינוני 🟡</option>
            <option value="low">נמוך ⚪</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs">
          <span className="font-medium text-violet-700 whitespace-nowrap">אחראי:</span>
          <select
            value={form.assignedTo}
            onChange={(e) => patch('assignedTo', e.target.value as AssignedTo)}
            className="text-xs px-2 py-1.5 rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="bride">כלה</option>
            <option value="groom">חתן</option>
            <option value="parents_bride">הורי כלה</option>
            <option value="parents_groom">הורי חתן</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          הוסף
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  )
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({
  hasActiveFilters,
  onAddClick,
}: {
  hasActiveFilters: boolean
  onAddClick: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4 shadow-sm">
        <ListTodo className="text-violet-400" size={28} />
      </div>

      {hasActiveFilters ? (
        <>
          <p className="text-base font-semibold text-slate-700 mb-1">
            אין משימות מתאימות לחיפוש
          </p>
          <p className="text-sm text-slate-400">נסי לשנות את הפילטרים</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-700 mb-1">
            אין עדיין משימות כאן
          </p>
          <p className="text-sm text-slate-400 mb-4">הוסיפי את המשימה הראשונה</p>
          <button
            onClick={onAddClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm shadow-violet-200"
          >
            <Plus size={16} />
            הוספת משימה ראשונה
          </button>
        </>
      )}
    </div>
  )
}

// ============================================================================
// CATEGORY MODAL
// ============================================================================

interface CategoryModalProps {
  categories:          Category[]
  modal:               ModalState
  taskCountBySlug:     Record<string, number>
  onClose:             () => void
  onBackToList:        () => void
  onOpenCreate:        () => void
  onOpenEdit:          (cat: Category) => void
  onFormChange:        (patch: Partial<CatForm>) => void
  onAddSubcategory:    () => void
  onRemoveSubcategory: (idx: number) => void
  onSave:              () => void
  onDelete:            (cat: Category) => void
}

function CategoryModal({
  categories,
  modal,
  taskCountBySlug,
  onClose,
  onBackToList,
  onOpenCreate,
  onOpenEdit,
  onFormChange,
  onAddSubcategory,
  onRemoveSubcategory,
  onSave,
  onDelete,
}: CategoryModalProps) {
  if (!modal.isOpen) return null
  const { view, form, isSaving, deletingId, editId } = modal

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          {view === 'form' ? (
            <button
              onClick={onBackToList}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-700 transition-colors"
            >
              <ArrowRight size={16} />
              <span>חזרה</span>
            </button>
          ) : (
            <h2 className="text-base font-bold text-slate-800">ניהול קטגוריות</h2>
          )}
          {view === 'form' && (
            <h2 className="text-base font-bold text-slate-800">
              {editId ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}
            </h2>
          )}
          <button
            onClick={onClose}
            aria-label="סגור"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="p-4 space-y-2">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  אין קטגוריות עדיין
                </p>
              ) : (
                categories.map((cat) => {
                  const count    = taskCountBySlug[cat.slug] ?? 0
                  const isDeleting = deletingId === cat.id
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-violet-50/50 transition-colors group"
                    >
                      <span className="text-xl shrink-0">{cat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {cat.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {count} משימות
                          {cat.subcategories.length > 0 && ` · ${cat.subcategories.length} תת-קטגוריות`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onOpenEdit(cat)}
                          aria-label="ערוך"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-700 hover:bg-violet-100 transition-colors text-xs"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDelete(cat)}
                          disabled={isDeleting}
                          aria-label="מחק"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {isDeleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Add new */}
              <button
                onClick={onOpenCreate}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-violet-200 text-sm font-medium text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition-all"
              >
                <Plus size={16} />
                הוספת קטגוריה חדשה
              </button>
            </div>
          )}

          {/* FORM VIEW */}
          {view === 'form' && (
            <div className="p-5 space-y-5">
              {/* Name + Emoji row */}
              <div className="flex gap-3">
                <label className="w-16 shrink-0">
                  <span className="text-xs font-medium text-slate-500 block mb-1.5">אימוג׳י</span>
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={(e) => onFormChange({ emoji: e.target.value })}
                    maxLength={4}
                    className="w-full text-center text-xl px-2 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-xs font-medium text-slate-500 block mb-1.5">שם הקטגוריה</span>
                  <input
                    autoFocus
                    type="text"
                    value={form.name}
                    onChange={(e) => onFormChange({ name: e.target.value })}
                    placeholder="למשל: ביגוד וטיפוח"
                    maxLength={100}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400"
                  />
                </label>
              </div>

              {/* Subcategories */}
              <div>
                <span className="text-xs font-medium text-slate-500 block mb-2">
                  תת-קטגוריות (אופציונלי)
                </span>

                {/* Existing chips */}
                {form.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {form.subcategories.map((s, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-full px-3 py-1"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => onRemoveSubcategory(idx)}
                          aria-label={`הסר ${s}`}
                          className="text-violet-400 hover:text-violet-700 transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add subcategory input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.subInput}
                    onChange={(e) => onFormChange({ subInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        onAddSubcategory()
                      }
                    }}
                    placeholder="הוסיפי תת-קטגוריה ולחצי Enter"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={onAddSubcategory}
                    disabled={!form.subInput.trim()}
                    className="px-3 py-2 text-sm font-medium bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 rounded-lg transition-colors disabled:opacity-40"
                  >
                    הוסף
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  לחצי Enter או פסיק להוספה מהירה
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {view === 'form' && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button
              onClick={onSave}
              disabled={isSaving || !form.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {isSaving ? (
                <><Loader2 size={15} className="animate-spin" /> שומר...</>
              ) : (
                editId ? 'שמור שינויים' : 'צרי קטגוריה'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TaskChecklist({
  initialTasks,
  initialCategories,
  initialCategory,
}: {
  initialTasks:       Task[]
  initialCategories:  Category[]
  initialCategory?:   string
}) {
  // ── Core state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]             = useState<Task[]>(initialTasks)
  const [categories, setCategories]   = useState<Category[]>(initialCategories)

  const initCat = initialCategories.find((c) => c.slug === initialCategory)
    ?? initialCategories[0]
    ?? null
  const [activeCategory, setActiveCategory] = useState<Category | null>(initCat)
  const [activeSubcategory, setActiveSubcategory] = useState<string>('all')

  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [searchQuery, setSearchQuery]       = useState('')
  const [showAddForm, setShowAddForm]       = useState(false)
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [expandedIds, setExpandedIds]       = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds]         = useState<Set<string>>(new Set())
  const [toast, setToast]                   = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalState>({
    isOpen:     false,
    view:       'list',
    editId:     null,
    form:       BLANK_FORM,
    isSaving:   false,
    deletingId: null,
  })

  // ── Edit task modal ───────────────────────────────────────────────────────
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // ── Email modal ───────────────────────────────────────────────────────────
  const [emailOpen, setEmailOpen] = useState(false)

  function handleSaveEdit(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Pending helpers ───────────────────────────────────────────────────────
  const addPending = (id: string) =>
    setPendingIds((prev) => new Set([...prev, id]))
  const removePending = (id: string) =>
    setPendingIds((prev) => { const n = new Set(prev); n.delete(id); return n })

  // ── Filtered view ─────────────────────────────────────────────────────────
  const categoryTasks = tasks.filter((t) => t.category === activeCategory?.slug)

  const filteredTasks = categoryTasks
    .filter((t) => {
      if (activeSubcategory === 'all') return true
      return t.subcategory === activeSubcategory
    })
    .filter((t) => {
      if (statusFilter === 'done') return t.status === 'DONE'
      if (statusFilter === 'todo') return t.status !== 'DONE'
      return true
    })
    .filter((t) => {
      if (assigneeFilter === 'all') return true
      if (assigneeFilter === 'parents')
        return t.assignedTo === 'parents_bride' || t.assignedTo === 'parents_groom'
      return t.assignedTo === (assigneeFilter as AssignedTo)
    })
    .filter((t) => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.notes?.toLowerCase().includes(q) ?? false)
      )
    })

  const hasActiveFilters =
    statusFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    activeSubcategory !== 'all'

  // ── Action: toggle status ─────────────────────────────────────────────────
  async function handleToggle(task: Task) {
    if (pendingIds.has(task.id)) return
    const newStatus: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    addPending(task.id)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))
    const result = await updateTask(task.id, { status: newStatus })
    removePending(task.id)
    if (!result.success) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
      showToast(result.error)
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? result.data : t)))
    }
  }

  // ── Action: delete ────────────────────────────────────────────────────────
  async function handleDelete(task: Task) {
    if (pendingIds.has(task.id)) return
    addPending(task.id)
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    const result = await deleteTask(task.id)
    removePending(task.id)
    if (!result.success) {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]))
      showToast(result.error)
    }
  }

  // ── Action: create task ───────────────────────────────────────────────────
  async function handleCreate(formData: AddFormData) {
    setIsSubmitting(true)

    const input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      title:         formData.title.trim(),
      notes:         formData.notes.trim() || undefined,
      status:        'TODO',
      category:      activeCategory?.slug ?? '',
      subcategory:   formData.subcategory || undefined,
      timeframe:     'backlog',
      assignedDay:   'backlog',
      assignedTo:    formData.assignedTo,
      priority:      formData.priority,
      estimatedCost: 0,
      actualCost:    0,
    }

    const tempId  = `temp-${Date.now()}`
    const now     = new Date().toISOString()
    const tempTask: Task = { ...input, id: tempId, createdAt: now, updatedAt: now }

    setTasks((prev) => [...prev, tempTask])
    setShowAddForm(false)
    setIsSubmitting(false)

    const result = await createTask(input)
    if (!result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId))
      setShowAddForm(true)
      showToast(result.error)
    } else {
      setTasks((prev) => prev.map((t) => (t.id === tempId ? result.data : t)))
    }
  }

  // ── Toggle expand ──────────────────────────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Category selection ────────────────────────────────────────────────────
  function selectCategory(cat: Category) {
    setActiveCategory(cat)
    setActiveSubcategory('all')
    setShowAddForm(false)
    setSearchQuery('')
    setStatusFilter('all')
    setAssigneeFilter('all')
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openModalList() {
    setModal({ isOpen: true, view: 'list', editId: null, form: BLANK_FORM, isSaving: false, deletingId: null })
  }

  function openModalCreate() {
    setModal((prev) => ({ ...prev, view: 'form', editId: null, form: BLANK_FORM }))
  }

  function openModalEdit(cat: Category) {
    setModal((prev) => ({
      ...prev,
      view:   'form',
      editId: cat.id,
      form:   { name: cat.name, emoji: cat.emoji, subcategories: [...cat.subcategories], subInput: '' },
    }))
  }

  function patchModalForm(patch: Partial<CatForm>) {
    setModal((prev) => ({ ...prev, form: { ...prev.form, ...patch } }))
  }

  function addSubcategory() {
    const val = modal.form.subInput.trim()
    if (!val || modal.form.subcategories.includes(val)) {
      patchModalForm({ subInput: '' })
      return
    }
    patchModalForm({ subcategories: [...modal.form.subcategories, val], subInput: '' })
  }

  function removeSubcategory(idx: number) {
    patchModalForm({ subcategories: modal.form.subcategories.filter((_, i) => i !== idx) })
  }

  async function handleSaveCategory() {
    const { form, editId } = modal
    if (!form.name.trim()) return
    setModal((prev) => ({ ...prev, isSaving: true }))

    const result = editId
      ? await updateCategory(editId, form.name, form.emoji, form.subcategories)
      : await createCategory(form.name, form.emoji, form.subcategories)

    setModal((prev) => ({ ...prev, isSaving: false }))

    if (!result.success) {
      showToast(result.error)
      return
    }

    if (editId) {
      setCategories((prev) => prev.map((c) => (c.id === editId ? result.data : c)))
      if (activeCategory?.id === editId) setActiveCategory(result.data)
    } else {
      setCategories((prev) => [...prev, result.data])
    }

    // Return to list
    setModal((prev) => ({ ...prev, view: 'list', editId: null, form: BLANK_FORM }))
  }

  async function handleDeleteCategory(cat: Category) {
    setModal((prev) => ({ ...prev, deletingId: cat.id }))
    const result = await deleteCategory(cat.id)
    setModal((prev) => ({ ...prev, deletingId: null }))

    if (!result.success) {
      showToast(result.error)
      return
    }

    const updated = categories.filter((c) => c.id !== cat.id)
    setCategories(updated)
    if (activeCategory?.id === cat.id) setActiveCategory(updated[0] ?? null)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalDone  = tasks.filter((t) => t.status === 'DONE').length
  const totalTasks = tasks.length

  // Task count per slug — used in the modal list
  const taskCountBySlug: Record<string, number> = {}
  for (const t of tasks) {
    taskCountBySlug[t.category] = (taskCountBySlug[t.category] ?? 0) + 1
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl">

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <CategoryModal
        categories={categories}
        modal={modal}
        taskCountBySlug={taskCountBySlug}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        onBackToList={() => setModal((prev) => ({ ...prev, view: 'list', editId: null, form: BLANK_FORM }))}
        onOpenCreate={openModalCreate}
        onOpenEdit={openModalEdit}
        onFormChange={patchModalForm}
        onAddSubcategory={addSubcategory}
        onRemoveSubcategory={removeSubcategory}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          categories={categories}
          onSave={handleSaveEdit}
          onClose={() => setEditingTask(null)}
        />
      )}

      {emailOpen && (
        <EmailModal
          taskIds={filteredTasks.map((t) => t.id)}
          defaultEmail={process.env.NEXT_PUBLIC_BRIDE_EMAIL ?? ''}
          onClose={() => setEmailOpen(false)}
        />
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">משימות וקניות</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalDone} / {totalTasks} משימות הושלמו
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEmailOpen(true)}
            title="שלחי רשימה במייל"
            aria-label="שליחה למייל"
            className="flex items-center gap-2 px-3 py-2 bg-white text-slate-600 text-sm font-medium rounded-xl hover:bg-violet-50 hover:text-violet-700 border border-slate-200 transition-colors"
          >
            <Mail size={15} />
            <span className="hidden sm:inline">מייל</span>
          </button>
          <button
            onClick={() => { setShowAddForm((v) => !v) }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 active:bg-violet-800 transition-colors shadow-sm shadow-violet-200"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">הוסף משימה</span>
          </button>
        </div>
      </div>

      {/* ── Category tab bar + ⚙️ ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const pending  = tasks.filter((t) => t.category === cat.slug && t.status !== 'DONE').length
            const isActive = activeCategory?.slug === cat.slug
            return (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-200'
                    : 'bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-700 border border-slate-200'
                }`}
              >
                <span aria-hidden="true">{cat.emoji}</span>
                <span>{cat.name}</span>
                {pending > 0 && (
                  <span
                    className={`text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[18px] text-center ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {pending}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Manage categories gear */}
        <button
          onClick={openModalList}
          aria-label="ניהול קטגוריות"
          title="ניהול קטגוריות"
          className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 bg-white transition-colors mb-2"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* ── Subcategory filter bar ─────────────────────────────────────────── */}
      {(activeCategory?.subcategories?.length ?? 0) > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-hide">
          {['all', ...(activeCategory?.subcategories ?? [])].map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                activeSubcategory === sub
                  ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-400'
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {sub === 'all' ? 'הכל' : sub}
            </button>
          ))}
        </div>
      )}

      {/* ── Inline add form ────────────────────────────────────────────────── */}
      {showAddForm && (
        <div className="mb-4">
          <AddTaskForm
            activeCategory={activeCategory}
            isSubmitting={isSubmitting}
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש משימות..."
            className="w-full pr-9 pl-8 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="נקה חיפוש"
              className="absolute top-1/2 -translate-y-1/2 left-2.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden p-0.5 gap-0.5 self-start sm:self-auto">
          {(
            [['all', 'הכל'], ['todo', 'לביצוע'], ['done', 'בוצע']] as [StatusFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                statusFilter === val
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Assignee filter */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-slate-600 self-start sm:self-auto"
        >
          <option value="all">כל האחראים</option>
          <option value="bride">כלה</option>
          <option value="groom">חתן</option>
          <option value="parents">הורים</option>
        </select>
      </div>

      {/* ── Task list ──────────────────────────────────────────────────────── */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          hasActiveFilters={hasActiveFilters}
          onAddClick={() => setShowAddForm(true)}
        />
      ) : (
        <>
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isExpanded={expandedIds.has(task.id)}
                isPending={pendingIds.has(task.id)}
                onToggle={() => handleToggle(task)}
                onDelete={() => handleDelete(task)}
                onExpand={() => toggleExpand(task.id)}
                onEdit={() => setEditingTask(task)}
              />
            ))}
          </div>

          <p className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
            {filteredTasks.filter((t) => t.status === 'DONE').length} מתוך{' '}
            {filteredTasks.length} הושלמו בתצוגה הנוכחית
          </p>
        </>
      )}
    </div>
  )
}
