import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { connectToDatabase } from '@/infrastructure/db'
import TaskModel from '@/infrastructure/models/Task'
import { generateDailyDigestHTML } from '@/utils/emailTemplates'
import type { Task } from '@/domain/types'

export const runtime = 'nodejs'

function todayInIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Authorize ────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Resend key ───────────────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const brideEmail  = process.env.NEXT_PUBLIC_BRIDE_EMAIL
  const motherEmail = process.env.NEXT_PUBLIC_MOTHER_EMAIL

  if (!brideEmail) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_BRIDE_EMAIL not configured' }, { status: 500 })
  }

  try {
    // ── Fetch today's tasks ────────────────────────────────────────────────
    const today = todayInIsrael()
    await connectToDatabase()

    const docs = await TaskModel.find({ dueDate: today, status: { $ne: 'DONE' } })
      .sort({ priority: 1 })
      .lean()

    const tasks: Task[] = docs.map((d) => {
      const raw = { ...(d as Record<string, unknown>) }
      delete raw['_id']
      return raw as unknown as Task
    })

    const todayLabel = new Date().toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'long',
      day:     'numeric',
      month:   'long',
      year:    'numeric',
    })

    const html    = generateDailyDigestHTML(todayLabel, tasks)
    const subject = tasks.length > 0
      ? `☀️ בוקר טוב! יש לך ${tasks.length} משימות היום`
      : '☀️ בוקר טוב! אין משימות להיום'

    const resend    = new Resend(apiKey)
    const from      = process.env.RESEND_FROM_EMAIL ?? 'Wedding Planner <onboarding@resend.dev>'
    const recipients = [brideEmail, ...(motherEmail ? [motherEmail] : [])]

    await Promise.all(
      recipients.map((to) => resend.emails.send({ from, to, subject, html }))
    )

    return NextResponse.json({
      ok:         true,
      date:       today,
      taskCount:  tasks.length,
      sentTo:     recipients,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
