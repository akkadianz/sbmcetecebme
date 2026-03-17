'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { DEPARTMENT_FULL_NAMES } from '@/lib/constants'
import { useBatch } from '@/context/batch-context'
import { ChevronDown, LogOut, ShieldCheck, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { DensityToggle } from '@/components/common/density-toggle'

export function BatchHeader() {
  const { batch, logout } = useBatch()
  const router = useRouter()
  const [isHidden, setIsHidden] = useState(false)
  const departmentTitle = batch?.department ? DEPARTMENT_FULL_NAMES[batch.department] : 'Department'
  const collegeTitle = `SBM College of Engineering and Technology - ${departmentTitle}`

  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY <= 24) {
        setIsHidden(false)
        lastScrollY = currentScrollY
        return
      }

      setIsHidden(currentScrollY > lastScrollY)
      lastScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <header
      className={`sticky top-0 z-40 px-4 pt-4 transition-transform duration-300 ease-out sm:px-6 ${
        isHidden ? '-translate-y-[calc(100%+1rem)] opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 rounded-[28px] border border-white/70 bg-white/68 px-4 py-4 shadow-[0_18px_60px_rgba(76,97,166,0.12)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-4">
          <Image
            src="/sbm-logo.png"
            alt="SBM College logo"
            width={48}
            height={48}
            priority
            className="mt-0.5 h-11 w-11 shrink-0 rounded-2xl border border-white/70 bg-white/85 object-contain p-1.5 shadow-sm sm:h-12 sm:w-12"
          />
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-gradient-to-r from-indigo-50 to-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              College Identity
            </div>
            <h1 className="text-lg font-semibold tracking-[-0.03em] text-slate-950 leading-tight break-words sm:text-[1.45rem]">
              {collegeTitle}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 font-medium text-slate-700">
                Batch {batch?.batch_name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Local fee workspace for {batch?.department}</span>
                <span className="sm:hidden">Workspace {batch?.department}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <DensityToggle className="justify-center sm:justify-start" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 h-auto w-full justify-between rounded-full border-white/70 bg-white/85 px-4 py-2 shadow-sm whitespace-normal sm:w-auto"
              >
                <span className="flex-1 min-w-0 text-left font-semibold text-slate-700 break-words leading-snug">
                  {batch?.batch_name}
                </span>
                <ChevronDown className="ml-3 h-4 w-4 text-slate-500 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl border-white/70 bg-white/90 backdrop-blur-xl">
              <DropdownMenuLabel className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 break-words">{batch?.batch_name}</p>
                <p className="text-xs font-normal text-slate-500 break-words">{departmentTitle}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
