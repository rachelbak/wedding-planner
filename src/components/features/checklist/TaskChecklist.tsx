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
} from 'lucide-react'
import { updateTask, deleteTask, createTask } from '@/app/actions/tasks'
import type { Task, TaskCategory, Priority, AssignedTo, TaskStatus } from '@/domain/types'

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_ORDER: TaskCategory[] = [
  'halacha_and_prep',
  'groom_gifts',
  'trousseau_and_home',
  'bride_clothing',
  'logistics_and_vendors',
  'sheva_brachot',
]

const CATEGORY_CONFIG: Record<TaskCategory, { label: string; emoji: string }> = {
  halacha_and_prep:      { label: 'הלכה והכנות רוחניות',  emoji: '✡️' },
  groom_gifts:           { label: 'מתנות לחתן',            emoji: '🎁' },
  trousseau_and_home:    { label: 'נדוניה ובית',           emoji: '🏠' },
  bride_clothing:        { label: 'ביגוד וטיפוח כלה',      emoji: '👗' },
  logistics_and_vendors: { label: 'לוגיסטיקה וספקים',      emoji: '📋' },
  sheva_brachot:         { label: 'שבע ברכות ואירועים',     emoji: '🎊' },
}

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
  title: string
  notes: string
  priority: Priority
  assignedTo: AssignedTo
}

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
  task: Task
  isExpanded: boolean
  isPending: boolean
  onToggle: () => void
  onDelete: () => void
  onExpand: () => void
}

