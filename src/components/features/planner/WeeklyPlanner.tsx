'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  CheckCircle2, Circle, Loader2, MoreHorizontal, X,
  ChevronLeft, ChevronRight, CalendarDays, Inbox, Mail,
} from 'lucide-react'
import { updateTask } from '@/app/actions/tasks'
import type { Task, Category, Priority, AssignedTo, TaskStatus } from '@/domain/types'
import { WEDDING_DATE } from '@/config/wedding'
import {
  toDateStr, parseLocalDate, getWeekStart, getWeekDates, addWeeks,
  getDayOfWeek, isToday, getAllWeeks, getWeekLabel, weeksUntilWedding,
  buildCalendarMaps, type HolidayBadge,
} from '@/utils/hebrewCalendar'
import EditTaskModal from '@/components/features/checklist/EditTaskModal'
import EmailModal from '@/components/ui/EmailModal'

// ============================================================================
// CONSTANTS
// ============================================================================

const DAY_LABELS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי']
const DAY_SHORT  = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']

const DOT_PALETTE = [
  'bg-purple-400', 'bg-pink-400',   'bg-emerald-400', 'bg-rose-400',
  'bg-amber-400',  'bg-indigo-400', 'bg-sky-400',     'bg-teal-400',
  'bg-orange-400', 'bg-cyan-400',
]

const PRIORITY_BORDER: Record<Priority, string> = {
  high:   'border-r-[3px] border-red-400',
  medium: 'border-r-[3px] border-amber-400',
  low:    'border-r-[3px] border-slate-200',
}

const PRIORITY_TEXT: Record<Priority, string> = {
  high: 'text-red-500', medium: 'text-amber-500', low: 'text-slate-400',
}

const HOLIDAY_STYLE: Record<HolidayBadge['type'], string> = {
  major:          'bg-amber-100  text-amber-800  border-amber-200',
  erev:           'bg-yellow-50  text-yellow-700 border-yellow-200',
  'chol-hamoed':  'bg-orange-50  text-orange-600 border-orange-200',
  fast:           'bg-slate-100  text-slate-600  border-slate-200',
  minor:          'bg-blue-50    text-blue-600   border-blue-200',
  'rosh-chodesh': 'bg-violet-50  text-violet-600 border-violet-200',
}

const HEBREW_MONTHS_LONG: Record<number, string> = {
  0: 'ינואר', 1: 'פברואר', 2: 'מרץ', 3: 'אפריל', 4: 'מאי', 5: 'יוני',
  6: 'יולי', 7: 'אוגוסט', 8: 'ספטמבר', 9: 'אוקטובר', 10: 'נובמבר', 11: 'דצמבר',
}

// ============================================================================
// LOCAL TYPES
// ============================================================================

type ViewMode       = 'week' | 'all'
type AssigneeFilter = 'all' | 'bride' | 'groom' | 'parents'
interface ToastState { id: number; message: string }
interface MoveOption  { key: string; label: string }

// ============================================================================
// HELPERS
// ============================================================================

function getCategoryDot(slug: string, categories: Category[]): string {
  const idx = categories.findIndex((c) => c.slug === slug)
  if (idx >= 0) return DOT_PALETTE[idx % DOT_PALETTE.length] ?? 'bg-slate-400'
  return 'bg-slate-400'
}

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
// HOLIDAY BADGE
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
  task:            Task
  dotCls:          string
  isDragging:      boolean
  isPending:       boolean
  isMenuOpen:      boolean
  moveOptions:     MoveOption[]
  onDragStart:     (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd:       () => void
  onToggle:        () => void
  onMove:          (targetKey: string) => void
  onMenuMouseDown: (e: React.MouseEvent) => void
  onMenuClick:     () => void
  onEdit:          () => void
}

