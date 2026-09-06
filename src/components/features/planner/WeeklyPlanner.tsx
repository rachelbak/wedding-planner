'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, Circle, Loader2, MoreHorizontal, X } from 'lucide-react'
import { updateTask } from '@/app/actions/tasks'
import type { Task, TaskCategory, Priority, AssignedTo, TaskStatus } from '@/domain/types'

// ============================================================================
// CONSTANTS
// ============================================================================

const DAYS: { key: string; label: string }[] = [
  { key: 'backlog',    label: 'טרם שובץ'   },
  { key: 'sunday',    label: 'יום ראשון'  },
  { key: 'monday',    label: 'יום שני'    },
  { key: 'tuesday',   label: 'יום שלישי'  },
  { key: 'wednesday', label: 'יום רביעי'  },
  { key: 'thursday',  label: 'יום חמישי'  },
  { key: 'friday',    label: 'יום שישי'   },
]

// Map from day key → Hebrew label (used in the quick-move menu)
const DAY_LABEL: Record<string, string> = Object.fromEntries(
  DAYS.map((d) => [d.key, d.label])
)

const CATEGORY_DOT: Record<TaskCategory, string> = {
  halacha_and_prep:      'bg-purple-400',
  groom_gifts:           'bg-pink-400',
  trousseau_and_home:    'bg-emerald-400',
  bride_clothing:        'bg-rose-400',
  logistics_and_vendors: 'bg-amber-400',
  sheva_brachot:         'bg-indigo-400',
}

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  halacha_and_prep:      'הלכה והכנות',
  groom_gifts:           'מתנות לחתן',
  trousseau_and_home:    'נדוניה ובית',
  bride_clothing:        'ביגוד וטיפוח',
  logistics_and_vendors: 'לוגיסטיקה',
  sheva_brachot:         'שבע ברכות',
}

const PRIORITY_BORDER: Record<Priority, string> = {
  high:   'border-r-[3px] border-red-400',
  medium: 'border-r-[3px] border-amber-400',
  low:    'border-r-[3px] border-slate-200',
}

const PRIORITY_TEXT: Record<Priority, string> = {
  high:   'text-red-500',
  medium: 'text-amber-500',
  low:    'text-slate-400',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'גבוה', medium: 'בינוני', low: 'נמוך',
}

// ============================================================================
// LOCAL TYPES
// ============================================================================

type AssigneeFilter = 'all' | 'bride' | 'groom' | 'parents'
interface ToastState { id: number; message: string }

// ============================================================================
// TOAST
// ============================================================================

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div
      role="alert"
      className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-[100] flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium"
    >
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button onClick={onClose} aria-label="סגור" className="shrink-0 hover:opacity-70 transition-opacity">
        <X size={15} />
      </button>
    </div>
  )
}

// ============================================================================
// PLANNER CARD
// ============================================================================

interface PlannerCardProps {
  task: Task
  isDragging: boolean
  isPending: boolean
  isMenuOpen: boolean
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onToggle: () => void
  onMove: (targetDay: string) => void
  onMenuMouseDown: (e: React.MouseEvent) => void
  onMenuClick: () => void
}

