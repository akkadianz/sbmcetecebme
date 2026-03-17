'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { BatchHeader } from '@/components/common/batch-header'
import { Sidebar } from '@/components/common/sidebar'
import { useBatch } from '@/context/batch-context'

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { batch, isLoggedIn, isReady } = useBatch()

  useEffect(() => {
    if (isReady && !isLoggedIn) {
      router.push('/')
    }
  }, [isLoggedIn, isReady, router])

  useEffect(() => {
    if (!isReady || !isLoggedIn || !batch) return
    if (batch.role === 'student' && !pathname.startsWith('/student')) {
      router.push('/student')
    }
  }, [batch, isLoggedIn, isReady, pathname, router])

  if (!isReady || !isLoggedIn) return null

  return (
    <div className="app-shell min-h-screen">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[26rem] bg-[radial-gradient(circle_at_top_left,_rgba(105,128,255,0.24),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(146,110,255,0.18),_transparent_36%),linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(244,247,255,0.78))]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[22rem] bg-[radial-gradient(circle_at_bottom_left,_rgba(95,150,255,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(129,96,255,0.14),_transparent_30%)]" />
      <div className="relative z-10">
        <BatchHeader />
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 pb-6 pt-4 sm:px-6 lg:flex-row">
          {batch?.role === 'student' ? null : <Sidebar />}
          <main className="min-w-0 flex-1 overflow-auto rounded-[28px] border border-white/65 bg-white/72 shadow-[0_20px_80px_rgba(76,97,166,0.12)] backdrop-blur-xl">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
