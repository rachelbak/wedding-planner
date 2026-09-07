'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  CheckCircle2, Circle, Loader2, MoreHorizontal, X,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays,
} from 'lucide-react'
import { updateTask } from '@/app/actions/tasks'
import type { Task, Priority, AssignedTo, TaskStatus } from '@/domain/types'
import { WEDDING_DATE } from '@/config/wedding'
import {
  toDateStr, parseLocalDate, getWeekStart, getWeekDates, addWeeks,
  getDayOfWeek, isToday, getAllWeeks, getWeekLabel, weeksUntilWedding,
  buildCalendarMaps, type HolidayBadge,
} from '@/utils/hebrewCalendar'

// ============================================================================
// CONSTANTS
// ============================================================================

const DAY_LABELS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי']
const DAY_SHORT  = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']

const CATEGORY_DOT: Record<string, string> = {
  halacha_and_prep:      'bg-purple-400',
  groom_gifts:           'bg-pink-400',
  trousseau_and_home:    'bg-emerald-400',
  bride_clothing:        'bg-rose-400',
  logistics_and_vendors: 'bg-amber-400',
  sheva_brachot:         'bg-indigo-400',
}

const PRIORITY_BORDER: Record<Priority, string> = {
  high:   'border-r-[3px] border-red-400',
  medium: 'border-r-[3px] border-amber-400',
  low:    'border-r-[3px] border-slate-200',
}

const PRIORITY_TEXT: Record<Priority, string> = {
  high: 'text-red-500', medium: 'text-amber-500', low: 'text-slate-400',
}

const HOLIDAY_STYLE: Record<HolidayBadge['type'], string> = {
  major:         'bg-amber-100  text-amber-800  border-amber-200',
  erev:          'bg-yellow-50  text-yellow-700 border-yellow-200',
  'chol-hamoed': 'bg-orange-50  text-orange-600 border-orange-200',
  fast:          'bg-slate-100  text-slate-600  border-slate-200',
  minor:         'bg-blue-50    text-blue-600   border-blue-200',
  'rosh-chodesh':'bg-violet-50  text-violet-600 border-violet-200',
}

// ============================================================================
// LOCAL TYPES
// ============================================================================

type ViewMode     = 'week' | 'all'
type AssigneeFilter = 'all' | 'bride' | 'groom' | 'parents'
interface ToastState { id: number; message: string }
interface MoveOption  { key: string; label: string }

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
      <button onClick={onClose} aria-label="סגור" className="shrink-0 hover:opacity-70">
        <X size={15} />
      </button>
    </div>
  )
}

// ============================================================================
// HOLIDAY BADGE — rendered inside column headers
// ============================================================================