function TaskItem({ task, isExpanded, isPending, onToggle, onDelete, onExpand }: TaskItemProps) {
  const isDone   = task.status === 'DONE'
  const pCfg     = PRIORITY_CONFIG[task.priority]

  return (
    <div
      className={`group bg-white rounded-xl border transition-all duration-200 ${
        isDone
          ? 'border-slate-100 opacity-60'
          : 'border-slate-200 hover:border-violet-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3 p-4">

        {/* ── Checkbox ─────────────────────────────────────────────────── */}
        <button
          onClick={onToggle}
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

        {/* ── Title + Notes ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-relaxed transition-all duration-200 ${
              isDone ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
          >
            {task.title}
          </p>

          {task.notes && (
            <>
              <button
                onClick={onExpand}
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

        {/* ── Badges + Delete ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Assignee */}
          <span className="text-xs text-slate-500 bg-slate-50 rounded-full px-2.5 py-0.5 border border-slate-100 whitespace-nowrap">
            {ASSIGNEE_LABELS[task.assignedTo]}
          </span>

          {/* Priority */}
          <span
            className={`text-xs font-medium rounded-full px-2.5 py-0.5 border whitespace-nowrap ${pCfg.cls}`}
          >
            {pCfg.label}
          </span>

          {/* Delete — visible on hover (desktop) / always (mobile) */}
          <button
            onClick={onDelete}
            disabled={isPending}
            aria-label="מחק משימה"
            className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
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
  category: TaskCategory
  isSubmitting: boolean
  onSubmit: (data: AddFormData) => void
  onCancel: () => void
}

function AddTaskForm({ category, isSubmitting, onSubmit, onCancel }: AddTaskFormProps) {
  const [form, setForm] = useState<AddFormData>({
    title: '',
    notes: '',
    priority: 'medium',
    assignedTo: 'bride',
  })

  const patch = <K extends keyof AddFormData>(key: K, value: AddFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSubmit(form)
  }

  const catCfg = CATEGORY_CONFIG[category]

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-violet-50 rounded-xl border border-violet-200 p-4 space-y-3 shadow-sm"
    >
      <p className="text-sm font-semibold text-violet-800">
        {catCfg.emoji} הוספת משימה — {catCfg.label}
      </p>

      {/* Title */}
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

      {/* Notes */}
      <textarea
        value={form.notes}
        onChange={(e) => patch('notes', e.target.value)}
        placeholder="הערות (אופציונלי)"
        rows={2}
        className="w-full px-3 py-2 text-sm rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400 resize-none"
      />

      {/* Priority + Assignee selects */}
      <div className="flex flex-wrap gap-4">
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

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSubmitting || !form.title.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting && <Loader2 size={13} className="animate-spin" />}
          הוסף משימה
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
          <p className="text-sm text-slate-400">נסי לשנות את הפילטרים או את מונח החיפוש</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-700 mb-1">
            אין משימות בקטגוריה זו עדיין
          </p>
          <p className="text-sm text-slate-400 mb-6">
            לחצי על הכפתור להוספת המשימה הראשונה
          </p>
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
// MAIN COMPONENT
// ============================================================================

export default function TaskChecklist({
  initialTasks,
  initialCategory,
}: {
  initialTasks: Task[]
  initialCategory?: string
}) {
  // ── Core state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]                 = useState<Task[]>(initialTasks)
  const [activeCategory, setActiveCategory] = useState<TaskCategory>(
    CATEGORY_ORDER.includes(initialCategory as TaskCategory)
      ? (initialCategory as TaskCategory)
      : CATEGORY_ORDER[0]!,
  )
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [searchQuery, setSearchQuery]     = useState('')
  const [showAddForm, setShowAddForm]     = useState(false)
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds]       = useState<Set<string>>(new Set())
  const [toast, setToast]                 = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Pending helpers ────────────────────────────────────────────────────────
  const addPending = (id: string) =>
    setPendingIds((prev) => new Set([...prev, id]))
  const removePending = (id: string) =>
    setPendingIds((prev) => { const n = new Set(prev); n.delete(id); return n })

  // ── Filtered view ─────────────────────────────────────────────────────────
  const categoryTasks = tasks.filter((t) => t.category === activeCategory)

  const filteredTasks = categoryTasks
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
    statusFilter !== 'all' || assigneeFilter !== 'all' || searchQuery.trim() !== ''

  // ── Action: toggle status ─────────────────────────────────────────────────
  async function handleToggle(task: Task) {
    if (pendingIds.has(task.id)) return
    const newStatus: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'

    addPending(task.id)
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    )

    const result = await updateTask(task.id, { status: newStatus })
    removePending(task.id)

    if (!result.success) {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      )
      showToast(result.error)
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? result.data : t))
      )
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
      // Rollback — re-insert at original position is complex; append is fine
      setTasks((prev) =>
        prev.some((t) => t.id === task.id) ? prev : [...prev, task]
      )
      showToast(result.error)
    }
  }

  // ── Action: create ────────────────────────────────────────────────────────
  async function handleCreate(formData: AddFormData) {
    setIsSubmitting(true)

    const input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      title:         formData.title.trim(),
      notes:         formData.notes.trim() || undefined,
      status:        'TODO',
      category:      activeCategory,
      timeframe:     'backlog',
      assignedDay:   'backlog',
      assignedTo:    formData.assignedTo,
      priority:      formData.priority,
      estimatedCost: 0,
      actualCost:    0,
    }

    // Optimistic insert
    const tempId  = `temp-${Date.now()}`
    const now     = new Date().toISOString()
    const tempTask: Task = { ...input, id: tempId, createdAt: now, updatedAt: now }

    setTasks((prev) => [...prev, tempTask])
    setShowAddForm(false)
    setIsSubmitting(false)

    const result = await createTask(input)

    if (!result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId))
      setShowAddForm(true) // reopen so the user can retry
      showToast(result.error)
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? result.data : t))
      )
    }
  }

  // ── Toggle expand ─────────────────────────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Category change ───────────────────────────────────────────────────────
  function changeCategory(cat: TaskCategory) {
    setActiveCategory(cat)
    setShowAddForm(false)
    setSearchQuery('')
    setStatusFilter('all')
    setAssigneeFilter('all')
  }

  // ── Stats for header ──────────────────────────────────────────────────────
  const totalDone  = tasks.filter((t) => t.status === 'DONE').length
  const totalTasks = tasks.length

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl">

      {/* Toast */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">משימות וקניות</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalDone} / {totalTasks} משימות הושלמו
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 active:bg-violet-800 transition-colors shadow-sm shadow-violet-200"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">הוסף משימה</span>
        </button>
      </div>

      {/* ── Category tab bar ─────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {CATEGORY_ORDER.map((cat) => {
          const cfg      = CATEGORY_CONFIG[cat]
          const pending  = tasks.filter((t) => t.category === cat && t.status !== 'DONE').length
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => changeCategory(cat)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-200'
                  : 'bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-700 border border-slate-200'
              }`}
            >
              <span aria-hidden="true">{cfg.emoji}</span>
              <span>{cfg.label}</span>
              {pending > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[18px] text-center ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {pending}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Inline add form ──────────────────────────────────────────── */}
      {showAddForm && (
        <div className="mb-4">
          <AddTaskForm
            category={activeCategory}
            isSubmitting={isSubmitting}
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────── */}
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
            [
              ['all',  'הכל']    ,
              ['todo', 'לביצוע'] ,
              ['done', 'בוצע']   ,
            ] as [StatusFilter, string][]
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

      {/* ── Task list ────────────────────────────────────────────────── */}
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
              />
            ))}
          </div>

          {/* Footer stats */}
          <p className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
            {filteredTasks.filter((t) => t.status === 'DONE').length} מתוך{' '}
            {filteredTasks.length} הושלמו בתצוגה הנוכחית
          </p>
        </>
      )}
    </div>
  )
}