function PlannerCard({
  task, dotCls, isDragging, isPending, isMenuOpen, moveOptions,
  onDragStart, onDragEnd, onToggle, onMove, onMenuMouseDown, onMenuClick, onEdit,
}: PlannerCardProps) {
  const isDone  = task.status === 'DONE'
  const pBorder = PRIORITY_BORDER[task.priority]
  const pText   = PRIORITY_TEXT[task.priority]

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={`relative bg-white rounded-xl border ${pBorder} shadow-sm select-none cursor-pointer transition-all duration-150 ${
        isDragging ? 'opacity-40 scale-95 shadow-none' : 'opacity-100 hover:shadow-md hover:-translate-y-px'
      }`}
    >
      <div className="flex items-start gap-2 p-3">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotCls}`} />

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium leading-snug break-words ${isDone ? 'line-through text-slate-400' : 'text-slate-700'}`}>
            {task.title}
          </p>
          <p className={`text-[10px] mt-0.5 ${pText}`}>
            {task.priority === 'high' ? '● גבוה' : task.priority === 'medium' ? '● בינוני' : ''}
          </p>
        </div>

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          disabled={isPending}
          aria-label={isDone ? 'בטל' : 'סמן כהושלם'}
          className="shrink-0 text-slate-300 hover:text-violet-500 transition-colors disabled:opacity-40"
        >
          {isPending
            ? <Loader2 size={14} className="animate-spin text-violet-400" />
            : isDone
              ? <CheckCircle2 size={14} className="text-violet-500" />
              : <Circle size={14} />
          }
        </button>

        {/* Quick-move menu */}
        <div className="relative shrink-0">
          <button
            onMouseDown={(e) => { e.stopPropagation(); onMenuMouseDown(e) }}
            onClick={(e) => { e.stopPropagation(); onMenuClick() }}
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
                  onClick={(e) => { e.stopPropagation(); onMove(opt.key) }}
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
// BACKLOG SIDEBAR PANEL
// — dedicated drop-zone for unassigned tasks; stays sticky while weeks scroll
// ============================================================================

interface BacklogSidebarProps {
  tasks:        Task[]
  categories:   Category[]
  isDropTarget: boolean
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
  onEdit:       (task: Task) => void
}

