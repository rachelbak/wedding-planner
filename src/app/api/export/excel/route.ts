import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { connectToDatabase } from '@/infrastructure/db'
import CategoryModel from '@/infrastructure/models/Category'
import TaskModel from '@/infrastructure/models/Task'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await connectToDatabase()

    const [categories, tasks] = await Promise.all([
      CategoryModel.find({}).lean(),
      TaskModel.find({}).lean(),
    ])

    const wb = XLSX.utils.book_new()

    // Group tasks by category slug
    const bySlug = new Map<string, typeof tasks>()
    for (const t of tasks) {
      const slug = (t as any).category ?? 'other'
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), t])
    }

    // One tab per category
    for (const cat of categories as any[]) {
      const catTasks = bySlug.get(cat.slug) ?? []
      const rows: (string)[][] = [
        ['שם משימה', 'תת קטגוריה'],
        ...catTasks.map((t: any) => [t.title ?? '', t.subcategory ?? '']),
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 42 }, { wch: 22 }]
      const sheetName = `${cat.emoji ?? ''} ${cat.name}`.trim().slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }

    // Tasks whose category doesn't match any known category
    const knownSlugs = new Set((categories as any[]).map((c: any) => c.slug))
    const orphans    = tasks.filter((t: any) => !knownSlugs.has(t.category ?? ''))
    if (orphans.length > 0) {
      const rows: string[][] = [
        ['שם משימה', 'תת קטגוריה'],
        ...orphans.map((t: any) => [t.title ?? '', t.subcategory ?? '']),
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 42 }, { wch: 22 }]
      XLSX.utils.book_append_sheet(wb, ws, 'ללא קטגוריה')
    }

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('רשימת-משימות-חתונה')}.xlsx`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[export/excel]', err)
    return NextResponse.json({ error: 'שגיאה בייצוא' }, { status: 500 })
  }
}