function HolidayChip({ badge }: { badge: HolidayBadge }) {
  return (
    <span
      className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full border leading-tight ${HOLIDAY_STYLE[badge.type]}`}
    >
      {badge.text}
    </span>
  )
}

// ============================================================================
// PLANNER CARD
// ============================================================================

interface PlannerCardProps {
  task:          Task
  isDragging:    boolean
  isPending:     boolean
  isMenuOpen:    boolean
  moveOptions:   MoveOption[]
  onDragStart:   (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd:     () => void
  onToggle:      () => void
  onMove:        (targetKey: string) => void
  onMenuMouseDown: (e: React.MouseEvent) => void
  onMenuClick:   () => void
}

function PlannerCard({
  task, isDragging, isPending, isMenuOpen, moveOptions,
  onDragStart, onDragEnd, onToggle, onMove, onMenuMouseDown, onMenuClick,
}: PlannerCardProps) {
  const isDone    = task.status === 'DONE'
  const pBorder   = PRIORITY_BORDER[task.priority]
  const pText     = PRIORITY_TEXT[task.priority]
  const dotCls    = CATEGORY_DOT[task.category] ?? 'bg-slate-400'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative bg-white rounded-xl border ${pBorder} shadow-sm select-none
        cursor-grab active:cursor-grabbing transition-all duration-150
        ${isDragging ? 'opacity-40 scale-95 shadow-none' : 'opacity-100 hover:shadow-md hover:-translate-y-px'}`}
    >
      <div className="flex items-start gap-2 p-3">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotCls}`} />

        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium leading-snug break-words ${
              isDone ? 'line-through text-slate-400' : 'text-slate-700'
            }`}
          >
            {task.title}
          </p>
          <p className={`text-[10px] mt-0.5 ${pText}`}>
            {task.priority === 'high' ? '● גבוה' : task.priority === 'medium' ? '● בינוני' : ''}
          </p>
        </div>

        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={isPending}
          aria-label={isDone ? 'בטל' : 'סמן כהושלם'}
          className="shrink-0 text-slate-300 hover:text-violet-500 transition-colors disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin text-violet-400" />
          ) : isDone ? (
            <CheckCircle2 size={14} className="text-violet-500" />
          ) : (
            <Circle size={14} />
          )}
        </button>

        {/* Quick-move menu */}
        <div className="relative shrink-0">
          <button
            onMouseDown={onMenuMouseDown}
            onClick={onMenuClick}
            aria-label="העבר ליום אחר"
            className="p-0.5 text-slate-300 hover:text-slate-600 transition-colors rounded"
          >
            <MoreHorizontal size={14} />
          </button>

          {isMenuOpen && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute left-0 top-6 z-30 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]"
            >
              {moveOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { onMove(opt.key) }}
                  className="w-full text-right px-3 py-2 text-xs text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// DAY COLUMN HEADER
// ============================================================================

