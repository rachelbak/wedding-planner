'use client'

import { useState } from 'react'
import { X, Mail, Loader2, CheckCircle2, Send } from 'lucide-react'
import { sendManualTasksEmail } from '@/app/actions/email'
import type { Task } from '@/domain/types'

// ── Priority dot ──────────────────────────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = { high: '🔴', medium: '🟡', low: '⚪' }

// ── Props ─────────────────────────────────────────────────────────────────────
interface EmailModalProps {
  tasks:         Task[]
  defaultEmail?: string
  onClose:       () => void
}

type Phase = 'form' | 'loading' | 'success' | 'error'

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmailModal({ tasks, defaultEmail, onClose }: EmailModalProps) {
  const [email,       setEmail]       = useState(defaultEmail ?? '')
  const [subject,     setSubject]     = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(tasks.map((t) => t.id)))
  const [phase,       setPhase]       = useState<Phase>('form')
  const [errMsg,      setErrMsg]      = useState('')

  const allSelected = selectedIds.size === tasks.length && tasks.length > 0

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(tasks.map((t) => t.id)))
  }

  function toggleTask(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSend() {
    if (!email.trim() || !email.includes('@') || selectedIds.size === 0) return
    setPhase('loading')
    const result = await sendManualTasksEmail(email.trim(), [...selectedIds], subject.trim() || undefined)
    if (result.success) {
      setPhase('success')
    } else {
      setErrMsg(result.error)
      setPhase('error')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-violet-600" />
            <h2 className="text-base font-bold text-slate-800">שליחה למייל</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── SUCCESS ── */}
          {phase === 'success' && (
            <div className="flex flex-col items-center py-10 gap-3 text-center px-5">
              <CheckCircle2 size={40} className="text-violet-600" />
              <p className="text-base font-semibold text-slate-800">המייל נשלח בהצלחה!</p>
              <p className="text-sm text-slate-500">{email}</p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
              >
                סגור
              </button>
            </div>
          )}

          {/* ── LOADING ── */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center py-10 gap-3 text-center px-5">
              <Loader2 size={32} className="text-violet-500 animate-spin" />
              <p className="text-sm text-slate-600">שולחת מייל...</p>
            </div>
          )}

          {/* ── FORM / ERROR ── */}
          {(phase === 'form' || phase === 'error') && (
            <div className="p-5 space-y-4">

              {/* Email */}
              <label className="block">
                <span className="text-xs font-medium text-slate-500 block mb-1.5">
                  כתובת מייל <span className="text-red-400">*</span>
                </span>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  dir="ltr"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400"
                />
              </label>

              {/* Subject */}
              <label className="block">
                <span className="text-xs font-medium text-slate-500 block mb-1.5">נושא (אופציונלי)</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="רשימת משימות חתונה"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400"
                />
              </label>

              {/* Task selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">
                    בחרי משימות לשליחה
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
                  >
                    {allSelected ? 'בטלי הכל' : 'בחרי הכל'}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">אין משימות</p>
                  ) : (
                    tasks.map((task) => (
                      <label
                        key={task.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-violet-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                          selectedIds.has(task.id) ? '' : 'opacity-45'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                          className="w-4 h-4 rounded accent-violet-600 shrink-0"
                        />
                        <span className="text-sm text-slate-700 flex-1 truncate leading-snug">
                          {task.title}
                        </span>
                        <span className="text-xs shrink-0">
                          {PRIORITY_DOT[task.priority] ?? ''}
                        </span>
                      </label>
                    ))
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-1.5 text-center">
                  {selectedIds.size} מתוך {tasks.length} נבחרו
                </p>
              </div>

              {/* Error */}
              {phase === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
                  {errMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'form' || phase === 'error') && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button
              onClick={() => void handleSend()}
              disabled={!email.trim() || !email.includes('@') || selectedIds.size === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              <Send size={14} />
              שלחי מייל
              {selectedIds.size > 0 && (
                <span className="bg-white/20 rounded-full px-1.5 text-xs">
                  {selectedIds.size}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              ביטול
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
