'use client'

import { useState } from 'react'
import { X, Mail, Loader2, CheckCircle2, Send } from 'lucide-react'
import { sendManualTasksEmail } from '@/app/actions/email'

interface EmailModalProps {
  taskIds:       string[]
  defaultEmail?: string
  onClose:       () => void
}

type Phase = 'form' | 'loading' | 'success' | 'error'

export default function EmailModal({ taskIds, defaultEmail, onClose }: EmailModalProps) {
  const [email,   setEmail]   = useState(defaultEmail ?? '')
  const [subject, setSubject] = useState('')
  const [phase,   setPhase]   = useState<Phase>('form')
  const [errMsg,  setErrMsg]  = useState('')

  async function handleSend() {
    if (!email.trim() || !email.includes('@')) return
    setPhase('loading')

    const result = await sendManualTasksEmail(email.trim(), taskIds, subject.trim() || undefined)

    if (result.success) {
      setPhase('success')
    } else {
      setErrMsg(result.error)
      setPhase('error')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && phase === 'form') void handleSend()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
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
        <div className="p-5">

          {/* SUCCESS */}
          {phase === 'success' && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
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

          {/* LOADING */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <Loader2 size={32} className="text-violet-500 animate-spin" />
              <p className="text-sm text-slate-600">שולחת מייל...</p>
            </div>
          )}

          {/* FORM or ERROR */}
          {(phase === 'form' || phase === 'error') && (
            <div className="space-y-4">
              {/* Task count badge */}
              <div className="flex items-center gap-2 bg-violet-50 rounded-xl px-4 py-2.5">
                <span className="text-sm font-semibold text-violet-700">
                  {taskIds.length} משימות ייכללו במייל
                </span>
              </div>

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

              {/* Error */}
              {phase === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
                  {errMsg}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => void handleSend()}
                  disabled={!email.trim() || !email.includes('@')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60"
                >
                  <Send size={14} />
                  שלחי מייל
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