function DayColumnHeader({
  label,
  shortLabel,
  hebrewDate,
  holiday,
  isToday: today,
  dateStr,
  taskCount,
}: {
  label:      string
  shortLabel: string
  hebrewDate: string
  holiday:    HolidayBadge | undefined
  isToday:    boolean
  dateStr:    string   // YYYY-MM-DD, or 'backlog'
  taskCount:  number
}) {
  const isBacklog = dateStr === 'backlog'
  // Format Gregorian date as "6 ספטמבר"
  const gregLabel = isBacklog ? '' : (() => {
    const d = parseLocalDate(dateStr)
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
  })()

  return (
    <div className={`pb-2 mb-2 border-b border-slate-100 ${today ? 'border-violet-200' : ''}`}>
      <div className="flex items-center gap-2">
        <p
          className={`text-xs font-bold leading-none ${
            today ? 'text-violet-700' : 'text-slate-700'
          }`}
        >
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </p>
        {today && (
          <span className="text-[9px] font-semibold bg-violet-600 text-white rounded-full px-1.5 py-0.5">
            היום
          </span>
        )}
        {taskCount > 0 && (
          <span className="ms-auto text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
            {taskCount}
          </span>
        )}
      </div>
      {!isBacklog && (
        <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
          {hebrewDate}
          {gregLabel && <span className="text-[9px] opacity-60 ms-1.5">· {gregLabel}</span>}
        </p>
      )}
      {holiday && (
        <div className="mt-1">
          <HolidayChip badge={holiday} />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// DAY COLUMN
// ============================================================================

interface DayColumnProps {
  dateKey:      string          // 'backlog' or 'YYYY-MM-DD'
  dayIndex?:    number          // 0=Sun…5=Fri, undefined for backlog
  tasks:        Task[]
  isDropTarget: boolean
  hebrewDate:   string
  holiday:      HolidayBadge | undefined
  draggedId:    string | null
  pendingIds:   Set<string>
  openMenuId:   string | null
  moveOptions:  MoveOption[]
  onDragOver:   (e: React.DragEvent) => void
  onDragLeave:  (e: React.DragEvent) => void
  onDrop:       (e: React.DragEvent) => void
  onDragStart:  (e: React.DragEvent<HTMLDivElement>, id: string) => void
  onDragEnd:    () => void
  onToggle:     (task: Task) => void
  onMove:       (taskId: string, targetKey: string) => void
  onMenuToggle: (id: string) => void
  onMenuMD:     (e: React.MouseEvent, id: string) => void
}

function DayColumn({
  dateKey, dayIndex, tasks, isDropTarget,
  hebrewDate, holiday, draggedId, pendingIds,
  openMenuId, moveOptions,
  onDragOver, onDragLeave, onDrop,
  onDragStart, onDragEnd, onToggle, onMove, onMenuToggle, onMenuMD,
}: DayColumnProps) {
  const isBacklog = dateKey === 'backlog'
  const label      = isBacklog ? 'טרם שובץ'   : (DAY_LABELS[dayIndex!]  ?? '')
  const shortLabel = isBacklog ? 'בלוג'       : (DAY_SHORT[dayIndex!]   ?? '')
  const today      = !isBacklog && isToday(parseLocalDate(dateKey))

  return (
    <div
      className={`flex flex-col min-w-[140px] sm:min-w-0 sm:flex-1 rounded-2xl border-2 transition-colors duration-150 p-3 ${
        isDropTarget
          ? 'border-violet-400 bg-violet-50/60'
          : 'border-transparent bg-slate-50/60'
      } ${today ? 'bg-violet-50/30' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <DayColumnHeader
        label={label}
        shortLabel={shortLabel}
        hebrewDate={hebrewDate}
        holiday={holiday}
        isToday={today}
        dateStr={dateKey}
        taskCount={tasks.length}
      />

      <div className="flex-1 space-y-2 min-h-[60px]">
        {tasks.map((task) => (
          <PlannerCard
            key={task.id}
            task={task}
            isDragging={draggedId === task.id}
            isPending={pendingIds.has(task.id)}
            isMenuOpen={openMenuId === task.id}
            moveOptions={moveOptions.filter((o) => o.key !== dateKey)}
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            onToggle={() => onToggle(task)}
            onMove={(targetKey) => onMove(task.id, targetKey)}
            onMenuMouseDown={(e) => onMenuMD(e, task.id)}
            onMenuClick={() => onMenuToggle(task.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// WEEK GRID — renders backlog + 6 day columns for one week
// ============================================================================

interface WeekGridProps {
  weekDates:    Date[]           // 6 Date objects (Sun–Fri)
  tasksByKey:   Map<string, Task[]>
  hebrewDates:  Map<string, string>
  holidays:     Map<string, HolidayBadge>
  dragOverKey:  string | null
  draggedId:    string | null
  pendingIds:   Set<string>
  openMenuId:   string | null
  moveOptions:  MoveOption[]
  showBacklog:  boolean
  onDragOver:   (e: React.DragEvent, key: string) => void
  onDragLeave:  (e: React.DragEvent) => void
  onDrop:       (e: React.DragEvent, key: string) => void
  onDragStart:  (e: React.DragEvent<HTMLDivElement>, id: string) => void
  onDragEnd:    () => void
  onToggle:     (task: Task) => void
  onMove:       (taskId: string, targetKey: string) => void
  onMenuToggle: (id: string) => void
  onMenuMD:     (e: React.MouseEvent, id: string) => void
}

function WeekGrid({
  weekDates, tasksByKey, hebrewDates, holidays,
  dragOverKey, draggedId, pendingIds, openMenuId, moveOptions,
  showBacklog,
  onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd,
  onToggle, onMove, onMenuToggle, onMenuMD,
}: WeekGridProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {showBacklog && (
        <DayColumn
          dateKey="backlog"
          tasks={tasksByKey.get('backlog') ?? []}
          isDropTarget={dragOverKey === 'backlog'}
          hebrewDate=""
          holiday={undefined}
          draggedId={draggedId}
          pendingIds={pendingIds}
          openMenuId={openMenuId}
          moveOptions={moveOptions}
          onDragOver={(e) => onDragOver(e, 'backlog')}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, 'backlog')}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onToggle={onToggle}
          onMove={onMove}
          onMenuToggle={onMenuToggle}
          onMenuMD={onMenuMD}
        />
      )}

      {weekDates.map((date, idx) => {
        const key = toDateStr(date)
        return (
          <DayColumn
            key={key}
            dateKey={key}
            dayIndex={idx}
            tasks={tasksByKey.get(key) ?? []}
            isDropTarget={dragOverKey === key}
            hebrewDate={hebrewDates.get(key) ?? ''}
            holiday={holidays.get(key)}
            draggedId={draggedId}
            pendingIds={pendingIds}
            openMenuId={openMenuId}
            moveOptions={moveOptions}
            onDragOver={(e) => onDragOver(e, key)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, key)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onToggle={onToggle}
            onMove={onMove}
            onMenuToggle={onMenuToggle}
            onMenuMD={onMenuMD}
          />
        )
      })}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const HEBREW_MONTHS_LONG: Record<number, string> = {
  0: 'ינואר', 1: 'פברואר', 2: 'מרץ', 3: 'אפריל', 4: 'מאי', 5: 'יוני',
  6: 'יולי', 7: 'אוגוסט', 8: 'ספטמבר', 9: 'אוקטובר', 10: 'נובמבר', 11: 'דצמבר',
}

export default function WeeklyPlanner({ initialTasks }: { initialTasks: Task[] }) {
  const weddingDate = useMemo(() => parseLocalDate(WEDDING_DATE), [])

  // ── Core state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]           = useState<Task[]>(initialTasks)
  const [viewMode, setViewMode]     = useState<ViewMode>('week')
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    () => new Set([toDateStr(getWeekStart(new Date()))]),
  )

  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [showDone, setShowDone]             = useState(false)

  // DnD
  const [draggedId, setDraggedId]   = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  // UI
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [toast, setToast]           = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Calendar maps (computed once) ─────────────────────────────────────────
  const { hebrewDates, holidays } = useMemo(() => {
    const from = addWeeks(getWeekStart(new Date()), -8)   // buffer before today
    const to   = addWeeks(weddingDate, 2)                  // buffer after wedding
    return buildCalendarMaps(from, to)
  }, [weddingDate])

  // ── All weeks list ────────────────────────────────────────────────────────
  const allWeeks = useMemo(() => getAllWeeks(new Date(), weddingDate), [weddingDate])

  // ── Filtered + keyed tasks ────────────────────────────────────────────────
  const visibleTasks = useMemo(() =>
    tasks
      .filter((t) => showDone || t.status !== 'DONE')
      .filter((t) => {
        if (assigneeFilter === 'all') return true
        if (assigneeFilter === 'parents')
          return t.assignedTo === 'parents_bride' || t.assignedTo === 'parents_groom'
        return t.assignedTo === (assigneeFilter as AssignedTo)
      }),
  [tasks, showDone, assigneeFilter])

  const tasksByKey = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of visibleTasks) {
      const key = task.dueDate ?? 'backlog'
      const arr = map.get(key) ?? []
      arr.push(task)
      map.set(key, arr)
    }
    return map
  }, [visibleTasks])

  // ── Week dates for current-week view ──────────────────────────────────────
  const currentWeekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart])

  // ── Move options for quick-move menu ──────────────────────────────────────
  const moveOptions: MoveOption[] = useMemo(() => {
    const weekDates = viewMode === 'week' ? currentWeekDates : getWeekDates(getWeekStart(new Date()))
    return [
      { key: 'backlog', label: 'טרם שובץ (בלוג)' },
      ...weekDates.map((d, i) => ({
        key:   toDateStr(d),
        label: `${DAY_SHORT[i] ?? ''} · ${hebrewDates.get(toDateStr(d)) ?? ''}`,
      })),
    ]
  }, [viewMode, currentWeekDates, hebrewDates])

  // ── Close open menu on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Move task ─────────────────────────────────────────────────────────────
  async function moveTask(taskId: string, targetKey: string) {
    if (pendingIds.has(taskId)) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const isBacklog = targetKey === 'backlog'
    const updates = {
      dueDate:    isBacklog ? null : targetKey,
      assignedDay: isBacklog ? 'backlog' : getDayOfWeek(parseLocalDate(targetKey)),
    } as Partial<Task> & { dueDate?: string | null }

    const prevTasks = tasks
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, dueDate: isBacklog ? undefined : targetKey, assignedDay: updates.assignedDay! } : t,
      ),
    )
    setPendingIds((prev) => new Set([...prev, taskId]))
    setOpenMenuId(null)

    const result = await updateTask(taskId, updates)
    setPendingIds((prev) => { const n = new Set(prev); n.delete(taskId); return n })
    if (!result.success) {
      setTasks(prevTasks)
      showToast(`שגיאה בהזזת המשימה: ${result.error}`)
    }
  }

  // ── Toggle done ───────────────────────────────────────────────────────────
  async function handleToggle(task: Task) {
    if (pendingIds.has(task.id)) return
    const newStatus: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    setPendingIds((prev) => new Set([...prev, task.id]))
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))
    const result = await updateTask(task.id, { status: newStatus })
    setPendingIds((prev) => { const n = new Set(prev); n.delete(task.id); return n })
    if (!result.success) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
      showToast(result.error)
    }
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, taskId: string) {
    e.dataTransfer.setData('taskId', taskId)
    setTimeout(() => setDraggedId(taskId), 0)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverKey(null)
  }

  function handleDragOver(e: React.DragEvent, key: string) {
    e.preventDefault()
    setDragOverKey(key)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(null)
  }

  function handleDrop(e: React.DragEvent, key: string) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) void moveTask(taskId, key)
    setDraggedId(null)
    setDragOverKey(null)
  }

  // ── Menu handlers ─────────────────────────────────────────────────────────
  function handleMenuToggle(id: string) {
    setOpenMenuId((prev) => (prev === id ? null : id))
  }

  function handleMenuMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setOpenMenuId((prev) => (prev === id ? null : id))
  }

  // ── Shared column props ───────────────────────────────────────────────────
  const sharedColProps = {
    hebrewDates, holidays, dragOverKey, draggedId, pendingIds,
    openMenuId, moveOptions,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onToggle: handleToggle,
    onMove: moveTask,
    onMenuToggle: handleMenuToggle,
    onMenuMD: handleMenuMouseDown,
  }

  // ── Week header for navigation ────────────────────────────────────────────
  function weekRangeLabel(weekStart: Date): string {
    const dates = getWeekDates(weekStart)
    const first = dates[0]!
    const last  = dates[5]!
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()}–${last.getDate()} ${HEBREW_MONTHS_LONG[first.getMonth()] ?? ''} ${first.getFullYear()}`
    }
    return `${first.getDate()} ${HEBREW_MONTHS_LONG[first.getMonth()] ?? ''}–${last.getDate()} ${HEBREW_MONTHS_LONG[last.getMonth()] ?? ''}`
  }

  const n = weeksUntilWedding(currentWeekStart, weddingDate)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">לוח תכנון שבועי</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            גרור משימות לתאריכים · לחץ ✓ לסיום
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1 self-start">
          {(['week', 'all'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === mode
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <CalendarDays size={13} />
              {mode === 'week' ? 'שבוע נוכחי' : 'כל השבועות'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Assignee filter */}
        {(['all', 'bride', 'groom', 'parents'] as AssigneeFilter[]).map((v) => {
          const labels: Record<AssigneeFilter, string> = {
            all: 'כולם', bride: 'כלה', groom: 'חתן', parents: 'הורים',
          }
          return (
            <button
              key={v}
              onClick={() => setAssigneeFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                assigneeFilter === v
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-300'
              }`}
            >
              {labels[v]}
            </button>
          )
        })}

        {/* Show done toggle */}
        <label className="flex items-center gap-2 ms-auto cursor-pointer select-none">
          <span className="text-xs text-slate-500">הצג הושלמו</span>
          <div
            onClick={() => setShowDone((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${showDone ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                showDone ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
        </label>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          VIEW: CURRENT WEEK
      ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'week' && (
        <div>
          {/* Week navigation header */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setCurrentWeekStart((ws) => addWeeks(ws, -1))}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:border-violet-300 text-slate-500 hover:text-violet-700 transition-colors"
              aria-label="שבוע קודם"
            >
              <ChevronRight size={16} />
            </button>

            <div className="flex-1 text-center">
              <p className="text-sm font-bold text-slate-800">
                {getWeekLabel(currentWeekStart, weddingDate)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {weekRangeLabel(currentWeekStart)}
              </p>
            </div>

            <button
              onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
              title="חזור לשבוע הנוכחי"
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                n === 0
                  ? 'border-violet-400 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-violet-300'
              }`}
            >
              השבוע
            </button>

            <button
              onClick={() => setCurrentWeekStart((ws) => addWeeks(ws, 1))}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:border-violet-300 text-slate-500 hover:text-violet-700 transition-colors"
              aria-label="שבוע הבא"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <WeekGrid
            weekDates={currentWeekDates}
            tasksByKey={tasksByKey}
            showBacklog={true}
            {...sharedColProps}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VIEW: ALL WEEKS
      ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'all' && (
        <div className="space-y-3">
          {/* Backlog — always at top in all-weeks view */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-700 mb-3">📥 טרם שובץ</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <DayColumn
                dateKey="backlog"
                tasks={tasksByKey.get('backlog') ?? []}
                isDropTarget={dragOverKey === 'backlog'}
                hebrewDate=""
                holiday={undefined}
                draggedId={draggedId}
                pendingIds={pendingIds}
                openMenuId={openMenuId}
                moveOptions={moveOptions}
                onDragOver={(e) => handleDragOver(e, 'backlog')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'backlog')}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onToggle={handleToggle}
                onMove={moveTask}
                onMenuToggle={handleMenuToggle}
                onMenuMD={handleMenuMouseDown}
              />
            </div>
          </div>

          {/* Week accordion */}
          {allWeeks.map((weekStart) => {
            const key       = toDateStr(weekStart)
            const weekDates = getWeekDates(weekStart)
            const isOpen    = expandedWeeks.has(key)
            const wLabel    = getWeekLabel(weekStart, weddingDate)
            const isWedding = wLabel.includes('💍')

            // Count tasks in this week
            const weekTaskCount = weekDates.reduce(
              (sum, d) => sum + (tasksByKey.get(toDateStr(d))?.length ?? 0),
              0,
            )

            return (
              <div
                key={key}
                className={`rounded-2xl border shadow-sm overflow-hidden ${
                  isWedding
                    ? 'border-violet-400 bg-violet-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* Accordion header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-right hover:bg-slate-50/60 transition-colors"
                  onClick={() =>
                    setExpandedWeeks((prev) => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isWedding ? 'text-violet-700' : 'text-slate-800'}`}>
                      {wLabel}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {weekRangeLabel(weekStart)}
                    </p>
                  </div>

                  {weekTaskCount > 0 && (
                    <span className="text-xs font-semibold text-violet-600 bg-violet-100 rounded-full px-2 py-0.5">
                      {weekTaskCount} משימות
                    </span>
                  )}

                  {isOpen ? (
                    <ChevronUp size={16} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400 shrink-0" />
                  )}
                </button>

                {/* Expanded week grid */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    <div className="mt-3">
                      <WeekGrid
                        weekDates={weekDates}
                        tasksByKey={tasksByKey}
                        showBacklog={false}
                        {...sharedColProps}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Category legend ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-6 pt-4 border-t border-slate-100">
        {Object.entries(CATEGORY_DOT).map(([cat, dotCls]) => {
          const LABELS: Record<string, string> = {
            halacha_and_prep:      'הלכה והכנות',
            groom_gifts:           'מתנות לחתן',
            trousseau_and_home:    'נדוניה ובית',
            bride_clothing:        'ביגוד וטיפוח',
            logistics_and_vendors: 'לוגיסטיקה',
            sheva_brachot:         'שבע ברכות',
          }
          return (
            <div key={cat} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${dotCls}`} />
              <span className="text-xs text-slate-400">{LABELS[cat] ?? cat}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
