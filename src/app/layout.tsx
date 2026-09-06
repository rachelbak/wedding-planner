import type { Metadata } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kallah Planner | מתארגנים לחתונה',
  description: 'מתכנן חתונה מושלם לכלות',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  )
}
