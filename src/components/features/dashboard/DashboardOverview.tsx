import type { Task } from '@/domain/types'
import { WEDDING_DATE } from '@/config/wedding'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  tasks: Task[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RING_RADIUS = 44
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Parse a YYYY-MM-DD string in local time to avoid UTC-midnight off-by-one. */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

// ---------------------------------------------------------------------------
// Sub-components — all server-renderable (no client state)
// ---------------------------------------------------------------------------

function CountdownCard({
  daysLeft,
  weeksLeft,
  dateLabel,
}: {
  daysLeft: number
  weeksLeft: number
  dateLabel: string
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-violet-200/50">
      {/* Decorative circles */}
      <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
      <div className="absolute -bottom-6 -right-4 w-24 h-24 rounded-full bg-white/5" />

      <p className="relative text-xs font-semibold text-indigo-200 tracking-wider uppercase mb-4">
        💍 ימים עד החתונה
      </p>

      {daysLeft > 0 ? (
        <>
          <p className="relative text-7xl font-bold tabular-nums leading-none mb-2">
            {daysLeft}
          </p>
          <p className="relative text-indigo-200 text-sm font-medium">
            {weeksLeft > 0
              ? `כ-${weeksLeft} שבועות נותרו`
              : 'השבוע הגדול מגיע!'}
          </p>
        </>
      ) : daysLeft === 0 ? (
        <p className="relative text-3xl font-bold">היום זה הגדול! 🎉</p>
      ) : (
        <>
          <p className="relative text-3xl font-bold mb-1">מזל טוב! 🎊</p>
          <p className="relative text-indigo-200 text-sm">החתונה הייתה לפני {Math.abs(daysLeft)} ימים</p>
        </>
      )}

      <p className="relative mt-6 text-xs text-indigo-300 font-medium">
        {dateLabel}
      </p>
    </div>
  )
}

function ProgressCard({
  total,
  done,
  inProgress,
  percentage,
}: {
  total: number
  done: number
  inProgress: number
  percentage: number
}) {
  const dashOffset = RING_CIRCUMFERENCE * (1 - Math.min(percentage, 100) / 100)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-5">
        ✓ התקדמות משימות
      </p>

      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            className="-rotate-90"
          >
            {/* Track */}
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              className="stroke-slate-100"
              strokeWidth="10"
            />
            {/* Fill */}
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              className="stroke-violet-600"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-800 leading-none">
              {percentage}%
            </span>
            <span className="text-xs text-slate-400 mt-0.5">הושלמו</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-600 shrink-0" />
            <span className="text-slate-600">{done} הושלמו</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-300 shrink-0" />
            <span className="text-slate-600">{inProgress} בתהליך</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200 shrink-0" />
            <span className="text-slate-600">
              {total - done - inProgress} ממתינות
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-5 border-t border-slate-50 pt-4">
        {total === 0 ? 'עדיין אין משימות — בואי נתחיל!' : `סה"כ ${total} משימות`}
      </p>
    </div>
  )
}

function BudgetCard({
  estimated,
  actual,
}: {
  estimated: number
  actual: number
}) {
  const isOver = actual > estimated && estimated > 0
  const ratio = estimated > 0 ? Math.min(actual / estimated, 1) : 0
  const barPercent = Math.round(ratio * 100)
  const variance = Math.abs(estimated - actual)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-5">
        💰 סיכום תקציב
      </p>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-slate-400">הערכת עלות</span>
          <span className="font-semibold text-slate-700 tabular-nums">
            {formatCurrency(estimated)}
          </span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-sm text-slate-400">עלות בפועל</span>
          <span
            className={`font-semibold tabular-nums ${
              isOver ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {formatCurrency(actual)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 mb-3">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${
              isOver ? 'bg-red-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>0%</span>
          <span>{barPercent}% מנוצל</span>
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-slate-50">
        <span className="text-sm text-slate-400">
          {isOver ? 'חריגה מהתקציב' : estimated === 0 ? 'תקציב לא הוגדר' : 'יתרה'}
        </span>
        <span
          className={`text-base font-bold tabular-nums ${
            isOver
              ? 'text-red-600'
              : estimated === 0
              ? 'text-slate-400'
              : 'text-emerald-600'
          }`}
        >
          {estimated > 0 ? formatCurrency(variance) : '—'}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardOverview (Server Component)
// ---------------------------------------------------------------------------

export default function DashboardOverview({ tasks }: Props) {
  // ── Wedding countdown ────────────────────────────────────────────────────
  const weddingDate = parseLocalDate(WEDDING_DATE)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const msLeft = weddingDate.getTime() - today.getTime()
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
  const weeksLeft = Math.floor(Math.max(daysLeft, 0) / 7)
  const dateLabel = weddingDate.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // ── Task stats ───────────────────────────────────────────────────────────
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'DONE').length
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0

  // ── Budget ───────────────────────────────────────────────────────────────
  const estimated = tasks.reduce((s, t) => s + (t.estimatedCost ?? 0), 0)
  const actual = tasks.reduce((s, t) => s + (t.actualCost ?? 0), 0)

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          שלום, כלה! ✨
        </h1>
        <p className="mt-1 text-slate-500 text-sm md:text-base">
          הנה סיכום המצב שלך להיום
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <CountdownCard
          daysLeft={daysLeft}
          weeksLeft={weeksLeft}
          dateLabel={dateLabel}
        />
        <ProgressCard
          total={total}
          done={done}
          inProgress={inProgress}
          percentage={percentage}
        />
        <BudgetCard estimated={estimated} actual={actual} />
      </div>
    </div>
  )
}