function BacklogSidebar({
  tasks, categories, isDropTarget,
  draggedId, pendingIds, openMenuId, moveOptions,
  onDragOver, onDragLeave, onDrop,
  onDragStart, onDragEnd, onToggle, onMove, onMenuToggle, onMenuMD, onEdit,
}: BacklogSidebarProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]">
      {/* Fixed header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Inbox size={14} className="text-slate-400" />
        <span className="text-sm font-bold text-slate-700">טרם שובץ</span>
        {tasks.length > 0 && (
          <span className="ms-auto text-xs font-semibold text-violet-600 bg-violet-100 rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {tasks.length}
          </span>
        )}
      </div>

      {/* Scrollable drop zone */}
      <div
        className={`flex-1 overflow-y-auto p-3 min-h-[100px] transition-colors duration-150 ${
          isDropTarget ? 'bg-violet-50/50' : ''
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {tasks.length === 0 ? (
          <div
            className={`flex items-center justify-center min-h-[80px] rounded-xl border-2 border-dashed transition-colors ${
              isDropTarget ? 'border-violet-400 bg-violet-50' : 'border-slate-200'
            }`}
          >
            <p className="text-xs text-slate-400">גרור משימות לכאן</p>
          </div>
        ) : (
          <div
            className={`space-y-2 rounded-xl p-2 transition-colors ${
              isDropTarget ? 'ring-2 ring-violet-400 ring-offset-1 bg-violet-50/40' : ''
            }`}
          >
            {tasks.map((task) => (
              <PlannerCard
                key={task.id}
                task={task}
                dotCls={getCategoryDot(task.category, categories)}
                isDragging={draggedId === task.id}
                isPending={pendingIds.has(task.id)}
                isMenuOpen={openMenuId === task.id}
                moveOptions={moveOptions.filter((o) => o.key !== 'backlog')}
                onDragStart={(e) => onDragStart(e, task.id)}
                onDragEnd={onDragEnd}
                onToggle={() => onToggle(task)}
                onMove={(targetKey) => onMove(task.id, targetKey)}
                onMenuMouseDown={(e) => onMenuMD(e, task.id)}
                onMenuClick={() => onMenuToggle(task.id)}
                onEdit={() => onEdit(task)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// DAY COLUMN HEADER
// ============================================================================

function DayColumnHeader({
  label, shortLabel, hebrewDate, holiday, isToday: today, dateStr, taskCount,
}: {
  label:      string
  shortLabel: string
  hebrewDate: string
  holiday:    HolidayBadge | undefined
  isToday:    boolean
  dateStr:    string
  taskCount:  number
}) {
  const isBacklog = dateStr === 'backlog'
  const gregLabel = isBacklog ? '' : (() => {
    const d = parseLocalDate(dateStr)
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
  })()

  return (
    <div className={`pb-2 mb-2 border-b border-slate-100 ${today ? 'border-violet-200' : ''}`}>
      <div className="flex items-center gap-2">
        <p className={`text-xs font-bold leading-none ${today ? 'text-violet-700' : 'text-slate-700'}`}>
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
      {holiday && <div className="mt-1"><HolidayChip badge={holiday} /></div>}
    </div>
  )
}

// ============================================================================
// DAY COLUMN  (Sun–Fri only; backlog lives in the sidebar)
// ============================================================================

interface DayColumnProps {
  dateKey:      string           // YYYY-MM-DD
  dayIndex:     number           // 0=Sun … 5=Fri
  tasks:        Task[]
  categories:   Category[]
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
  onEdit:       (task: Task) => void
}

function DayColumn({
  dateKey, dayIndex, tasks, categories, isDropTarget,
  hebrewDate, holiday, draggedId, pendingIds,
  openMenuId, moveOptions,
  onDragOver, onDragLeave, onDrop,
  onDragStart, onDragEnd, onToggle, onMove, onMenuToggle, onMenuMD, onEdit,
}: DayColumnProps) {
  const today = isToday(parseLocalDate(dateKey))

  return (
    <div
      className={`flex flex-col min-w-[120px] flex-1 rounded-2xl border-2 transition-colors duration-150 p-3 ${
        isDropTarget
          ? 'border-violet-400 bg-violet-50/60'
          : 'border-transparent bg-slate-50/60'
      } ${today ? 'bg-violet-50/30' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <DayColumnHeader
        label={DAY_LABELS[dayIndex] ?? ''}
        shortLabel={DAY_SHORT[dayIndex] ?? ''}
        hebrewDate={hebrewDate}
        holiday={holiday}
        isToday={today}
        dateStr={dateKey}
        taskCount={tasks.length}
      />

      <div className="flex-1 space-y-2 min-h-[48px]">
        {tasks.map((task) => (
          <PlannerCard
            key={task.id}
            task={task}
            dotCls={getCategoryDot(task.category, categories)}
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
            onEdit={() => onEdit(task)}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// WEEK GRID  (6 day columns, Sun–Fri; backlog is always in the sidebar)
// ============================================================================

interface WeekGridProps {
  weekDates:    Date[]
  tasksByKey:   Map<string, Task[]>
  categories:   Category[]
  hebrewDates:  Map<string, string>
  holidays:     Map<string, HolidayBadge>
  dragOverKey:  string | null
  draggedId:    string | null
  pendingIds:   Set<string>
  openMenuId:   string | null
  moveOptions:  MoveOption[]
  onDragOver:   (e: React.DragEvent, key: string) => void
  onDragLeave:  (e: React.DragEvent) => void
  onDrop:       (e: React.DragEvent, key: string) => void
  onDragStart:  (e: React.DragEvent<HTMLDivElement>, id: string) => void
  onDragEnd:    () => void
  onToggle:     (task: Task) => void
  onMove:       (taskId: string, targetKey: string) => void
  onMenuToggle: (id: string) => void
  onMenuMD:     (e: React.MouseEvent, id: string) => void
  onEdit:       (task: Task) => void
}

function WeekGrid({
  weekDates, tasksByKey, categories, hebrewDates, holidays,
  dragOverKey, draggedId, pendingIds, openMenuId, moveOptions,
  onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd,
  onToggle, onMove, onMenuToggle, onMenuMD, onEdit,
}: WeekGridProps) {
  const colProps = {
    categories, draggedId, pendingIds, openMenuId, moveOptions,
    onDragStart, onDragEnd, onToggle, onMove, onMenuToggle, onMenuMD, onEdit,
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
            onDragOver={(e) => onDragOver(e, key)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, key)}
            {...colProps}
          />
        )
      })}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WeeklyPlanner({
  initialTasks,
  initialCategories,
}: {
  initialTasks:      Task[]
  initialCategories: Category[]
}) {
  const weddingDate = useMemo(() => parseLocalDate(WEDDING_DATE), [])

  // ── Core state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]       = useState<Task[]>(initialTasks)
  const [categories]            = useState<Category[]>(initialCategories)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [showDone, setShowDone]             = useState(false)

  // DnD
  const [draggedId, setDraggedId]     = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  // UI
  const [pendingIds, setPendingIds]   = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId]   = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [emailOpen, setEmailOpen]     = useState(false)
  const [toast, setToast]             = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Calendar maps ─────────────────────────────────────────────────────────
  const { hebrewDates, holidays } = useMemo(() => {
    const from = addWeeks(getWeekStart(new Date()), -8)
    const to   = addWeeks(weddingDate, 2)
    return buildCalendarMaps(from, to)
  }, [weddingDate])

  // ── All weeks list ────────────────────────────────────────────────────────
  const allWeeks = useMemo(() => getAllWeeks(new Date(), weddingDate), [weddingDate])

  // ── Filtered + keyed tasks ────────────────────────────────────────────────
  const visibleTasks = useMemo(() =>
    tasks
      .filter((t) => showDone || t.status !== 'DONE')
      .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
      .filter((t) => {
        if (assigneeFilter === 'all') return true
        if (assigneeFilter === 'parents')
          return t.assignedTo === 'parents_bride' || t.assignedTo === 'parents_groom'
        return t.assignedTo === (assigneeFilter as AssignedTo)
      }),
  [tasks, showDone, categoryFilter, assigneeFilter])

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

  // ── Current week dates ────────────────────────────────────────────────────
  const currentWeekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart])

  // ── Move options for quick-move menu ──────────────────────────────────────
  const moveOptions: MoveOption[] = useMemo(() => {
    const wd = viewMode === 'week' ? currentWeekDates : getWeekDates(getWeekStart(new Date()))
    return [
      { key: 'backlog', label: 'טרם שובץ (בלוג)' },
      ...wd.map((d, i) => ({
        key:   toDateStr(d),
        label: `${DAY_SHORT[i] ?? ''} · ${hebrewDates.get(toDateStr(d)) ?? ''}`,
      })),
    ]
  }, [viewMode, currentWeekDates, hebrewDates])

  // ── Close menu on outside click ───────────────────────────────────────────
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

  // ── Move task (DnD + quick-move menu) ─────────────────────────────────────
  async function moveTask(taskId: string, targetKey: string) {
    if (pendingIds.has(taskId)) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const isBacklog = targetKey === 'backlog'
    const updates = {
      dueDate:     isBacklog ? null : targetKey,
      assignedDay: isBacklog ? 'backlog' : getDayOfWeek(parseLocalDate(targetKey)),
    } as Partial<Task> & { dueDate?: string | null }

    const prevTasks = tasks
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, dueDate: isBacklog ? undefined : targetKey, assignedDay: updates.assignedDay! }
          : t,
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

  // ── Save edit ─────────────────────────────────────────────────────────────
  function handleSaveEdit(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
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

  // ── Shared props bundle passed to WeekGrid ────────────────────────────────
  const sharedGridProps = {
    categories,
    hebrewDates,
    holidays,
    dragOverKey,
    draggedId,
    pendingIds,
    openMenuId,
    moveOptions,
    onDragOver:   handleDragOver,
    onDragLeave:  handleDragLeave,
    onDrop:       handleDrop,
    onDragStart:  handleDragStart,
    onDragEnd:    handleDragEnd,
    onToggle:     handleToggle,
    onMove:       moveTask,
    onMenuToggle: handleMenuToggle,
    onMenuMD:     handleMenuMouseDown,
    onEdit:       (task: Task) => setEditingTask(task),
  }

  // ── Shared props for the BacklogSidebar ───────────────────────────────────
  const backlogProps = {
    tasks:        tasksByKey.get('backlog') ?? [],
    categories,
    isDropTarget: dragOverKey === 'backlog',
    draggedId,
    pendingIds,
    openMenuId,
    moveOptions,
    onDragOver:   (e: React.DragEvent) => handleDragOver(e, 'backlog'),
    onDragLeave:  handleDragLeave,
    onDrop:       (e: React.DragEvent) => handleDrop(e, 'backlog'),
    onDragStart:  handleDragStart,
    onDragEnd:    handleDragEnd,
    onToggle:     handleToggle,
    onMove:       moveTask,
    onMenuToggle: handleMenuToggle,
    onMenuMD:     handleMenuMouseDown,
    onEdit:       (task: Task) => setEditingTask(task),
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function weekRangeLabel(weekStart: Date): string {
    const dates = getWeekDates(weekStart)
    const first = dates[0]!
    const last  = dates[5]!
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()}–${last.getDate()} ${HEBREW_MONTHS_LONG[first.getMonth()] ?? ''} ${first.getFullYear()}`
    }
    return `${first.getDate()} ${HEBREW_MONTHS_LONG[first.getMonth()] ?? ''}–${last.getDate()} ${HEBREW_MONTHS_LONG[last.getMonth()] ?? ''}`
  }

  const weeksToWedding = weeksUntilWedding(currentWeekStart, weddingDate)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

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
          taskIds={visibleTasks.map((t) => t.id)}
          defaultEmail={process.env.NEXT_PUBLIC_BRIDE_EMAIL ?? ''}
          onClose={() => setEmailOpen(false)}
        />
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">לוח תכנון שבועי</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            גרור משימות מהסרגל הימני לכל שבוע · לחץ על כרטיסיה לעריכה
          </p>
        </div>

        {/* Right-side controls: email + view toggle */}
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => setEmailOpen(true)}
            title="שלחי רשימה במייל"
            aria-label="שליחה למייל"
            className="flex items-center gap-2 px-3 py-2 bg-white text-slate-600 text-sm font-medium rounded-xl hover:bg-violet-50 hover:text-violet-700 border border-slate-200 transition-colors"
          >
            <Mail size={15} />
            <span className="hidden sm:inline">מייל</span>
          </button>

        {/* View mode toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1">
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
        </div>{/* /right-side controls */}
      </div>{/* /page header */}

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="space-y-3 mb-6">
        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-300'
              }`}
            >
              כל הקטגוריות
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.slug)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  categoryFilter === cat.slug
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-300'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Assignee + show-done */}
        <div className="flex flex-wrap items-center gap-3">
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
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'
                }`}
              >
                {labels[v]}
              </button>
            )
          })}

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
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TWO-COLUMN LAYOUT
          Mobile:  flex-col-reverse → weeks on top, sidebar below
          Desktop: flex-row with RTL → sidebar on right, weeks on left
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col-reverse lg:flex-row gap-6 lg:items-start">

        {/* ── Backlog Sidebar ─────────────────────────────────────────────── */}
        {/* First in DOM = rightmost in RTL flex-row on desktop */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-6">
          <BacklogSidebar {...backlogProps} />
        </aside>

        {/* ── Weeks Area ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* ══ VIEW: SINGLE WEEK ═══════════════════════════════════════════ */}
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
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                    weeksToWedding === 0
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

              <WeekGrid weekDates={currentWeekDates} tasksByKey={tasksByKey} {...sharedGridProps} />
            </div>
          )}

          {/* ══ VIEW: ALL WEEKS (fully expanded, no accordion) ══════════════ */}
          {viewMode === 'all' && (
            <div className="space-y-4">
              {allWeeks.map((weekStart) => {
                const key       = toDateStr(weekStart)
                const weekDates = getWeekDates(weekStart)
                const wLabel    = getWeekLabel(weekStart, weddingDate)
                const isWedding = wLabel.includes('💍')
                const isPast    = wLabel === 'לאחר החתונה'

                const weekTaskCount = weekDates.reduce(
                  (sum, d) => sum + (tasksByKey.get(toDateStr(d))?.length ?? 0),
                  0,
                )

                return (
                  <div
                    key={key}
                    className={`rounded-2xl border overflow-hidden shadow-sm ${
                      isWedding
                        ? 'border-violet-400 bg-violet-50/20 shadow-violet-100'
                        : isPast
                          ? 'border-slate-100 bg-slate-50/50 opacity-60'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Week header — always visible, no toggle */}
                    <div
                      className={`px-4 py-3 border-b flex items-center gap-3 ${
                        isWedding ? 'border-violet-200 bg-violet-50/50' : 'border-slate-100 bg-slate-50/30'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isWedding ? 'text-violet-700' : 'text-slate-800'}`}>
                          {wLabel}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-none">
                          {weekRangeLabel(weekStart)}
                        </p>
                      </div>
                      {weekTaskCount > 0 && (
                        <span className="text-xs font-semibold text-violet-600 bg-violet-100 rounded-full px-2 py-0.5 shrink-0">
                          {weekTaskCount} משימות
                        </span>
                      )}
                      {weekTaskCount === 0 && (
                        <span className="text-xs text-slate-300 shrink-0">ריק</span>
                      )}
                    </div>

                    {/* Week grid — always shown (no accordion) */}
                    <div className="p-3">
                      <WeekGrid
                        weekDates={weekDates}
                        tasksByKey={tasksByKey}
                        {...sharedGridProps}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>{/* /weeks area */}
      </div>{/* /two-column layout */}

      {/* ── Category legend ───────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-8 pt-4 border-t border-slate-100">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${DOT_PALETTE[idx % DOT_PALETTE.length] ?? 'bg-slate-400'}`} />
              <span className="text-xs text-slate-400">{cat.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
