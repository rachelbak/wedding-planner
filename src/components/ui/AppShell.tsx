'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare2,
  CalendarDays,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface NavItem {
  href: string
  label: string
  shortLabel: string // used in the mobile bottom bar where space is limited
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'דשבורד',
    shortLabel: 'בית',
    Icon: LayoutDashboard,
  },
  {
    href: '/checklist',
    label: 'משימות וקניות',
    shortLabel: 'משימות',
    Icon: CheckSquare2,
  },
  {
    href: '/planner',
    label: 'לו"ז שבועי',
    shortLabel: 'לוח',
    Icon: CalendarDays,
  },
  {
    href: '/budget',
    label: 'ספקים ותקציב',
    shortLabel: 'תקציב',
    Icon: Wallet,
  },
]

// ---------------------------------------------------------------------------
// Sidebar nav link (desktop)
// ---------------------------------------------------------------------------

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
        active
          ? 'bg-violet-50 text-violet-700'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <item.Icon
        size={18}
        className={`shrink-0 transition-colors ${
          active ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'
        }`}
      />
      <span>{item.label}</span>
      {active && (
        <span className="ms-auto w-1.5 h-1.5 rounded-full bg-violet-600" />
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Bottom nav link (mobile)
// ---------------------------------------------------------------------------

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-2 text-xs font-medium transition-colors ${
        active ? 'text-violet-600' : 'text-slate-400 active:text-slate-600'
      }`}
    >
      <item.Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
      <span>{item.shortLabel}</span>
      {active && (
        <span className="absolute top-0 w-8 h-0.5 rounded-full bg-violet-600" />
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Desktop Sidebar ────────────────────────────────────────────── */}
      {/*
        In RTL flex, the first child appears on the RIGHT side of the
        container — which is the natural primary side for Hebrew UIs.
      */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-0 h-screen bg-white border-l border-slate-200">
        {/* Branding */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-sm shadow-violet-200">
            💍
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">מתארגנים לחתונה</p>
            <p className="text-xs text-slate-400">Kallah Planner</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">
            בסיעתא דשמיא ✨
          </p>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 pb-24 md:pb-0 overflow-y-auto">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white/95 backdrop-blur-sm border-t border-slate-200 z-50 flex relative">
        {NAV_ITEMS.map((item) => (
          <BottomNavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
          />
        ))}
      </nav>
    </div>
  )
}
