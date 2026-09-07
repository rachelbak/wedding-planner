/**
 * Pure HTML email template generators.
 * No server-only APIs — safe to import from both Server Actions and Route Handlers.
 */

import type { Task, Priority, AssignedTo } from '@/domain/types'

// ── Label maps ────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<Priority, { label: string; border: string; heading: string; emoji: string }> = {
  high:   { label: 'עדיפות גבוהה',   border: '#ef4444', heading: '#dc2626', emoji: '🔴' },
  medium: { label: 'עדיפות בינונית',  border: '#f59e0b', heading: '#d97706', emoji: '🟡' },
  low:    { label: 'עדיפות נמוכה',    border: '#cbd5e1', heading: '#94a3b8', emoji: '⚪' },
}

const ASSIGNEE_LABEL: Record<AssignedTo, string> = {
  bride:         'כלה',
  groom:         'חתן',
  parents_bride: 'הורי כלה',
  parents_groom: 'הורי חתן',
}

// ── Individual task card ──────────────────────────────────────────────────────

function taskCard(task: Task): string {
  const cfg        = PRIORITY_CFG[task.priority]
  const isDone     = task.status === 'DONE'
  const assignee   = ASSIGNEE_LABEL[task.assignedTo] ?? task.assignedTo
  const dateLabel  = task.dueDate ? `📅 ${task.dueDate}` : ''
  const titleStyle = isDone
    ? 'text-decoration:line-through;color:#94a3b8;'
    : 'color:#1e293b;'

  return `
<div style="background:#f8fafc;border-radius:10px;padding:14px 16px;margin-bottom:10px;border-right:4px solid ${cfg.border};text-align:right;direction:rtl;">
  <p style="margin:0 0 5px;font-size:15px;font-weight:600;line-height:1.4;${titleStyle}">${escHtml(task.title)}</p>
  <p style="margin:0;font-size:12px;color:#64748b;">
    👤 ${escHtml(assignee)}${dateLabel ? `&nbsp;&nbsp;${escHtml(dateLabel)}` : ''}
    ${task.subcategory ? `&nbsp;·&nbsp;${escHtml(task.subcategory)}` : ''}
  </p>
  ${task.notes ? `<p style="margin:8px 0 0;font-size:12px;color:#94a3b8;font-style:italic;border-top:1px solid #e2e8f0;padding-top:8px;direction:rtl;">${escHtml(task.notes)}</p>` : ''}
</div>`
}

// ── Priority section ──────────────────────────────────────────────────────────

function prioritySection(priority: Priority, tasks: Task[]): string {
  if (tasks.length === 0) return ''
  const cfg = PRIORITY_CFG[priority]
  return `
<div style="margin-bottom:28px;">
  <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;color:${cfg.heading};border-bottom:2px solid #ede9fe;padding-bottom:8px;text-align:right;direction:rtl;">
    ${cfg.emoji}&nbsp;${cfg.label}&nbsp;(${tasks.length})
  </h3>
  ${tasks.map(taskCard).join('')}
</div>`
}

// ── HTML escape ───────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function statsBar(tasks: Task[]): string {
  const high   = tasks.filter((t) => t.priority === 'high').length
  const medium = tasks.filter((t) => t.priority === 'medium').length
  const low    = tasks.filter((t) => t.priority === 'low').length
  const done   = tasks.filter((t) => t.status === 'DONE').length

  const parts: string[] = []
  if (high   > 0) parts.push(`🔴 ${high} גבוה`)
  if (medium > 0) parts.push(`🟡 ${medium} בינוני`)
  if (low    > 0) parts.push(`⚪ ${low} נמוך`)
  if (done   > 0) parts.push(`✅ ${done} הושלמו`)

  if (parts.length === 0) return ''
  return `
<div style="background:#f5f3ff;border-radius:10px;padding:12px 16px;margin-bottom:24px;text-align:center;direction:rtl;">
  <p style="margin:0;font-size:13px;color:#7c3aed;">${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</p>
</div>`
}

// ── Full email wrapper ────────────────────────────────────────────────────────

function emailWrapper(title: string, subtitle: string, body: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;direction:rtl;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width:600px;width:100%;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6d28d9 0%,#7c3aed 60%,#8b5cf6 100%);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
              <div style="font-size:48px;line-height:1;margin-bottom:16px;">💍</div>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:22px;font-weight:700;line-height:1.4;">${escHtml(title)}</h1>
              <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">${escHtml(subtitle)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px 24px;border-radius:0 0 16px 16px;box-shadow:0 8px 32px rgba(109,40,217,0.06);">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px;text-align:center;">
              <p style="margin:0;color:#a78bfa;font-size:12px;">💜 נשלח מאפליקציית מתכנן החתונה שלך</p>
              <p style="margin:6px 0 0;color:#c4b5fd;font-size:11px;">בהצלחה ואהבה! ✨</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Exported generators ───────────────────────────────────────────────────────

/**
 * Generic task list email (used by manual send action).
 */
export function generateManualEmailHTML(
  title: string,
  subtitle: string,
  tasks: Task[],
): string {
  const high   = tasks.filter((t) => t.priority === 'high')
  const medium = tasks.filter((t) => t.priority === 'medium')
  const low    = tasks.filter((t) => t.priority === 'low')

  const body = `
    ${statsBar(tasks)}
    ${prioritySection('high',   high)}
    ${prioritySection('medium', medium)}
    ${prioritySection('low',    low)}
    <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;direction:rtl;">
      סה"כ ${tasks.length} משימות
    </p>`

  return emailWrapper(title, subtitle, body)
}

/**
 * Daily morning digest email — tasks due today.
 */
export function generateDailyDigestHTML(
  todayLabel: string,
  tasks: Task[],
): string {
  if (tasks.length === 0) {
    const body = `
      <div style="text-align:center;padding:32px 0;direction:rtl;">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <p style="margin:0;font-size:18px;font-weight:600;color:#1e293b;">אין משימות להיום!</p>
        <p style="margin:8px 0 0;font-size:14px;color:#64748b;">קחי רגע לנשום ולהתרענן. מחר ממשיכים 💪</p>
      </div>`
    return emailWrapper('☀️ בוקר טוב!', todayLabel, body)
  }

  const high   = tasks.filter((t) => t.priority === 'high')
  const medium = tasks.filter((t) => t.priority === 'medium')
  const low    = tasks.filter((t) => t.priority === 'low')

  const body = `
    ${statsBar(tasks)}
    ${prioritySection('high',   high)}
    ${prioritySection('medium', medium)}
    ${prioritySection('low',    low)}`

  return emailWrapper(
    `☀️ בוקר טוב! יש לך ${tasks.length} משימות היום`,
    todayLabel,
    body,
  )
}
