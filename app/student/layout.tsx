'use client'

import { AppShell } from '@/components/common/app-shell'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

