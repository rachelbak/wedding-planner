/**
 * Hebrew calendar utilities.
 * Uses @hebcal/core (pure JS, browser-safe) to convert Gregorian dates to
 * Hebrew dates and to fetch Jewish holiday data for a date range.
 *
 * All date arithmetic is done in LOCAL time so there are no UTC midnight
 * boundary surprises when formatting or comparing calendar days.
 */

import { HDate, HebrewCalendar, flags } from '@hebcal/core'

// ── Hebrew numeral mapping (Gematria, 1–30) ────────────────────────────────

const GEMATRIA: Record<number, string> = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  10: 'י', 11: 'יא', 12: 'יב', 13: 'יג', 14: 'יד', 15: 'טו', 16: 'טז',
  17: 'יז', 18: 'יח', 19: 'יט', 20: 'כ', 21: 'כא', 22: 'כב', 23: 'כג',
  24: 'כד', 25: 'כה', 26: 'כו', 27: 'כז', 28: 'כח', 29: 'כט', 30: 'ל',
}

// ── Hebrew month names ─────────────────────────────────────────────────────

const HEBREW_MONTHS: Record<number, string> = {
  1: 'ניסן', 2: 'אייר', 3: 'סיון', 4: 'תמוז', 5: 'אב', 6: 'אלול',
  7: 'תשרי', 8: 'חשוון', 9: 'כסלו', 10: 'טבת', 11: 'שבט',
  12: 'אדר', 13: "אדר ב'",
}

// ── English → Hebrew holiday names ────────────────────────────────────────

const HOLIDAY_HE: Record<string, string> = {
  'Erev Rosh Hashana':    'ערב ראש השנה',
  'Rosh Hashana':         'ראש השנה',
  'Rosh Hashana II':      "ראש השנה ב'",
  'Tzom Gedaliah':        'צום גדליה',
  'Erev Yom Kippur':      'ערב יום כיפור',
  'Yom Kippur':           'יום כיפור',
  'Erev Sukkot':          'ערב סוכות',
  'Sukkot I':             'סוכות',
  'Sukkot II':            "סוכות ב'",
  "Sukkot III (CH''M)":   'חול המועד סוכות',
  "Sukkot IV (CH''M)":    'חול המועד סוכות',
  "Sukkot V (CH''M)":     'חול המועד סוכות',
  "Sukkot VI (CH''M)":    'חול המועד סוכות',
  'Hoshana Raba':         'הושענא רבה',
  'Shmini Atzeret':       'שמיני עצרת',
  'Simchat Torah':        'שמחת תורה',
  'Chanukah: 1 Candle':   'חנוכה — נר א׳',
  'Chanukah: 2 Candles':  'חנוכה — נר ב׳',
  'Chanukah: 3 Candles':  'חנוכה — נר ג׳',
  'Chanukah: 4 Candles':  'חנוכה — נר ד׳',
  'Chanukah: 5 Candles':  'חנוכה — נר ה׳',
  'Chanukah: 6 Candles':  'חנוכה — נר ו׳',
  'Chanukah: 7 Candles':  'חנוכה — נר ז׳',
  'Chanukah: 8 Candles':  'חנוכה — נר ח׳',
  'Tzom Tevet':           'צום טבת',
  'Tu BiShvat':           'ט״ו בשבט',
  "Ta'anit Esther":       'תענית אסתר',
  'Purim':                'פורים',
  'Shushan Purim':        'שושן פורים',
  'Erev Pesach':          'ערב פסח',
  'Pesach I':             'פסח',
  'Pesach II':            "פסח ב'",
  "Pesach III (CH''M)":   'חול המועד פסח',
  "Pesach IV (CH''M)":    'חול המועד פסח',
  "Pesach V (CH''M)":     'חול המועד פסח',
  "Pesach VI (CH''M)":    'חול המועד פסח',
  'Pesach VII':           "פסח ז'",
  'Pesach VIII':          "פסח ח'",
  'Lag BaOmer':           'ל״ג בעומר',
  'Erev Shavuot':         'ערב שבועות',
  'Shavuot I':            'שבועות',
  'Shavuot II':           "שבועות ב'",
  "Tisha B'Av":           'תשעה באב',
}

// ── Export type ────────────────────────────────────────────────────────────

export type HolidayBadge = {
  text: string
  type: 'major' | 'erev' | 'chol-hamoed' | 'fast' | 'minor' | 'rosh-chodesh'
}

// ── Pure date utilities ───────────────────────────────────────────────────

/** Format as YYYY-MM-DD using LOCAL date components (no UTC shift). */
export function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a YYYY-MM-DD string in LOCAL time (avoids UTC midnight off-by-one). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** Return the Sunday that begins the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

