// ה' טבת תשפ"ז — Hey Tevet 5787 (eve of Vav Tevet)
const DEFAULT_WEDDING_DATE = '2026-12-15'

export const WEDDING_DATE: string =
  process.env.NEXT_PUBLIC_WEDDING_DATE ?? DEFAULT_WEDDING_DATE
