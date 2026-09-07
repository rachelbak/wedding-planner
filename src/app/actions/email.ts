'use server'

import { Resend } from 'resend'
import { connectToDatabase } from '@/infrastructure/db'
import TaskModel from '@/infrastructure/models/Task'
import { generateManualEmailHTML } from '@/utils/emailTemplates'
import type { Task } from '@/domain/types'

type EmailResult = { success: true } | { success: false; error: string }

export async function sendManualTasksEmail(
  recipientEmail: string,
  taskIds: string[],
  subject?: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured' }
  }

  if (!recipientEmail.includes('@')) {
    return { success: false, error: 'כתובת המייל אינה תקינה' }
  }

  if (taskIds.length === 0) {
    return { success: false, error: 'לא נבחרו משימות לשליחה' }
  }

  try {
    await connectToDatabase()
    const docs = await TaskModel.find({ id: { $in: taskIds } }).lean()
    const tasks: Task[] = docs.map((d) => {
      const raw = { ...(d as Record<string, unknown>) }
      delete raw['_id']
      return raw as unknown as Task
    })

    if (tasks.length === 0) {
      return { success: false, error: 'לא נמצאו משימות' }
    }

    const emailSubject = subject?.trim() || `רשימת משימות חתונה — ${tasks.length} משימות`
    const subtitle     = `נשלח ב-${new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}`
    const html         = generateManualEmailHTML(emailSubject, subtitle, tasks)

    const resend = new Resend(apiKey)
    const from   = process.env.RESEND_FROM_EMAIL ?? 'Wedding Planner <onboarding@resend.dev>'

    await resend.emails.send({ from, to: recipientEmail, subject: emailSubject, html })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'שגיאה לא צפויה'
    return { success: false, error: message }
  }
}
