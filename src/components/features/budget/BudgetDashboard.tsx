'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Wallet,
  TrendingDown,
  PiggyBank,
  Pencil,
  Check,
  X,
  Building2,
  Loader2,
} from 'lucide-react'
import { updateTask } from '@/app/actions/tasks'
import type { Task, TaskStatus } from '@/domain/types'

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_CONFIG: Record<TaskStatus, { label: string; cls: string }> = {
  TODO:        { label: 'טרם שולם', cls: 'bg-slate-100  text-slate-600'   },
  IN_PROGRESS: { label: 'חלקי',     cls: 'bg-amber-100  text-amber-700'   },
  DONE:        { label: 'שולם',     cls: 'bg-emerald-100 text-emerald-700' },
}

// ============================================================================
// HELPERS
// ============================================================================

const ILS_FMT = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatILS(n: number): string {
  return ILS_FMT.format(n)
}

function barColor(ratio: number): string {
  if (ratio < 0.6)  return 'bg-emerald-500'
  if (ratio < 0.85) return 'bg-amber-500'
  return 'bg-red-500'
}

// ============================================================================
// LOCAL TYPES
// ============================================================================

interface ToastState { id: number; message: string; type: 'success' | 'error' }

// ============================================================================
// TOAST
// ============================================================================

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const bgCls = toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
  return (
    <div
      role="alert"
      className={`fixed top-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:w-80 z-[100] flex items-center gap-3 ${bgCls} text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium`}
    >
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        aria-label="סגור הודעה"
        className="shrink-0 hover:opacity-70 transition-opacity"
      >
        <X size={15} />
      </button>
    </div>
  )
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  iconCls,
  valueCls,
}: {
  label: string
  value: string
  icon: React.ElementType
  iconCls: string
  valueCls: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-2 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconCls}`}>
        <Icon size={20} />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
    </div>
  )
}

// ============================================================================
// BUDGET BAR
// ============================================================================

function BudgetBar({ actual, estimated }: { actual: number; estimated: number }) {
  const ratio = estimated > 0 ? Math.min(actual / estimated, 1) : 0
  const pct   = Math.round(ratio * 100)
  const over  = actual > estimated

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">התקדמות תשלומים</p>
        <span className={`text-sm font-bold tabular-nums ${over ? 'text-red-600' : 'text-slate-700'}`}>
          {pct}%{over && ' ⚠️ חריגה!'}
        </span>
      </div>
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(ratio)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-400">
        <span>שולם: {formatILS(actual)}</span>
        <span>יעד: {formatILS(estimated)}</span>
      </div>
    </div>
  )
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-violet-50 flex items-center justify-center mb-5 shadow-sm">
        <Building2 className="text-violet-400" size={36} />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">אין ספקים עדיין</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-xs leading-relaxed">
        הוסיפי ספקים ברשימת המשימות תחת הקטגוריה &ldquo;לוגיסטיקה וספקים&rdquo; כדי שיופיעו כאן.
      </p>
      <Link
        href="/checklist?category=logistics_and_vendors"
        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm shadow-violet-200"
      >
        <Plus size={16} />
        הוספת ספק ראשון
      </Link>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BudgetDashboard({ vendorTasks }: { vendorTasks: Task[] }) {
  const [tasks, setTasks]         = useState<Task[]>(vendorTasks)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [toast, setToast]         = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, id: Date.now(), type })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Auto-focus input when edit opens ─────────────────────────────────────
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  // ── Derived totals (recomputed on every render — no stale state) ──────────
  const totalEstimated = tasks.reduce((s, t) => s + t.estimatedCost, 0)
  const totalActual    = tasks.reduce((s, t) => s + t.actualCost,    0)
  const remaining      = totalEstimated - totalActual

  // ── Start inline edit ────────────────────────────────────────────────────
  function startEdit(task: Task) {
    if (pendingIds.has(task.id)) return
    setEditingId(task.id)
    setEditValue(String(task.actualCost))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  // ── Commit inline edit ────────────────────────────────────────────────────
  async function commitEdit(task: Task) {
    const newCost = parseFloat(editValue)

    if (isNaN(newCost) || newCost < 0) {
      showToast('סכום לא תקין — יש להזין מספר חיובי', 'error')
      cancelEdit()
      return
    }
    if (newCost === task.actualCost) {
      cancelEdit()
      return
    }

    const prevTasks = tasks

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, actualCost: newCost } : t)),
    )
    setEditingId(null)
    setEditValue('')
    setPendingIds((prev) => new Set([...prev, task.id]))

    const result = await updateTask(task.id, { actualCost: newCost })

    setPendingIds((prev) => {
      const n = new Set(prev)
      n.delete(task.id)
      return n
    })

    if (!result.success) {
      setTasks(prevTasks)
      showToast(`שגיאה בשמירה: ${result.error}`, 'error')
    } else {
      showToast('הסכום עודכן בהצלחה ✓', 'success')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, task: Task) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitEdit(task)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">ספקים ותקציב</h1>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ספקים ותקציב</h1>
          <p className="text-sm text-slate-500 mt-0.5">{tasks.length} ספקים</p>
        </div>
        <Link
          href="/checklist?category=logistics_and_vendors"
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm shadow-violet-200 shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">הוספת ספק</span>
          <span className="sm:hidden">הוספה</span>
        </Link>
      </div>

      {/* ── Stats cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <StatCard
          label="סה״כ עלות משוערת"
          value={formatILS(totalEstimated)}
          icon={Wallet}
          iconCls="bg-indigo-50 text-indigo-600"
          valueCls="text-indigo-700"
        />
        <StatCard
          label="סה״כ שולם"
          value={formatILS(totalActual)}
          icon={PiggyBank}
          iconCls="bg-emerald-50 text-emerald-600"
          valueCls="text-emerald-700"
        />
        <StatCard
          label={remaining >= 0 ? 'יתרה לתשלום' : 'חריגה מהתקציב'}
          value={formatILS(Math.abs(remaining))}
          icon={TrendingDown}
          iconCls={remaining < 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}
          valueCls={remaining < 0 ? 'text-red-700' : 'text-amber-700'}
        />
      </div>

      {/* ── Budget progress bar ───────────────────────────────────────────── */}
      <div className="mb-6">
        <BudgetBar actual={totalActual} estimated={totalEstimated} />
      </div>

      {/* ── Vendor table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">ספק</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">עלות משוערת</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">שולם</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">יתרה</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const balance    = task.estimatedCost - task.actualCost
                const isPending  = pendingIds.has(task.id)
                const isEditing  = editingId === task.id
                const statusCfg  = STATUS_CONFIG[task.status]

                return (
                  <tr
                    key={task.id}
                    className={`transition-colors ${
                      isPending ? 'opacity-60 bg-slate-50/50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {/* Supplier name */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-800 leading-snug">{task.title}</p>
                      {task.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                          {task.notes}
                        </p>
                      )}
                    </td>

                    {/* Estimated cost */}
                    <td className="px-4 py-3.5 tabular-nums text-slate-700 whitespace-nowrap">
                      {formatILS(task.estimatedCost)}
                    </td>

                    {/* Paid — inline editable cell */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            step="1"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => void commitEdit(task)}
                            onKeyDown={(e) => handleKeyDown(e, task)}
                            aria-label="עריכת סכום ששולם"
                            className="w-28 px-2 py-1 text-sm rounded-lg border border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400 tabular-nums"
                          />
                          <button
                            onMouseDown={(e) => { e.preventDefault(); void commitEdit(task) }}
                            aria-label="אשר עריכה"
                            className="text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); cancelEdit() }}
                            aria-label="בטל עריכה"
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(task)}
                          disabled={isPending}
                          title="לחצי לעריכה"
                          className="group flex items-center gap-1.5 tabular-nums text-slate-700 hover:text-violet-700 transition-colors disabled:cursor-wait"
                        >
                          {isPending ? (
                            <Loader2 size={13} className="animate-spin text-violet-400" />
                          ) : (
                            <Pencil
                              size={12}
                              className="text-slate-300 group-hover:text-violet-500 transition-colors"
                            />
                          )}
                          {formatILS(task.actualCost)}
                        </button>
                      )}
                    </td>

                    {/* Balance */}
                    <td className={`px-4 py-3.5 tabular-nums font-medium whitespace-nowrap ${
                      balance < 0
                        ? 'text-red-600'
                        : balance === 0
                        ? 'text-emerald-600'
                        : 'text-slate-700'
                    }`}>
                      {balance < 0 && '▲ '}
                      {formatILS(Math.abs(balance))}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.cls}`}
                      >
                        {statusCfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Summary footer row */}
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-700">סה״כ</td>
                <td className="px-4 py-3 tabular-nums font-semibold text-indigo-700 whitespace-nowrap">
                  {formatILS(totalEstimated)}
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                  {formatILS(totalActual)}
                </td>
                <td className={`px-4 py-3 tabular-nums font-bold whitespace-nowrap ${
                  remaining < 0 ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {remaining < 0 && '▲ '}{formatILS(Math.abs(remaining))}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Footer hint ───────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-slate-400 mt-4">
        לחצי על סכום &ldquo;שולם&rdquo; כדי לעדכן אותו · שינויים נשמרים אוטומטית
      </p>
    </div>
  )
}