function PlannerCard({
  task, isDragging, isPending, isMenuOpen,
  onDragStart, onDragEnd,
  onToggle, onMove,
  onMenuMouseDown, onMenuClick,
}: PlannerCardProps) {
  const isDone     = task.status === 'DONE'
  const pBorder    = PRIORITY_BORDER[task.priority]
  const pText      = PRIORITY_TEXT[task.priority]
  const dotCls     = CATEGORY_DOT[task.category]
  const catLabel   = CATEGORY_LABEL[task.category]

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative bg-white rounded-xl border ${pBorder} shadow-sm select-none
        cursor-grab active:cursor-grabbing transition-all duration-150
        ${isDragging
          ? 'opacity-40 scale-95 shadow-none'
          : 'opacity-100 hover:shadow-md hover:-translate-y-px'
        }`}
    >
      <div className="flex items-start gap-2 p-3">

        {/* Category dot */}
        <div
          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotCls}`}
          title={catLabel}
        />

        {/* Title + priority label */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium leading-snug break-words transition-all ${
              isDone ? 'line-through text-slate-400' : 'text-slate-700'
            }`}
          >
            {task.title}
          </p>
          <span className={`text-[10px] font-semibold mt-0.5 block ${pText}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        </div>

        {/* Actions column */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">

          {/* Status toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            disabled={isPending}
            aria-label={isDone ? 'סמן כלא הושלם' : 'סמן כהושלם'}
            className="text-slate-300 hover:text-violet-500 transition-colors disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 size={15} className="animate-spin text-violet-400" />
            ) : isDone ? (
              <CheckCircle2 size={15} className="text-violet-600" />
            ) : (
              <Circle size={15} />
            )}
          </button>

          {/* Quick-move menu */}
          <div className="relative">
            <button
              onMouseDown={onMenuMouseDown}
              onClick={(e) => { e.stopPropagation(); onMenuClick() }}
              aria-label="שבץ ליום"
              className="text-slate-300 hover:text-slate-600 transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>

            {isMenuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-50 min-w-[152px] py-1 overflow-hidden"
              >
                <p className="px-3 py-1.5 text-[10px] text-slate-400 font-semibold tracking-wider uppercase border-b border-slate-100">
                  שבץ ליום
                </p>
                {DAYS.map((day) => {
                  const isCurrent = task.assignedDay === day.key
                  return (
                    <button
                      key={day.key}
                      onClick={() => onMove(day.key)}
                      className={`w-full text-right px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                        isCurrent
                          ? 'bg-violet-50 text-violet-700 font-semibold'
                          : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
                      }`}
                    >
                      <span>{day.label}</span>
                      {isCurrent && <span className="text-violet-500 text-[10px]">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// DAY COLUMN
// ============================================================================

interface DayColumnProps {
  day: { key: string; label: string }
  tasks: Task[]
  draggedTaskId: string | null
  isDragOver: boolean
  pendingIds: Set<string>
  openMenuId: string | null
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onCardDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void
  onCardDragEnd: () => void
  onToggle: (task: Task) => void
  onMove: (taskId: string, targetDay: string) => void
  onMenuMouseDown: (e: React.MouseEvent) => void
  onMenuClick: (taskId: string) => void
}

function DayColumn({
  day, tasks, draggedTaskId, isDragOver, pendingIds, openMenuId,
  onDragOver, onDragLeave, onDrop,
  onCardDragStart, onCardDragEnd,
  onToggle, onMove,
  onMenuMouseDown, onMenuClick,
}: DayColumnProps) {
  const isBacklog = day.key === 'backlog'

  return (
    <div className="flex flex-col w-44 md:w-auto md:flex-1 shrink-0 min-h-0">

      {/* Column header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border-x border-t text-sm font-semibold ${
          isBacklog
            ? 'bg-slate-100 border-slate-300 text-slate-500'
            : 'bg-violet-600 border-violet-600 text-white'
        }`}
      >
        <span className="text-xs font-bold tracking-wide">{day.label}</span>
        <span
          className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold min-w-[18px] text-center ${
            isBacklog ? 'bg-slate-200 text-slate-500' : 'bg-white/25 text-white'
          }`}
        >
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex-1 flex flex-col gap-2 p-2 rounded-b-xl border-x border-b min-h-[200px] transition-all duration-150 ${
          isDragOver
            ? 'bg-violet-50 border-violet-400 border-dashed border-2'
            : isBacklog
            ? 'bg-slate-50/70 border-slate-200'
            : 'bg-white border-slate-200'
        }`}
      >
        {tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[80px]">
            <p className="text-xs text-slate-300 text-center leading-relaxed px-2">
              {isDragOver ? '⬇ שחרר כאן' : isBacklog ? 'לא משובצות' : 'ריק'}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <PlannerCard
              key={task.id}
              task={task}
              isDragging={draggedTaskId === task.id}
              isPending={pendingIds.has(task.id)}
              isMenuOpen={openMenuId === task.id}
              onDragStart={(e) => onCardDragStart(e, task.id)}
              onDragEnd={onCardDragEnd}
              onToggle={() => onToggle(task)}
              onMove={(targetDay) => onMove(task.id, targetDay)}
              onMenuMouseDown={onMenuMouseDown}
              onMenuClick={() => onMenuClick(task.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================================
// WEEKLY PLANNER — main component
// ============================================================================

export default function WeeklyPlanner({ initialTasks }: { initialTasks: Task[] }) {

  // ── Core state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]               = useState<Task[]>(initialTasks)
  const [draggedTaskId, setDraggedTask] = useState<string | null>(null)
  const [dragOverColumn, setDragOver]   = useState<string | null>(null)
  const [pendingIds, setPendingIds]     = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId]     = useState<string | null>(null)
  const [toast, setToast]               = useState<ToastState | null>(null)

  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all')
  const [showDone, setShowDone]             = useState(false)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Close open menu when clicking anywhere else ───────────────────────────
  useEffect(() => {
    if (!openMenuId) return
    function handleDocMouseDown() { setOpenMenuId(null) }
    document.addEventListener('mousedown', handleDocMouseDown)
    return () => document.removeEventListener('mousedown', handleDocMouseDown)
  }, [openMenuId])

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Pending helpers ───────────────────────────────────────────────────────
  function addPending(id: string) {
    setPendingIds((p) => new Set([...p, id]))
  }
  function removePending(id: string) {
    setPendingIds((p) => { const n = new Set(p); n.delete(id); return n })
  }

  // ── Move a task to a different day (drag-drop + quick-move) ──────────────
  async function moveTask(taskId: string, newDay: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.assignedDay === newDay || pendingIds.has(taskId)) return

    const prevDay = task.assignedDay

    addPending(taskId)
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignedDay: newDay } : t))
    )

    const result = await updateTask(taskId, { assignedDay: newDay })
    removePending(taskId)

    if (!result.success) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, assignedDay: prevDay } : t))
      )
      showToast(result.error)
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? result.data : t))
      )
    }
  }

  // ── Toggle task status ────────────────────────────────────────────────────
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

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
    // Defer opacity change so the drag ghost captures the normal card first
    setTimeout(() => setDraggedTask(taskId), 0)
  }

  function handleDragEnd() {
    setDraggedTask(null)
    setDragOver(null)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, dayKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== dayKey) setDragOver(dayKey)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear when leaving the column boundary, not when entering a child
    const related = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(related)) {
      setDragOver(null)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetDay: string) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    setDraggedTask(null)
    setDragOver(null)
    if (taskId) void moveTask(taskId, targetDay)
  }

  // ── Quick-move (menu) ─────────────────────────────────────────────────────

  function handleQuickMove(taskId: string, targetDay: string) {
    setOpenMenuId(null) // close menu immediately
    void moveTask(taskId, targetDay)
  }

  function handleMenuMouseDown(e: React.MouseEvent) {
    // Prevent the document mousedown listener from immediately closing the menu
    e.stopPropagation()
  }

  function handleMenuClick(taskId: string) {
    setOpenMenuId((prev) => (prev === taskId ? null : taskId))
  }

  // ── Filtered tasks per column ─────────────────────────────────────────────

  function getColumnTasks(dayKey: string): Task[] {
    return tasks
      .filter((t) => t.assignedDay === dayKey)
      .filter((t) => showDone || t.status !== 'DONE')
      .filter((t) => {
        if (assigneeFilter === 'all') return true
        if (assigneeFilter === 'parents')
          return t.assignedTo === 'parents_bride' || t.assignedTo === 'parents_groom'
        return t.assignedTo === (assigneeFilter as AssignedTo)
      })
      .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
  }

  const totalTasks = tasks.length
  const totalDone  = tasks.filter((t) => t.status === 'DONE').length
  const totalShown = DAYS.reduce((sum, d) => sum + getColumnTasks(d.key).length, 0)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col px-4 pt-6 pb-4 md:px-6 md:pt-8 h-full min-h-screen">

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">לו&quot;ז שבועי</h1>
        <p className="text-slate-500 text-sm mt-1">
          {totalDone} מתוך {totalTasks} משימות הושלמו
        </p>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center mb-5">

        {/* Assignee pills */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5">
          {(
            [
              ['all',     'כולם']  ,
              ['bride',   'כלה']   ,
              ['groom',   'חתן']   ,
              ['parents', 'הורים'] ,
            ] as [AssigneeFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setAssigneeFilter(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                assigneeFilter === val
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category select */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as TaskCategory | 'all')}
          className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-slate-600"
        >
          <option value="all">כל הקטגוריות</option>
          {(Object.entries(CATEGORY_LABEL) as [TaskCategory, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Show-done toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setShowDone((v) => !v)}
            role="switch"
            aria-checked={showDone}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
              showDone ? 'bg-violet-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                showDone ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
            הצג משימות שבוצעו
          </span>
        </label>

        {/* Visible count */}
        <span className="text-xs text-slate-400 ms-auto">
          {totalShown} משימות בתצוגה
        </span>
      </div>

      {/* ── Board (horizontal scroll) ─────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide flex-1 items-start">
        {DAYS.map((day) => (
          <DayColumn
            key={day.key}
            day={day}
            tasks={getColumnTasks(day.key)}
            draggedTaskId={draggedTaskId}
            isDragOver={dragOverColumn === day.key}
            pendingIds={pendingIds}
            openMenuId={openMenuId}
            onDragOver={(e) => handleDragOver(e, day.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, day.key)}
            onCardDragStart={handleDragStart}
            onCardDragEnd={handleDragEnd}
            onToggle={handleToggle}
            onMove={handleQuickMove}
            onMenuMouseDown={handleMenuMouseDown}
            onMenuClick={handleMenuClick}
          />
        ))}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-4 border-t border-slate-100">
        {(Object.entries(CATEGORY_DOT) as [TaskCategory, string][]).map(([cat, dotCls]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${dotCls}`} />
            <span className="text-xs text-slate-400">{CATEGORY_LABEL[cat]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
