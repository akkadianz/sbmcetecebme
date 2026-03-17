'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  Upload,
  Database,
  Settings,
  CalendarCheck,
} from 'lucide-react'

import { useBatch } from '@/context/batch-context'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Dashboard',
    href: '/batch-dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Academic Calendar',
    href: '/academic-calendar',
    icon: CalendarDays,
  },
  {
    label: 'Timetable',
    href: '/timetable',
    icon: CalendarClock,
  },
  {
    label: 'Students',
    href: '/students',
    icon: Users,
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
  },
  {
    label: 'Attendance',
    href: '/attendance',
    icon: CalendarCheck,
  },
  {
    label: 'Import',
    href: '/import',
    icon: Upload,
  },
  {
    label: 'Backup',
    href: '/backup-restore',
    icon: Database,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { batch } = useBatch()
  const role = batch?.role ?? 'admin'

  const filteredNav = navItems.filter((item) => {
    if (role === 'staff') {
      return item.href !== '/settings'
    }
    return true
  })

  return (
    <aside className="w-full shrink-0 lg:w-[290px]">
      <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-[0_18px_60px_rgba(76,97,166,0.08)] backdrop-blur-xl lg:sticky lg:top-[6.75rem]">
        <div className="mb-4 rounded-[24px] bg-[linear-gradient(135deg,rgba(93,106,255,0.96),rgba(118,170,255,0.88)_58%,rgba(164,112,255,0.88))] p-5 text-white shadow-[0_14px_40px_rgba(93,106,255,0.35)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Campus Workspace</p>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em]">Student Management</h2>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Streamlined controls for {batch?.department} batch operations, reports, payments, and safe local records.
          </p>
        </div>

        <div className="mb-4 rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active Batch</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{batch?.batch_name}</p>
              <p className="text-sm text-slate-500">{batch?.department}</p>
            </div>
            <div className="rounded-full bg-white p-2 text-indigo-600 shadow-sm">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {filteredNav.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200',
                isActive
                  ? 'bg-[linear-gradient(135deg,rgba(87,104,255,0.12),rgba(113,165,255,0.12),rgba(154,111,255,0.14))] text-slate-950 shadow-[inset_0_0_0_1px_rgba(116,128,255,0.18)]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-2xl transition-all',
                  isActive
                    ? 'bg-[linear-gradient(135deg,rgba(91,103,255,1),rgba(113,169,255,1),rgba(149,114,255,1))] text-white shadow-[0_10px_25px_rgba(91,103,255,0.35)]'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-900 group-hover:text-white',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-slate-400 whitespace-normal break-words">
                  {item.href.replace('/', '').replace('-', ' ') || 'home'}
                </p>
              </div>
            </Link>
          )
        })}
        </nav>
      </div>
    </aside>
  )
}
