'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Image from 'next/image'

import { LoginForm } from '@/components/auth/login-form'
import { DensityToggle } from '@/components/common/density-toggle'
import { useBatch } from '@/context/batch-context'

export default function Home() {
  const router = useRouter()
  const { batch, isLoggedIn, isReady } = useBatch()

  useEffect(() => {
    if (isReady && isLoggedIn) {
      router.push(batch?.role === 'student' ? '/student' : '/batch-dashboard')
    }
  }, [batch?.role, isLoggedIn, isReady, router])

  if (!isReady) return null

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(101,116,255,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(86,168,255,0.16),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(243,246,255,0.96))]" />

      <div className="relative z-10 w-full max-w-xl">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <Image
              src="/sbm-logo.png"
              alt="SBM College of Engineering and Technology logo"
              width={88}
              height={88}
              priority
              className="h-20 w-20 rounded-2xl border border-white/70 bg-white/80 object-contain p-2 shadow-sm sm:h-[88px] sm:w-[88px]"
            />
          </div>
          <div className="mb-3 flex justify-center">
            <DensityToggle />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            SBM College of Engineering and Technology
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Department of ECE &amp; BME
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">Student Management System</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in to continue with your batch workspace.
          </p>
        </div>

        <div className="w-full rounded-[32px] border border-white/70 bg-white/78 p-4 shadow-[0_20px_60px_rgba(76,97,166,0.12)] backdrop-blur-xl sm:p-5">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
