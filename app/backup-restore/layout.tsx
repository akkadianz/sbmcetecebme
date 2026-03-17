'use client'

import { AppShell } from '@/components/common/app-shell'

export default function BackupRestoreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