/** Return Sunday–Friday (6 dates) for the week starting on `weekStart`. */
export function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** Add `weeks` weeks to `date`. */
export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

/** Return the English weekday slug for a date (matching task.assignedDay). */
export function getDayOfWeek(date: Date): string {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return names[date.getDay()] ?? 'backlog'
}

/** True if `date` is today (local). */
export function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth()    &&
    date.getDate()     === now.getDate()
  )
}

/** Returns Sunday start-dates for every week from `from` through the week
 *  containing `to`. */
export function getAllWeeks(from: Date, to: Date): Date[] {
  const weeks: Date[] = []
  let curr = getWeekStart(from)
  const last = getWeekStart(to)
  while (curr <= last) {
    weeks.push(new Date(curr))
    curr = new Date(curr)
    curr.setDate(curr.getDate() + 7)
  }
  return weeks
}

/** Number of full weeks between `weekStart` and the wedding week. */
export function weeksUntilWedding(weekStart: Date, weddingDate: Date): number {
  const ws = getWeekStart(weddingDate)
  return Math.round((ws.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

/** Human-readable Hebrew label for a week relative to the wedding. */
export function getWeekLabel(weekStart: Date, weddingDate: Date): string {
  const n = weeksUntilWedding(weekStart, weddingDate)
  if (n === 0) return '💍 שבוע החתונה!'
  if (n === 1) return 'שבוע לפני החתונה'
  if (n < 0)  return 'לאחר החתונה'
  return `${n} שבועות לפני החתונה`
}

/** Hebrew date label for a Gregorian date, e.g. "ה׳ טבת". */
export function formatHebrewDate(date: Date): string {
  try {
    const hdate = new HDate(date)
    const day   = GEMATRIA[hdate.getDate()] ?? String(hdate.getDate())
    const month = HEBREW_MONTHS[hdate.getMonth()] ?? ''
    return `${day}׳ ${month}`
  } catch {
    return ''
  }
}

/** Precompute Hebrew date labels and holiday badges for every day in [from, to].
 *  Returns two Maps keyed by YYYY-MM-DD strings. */
export function buildCalendarMaps(
  from: Date,
  to:   Date,
): { hebrewDates: Map<string, string>; holidays: Map<string, HolidayBadge> } {
  const hebrewDates = new Map<string, string>()
  const holidays    = new Map<string, HolidayBadge>()

  // Hebrew date label for each calendar day
  let curr = new Date(from)
  curr.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(23, 59, 59, 0)

  while (curr <= end) {
    hebrewDates.set(toDateStr(curr), formatHebrewDate(curr))
    curr = new Date(curr)
    curr.setDate(curr.getDate() + 1)
  }

  // Jewish holiday events for the full range in one API call
  try {
    const events = HebrewCalendar.calendar({
      start:          new HDate(from),
      end:            new HDate(to),
      il:             false,   // Diaspora calendar
      candlelighting: false,
      sedrot:         false,
    })

    // Priority order: MAJOR_FAST > MINOR_FAST > CHAG > EREV > CHOL_HAMOED > MINOR > ROSH_CHODESH
    const PRIORITY: Record<HolidayBadge['type'], number> = {
      fast: 6, major: 5, erev: 4, 'chol-hamoed': 3, minor: 2, 'rosh-chodesh': 1,
    }

    for (const ev of events) {
      const f = ev.getFlags()

      // Skip non-display event types
      if (
        (f & flags.PARSHA_HASHAVUA) ||
        (f & flags.DAF_YOMI)         ||
        (f & flags.OMER_COUNT)       ||
        (f & flags.HEBREW_DATE)      ||
        (f & flags.MISHNA_YOMI)      ||
        (f & flags.MOLAD)
      ) continue

      const dateKey = toDateStr(ev.getDate().greg())
      const desc    = ev.getDesc()
      const text    = HOLIDAY_HE[desc] ?? desc

      let type: HolidayBadge['type']
      if      (f & flags.MAJOR_FAST)                         type = 'fast'
      else if (f & flags.MINOR_FAST)                         type = 'fast'
      else if (f & flags.CHAG)                               type = 'major'
      else if (f & flags.LIGHT_CANDLES)                      type = 'erev'
      else if (f & flags.CHOL_HAMOED)                        type = 'chol-hamoed'
      else if (f & flags.MINOR_HOLIDAY)                      type = 'minor'
      else if (f & flags.ROSH_CHODESH)                       type = 'rosh-chodesh'
      else                                                    type = 'minor'

      const existing = holidays.get(dateKey)
      if (!existing || PRIORITY[type] > PRIORITY[existing.type]) {
        holidays.set(dateKey, { text, type })
      }
    }
  } catch {
    // Gracefully degrade — calendar still usable without holiday data
  }

  return { hebrewDates, holidays }
}
