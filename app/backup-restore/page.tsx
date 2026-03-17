'use client'

import { useRef, useState } from 'react'
import { Database, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { downloadBlob } from '@/lib/utils'

export default function BackupRestorePage() {
  const { batch } = useBatch()
  const { toast } = useToast()
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{
    exported_at: string | null
    has_batch: boolean
    students: number
    year_records: number
    payments: number
    audit_logs: number
    attendance_records: number
    attendance_settings: number
  } | null>(null)
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [pendingBackup, setPendingBackup] = useState<Record<string, unknown> | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)

  async function exportBackup() {
    if (!batch) return

    try {
      const response = await fetch(`/api/backup?batch_id=${batch.batch_id}`)
      if (!response.ok) throw new Error('Backup failed')

      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
      downloadBlob(`${batch.batch_name}-backup.json`, blob)
      toast({ title: 'Backup ready', description: 'Batch backup exported successfully' })
    } catch (error) {
      toast({ title: 'Error', description: 'Could not export backup', variant: 'destructive' })
    }
  }

  async function handleRestoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    if (!batch) return

    const file = event.target.files?.[0]
    if (!file) return

    try {
      setPreview(null)
      setPreviewWarnings([])
      setPreviewError(null)
      setConfirmRestore(false)

      const backup = JSON.parse(await file.text()) as Record<string, unknown>
      setPendingBackup(backup)

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, backup, preview: true }),
      })

      const data = await response.json()
      if (!response.ok) {
        const details = data?.details?.errors?.join(' ') || data?.error || 'Restore preview failed'
        throw new Error(details)
      }

      setPreview(data.details.summary)
      setPreviewWarnings(data.details.warnings ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not preview backup file'
      setPreviewError(message)
      setPendingBackup(null)
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      if (restoreInputRef.current) {
        restoreInputRef.current.value = ''
      }
    }
  }

  async function handleRestoreConfirm() {
    if (!batch || !pendingBackup) return

    try {
      setIsRestoring(true)
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, backup: pendingBackup }),
      })

      if (!response.ok) throw new Error('Restore failed')
      toast({ title: 'Restore complete', description: 'Backup restored into the current batch' })
      setPendingBackup(null)
      setPreview(null)
      setPreviewWarnings([])
      setPreviewError(null)
      setConfirmRestore(false)
    } catch (error) {
      toast({ title: 'Error', description: 'Could not restore backup file', variant: 'destructive' })
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Backup</h1>
        <p className="text-slate-600 mt-1">Export the current batch data for safekeeping</p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Export Batch Backup
            </CardTitle>
            <CardDescription>Download students, year records, payments, fee settings, and audit logs as JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportBackup}>
              <Download className="mr-2 h-4 w-4" />
              Download Backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restore Backup</CardTitle>
            <CardDescription>Import a previously exported JSON backup into this batch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input ref={restoreInputRef} type="file" accept=".json,application/json" onChange={handleRestoreFile} />
            <p className="text-sm text-slate-500">Restoring replaces the current batch students, fees, payments, and audit data.</p>
            {previewError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {previewError}
              </div>
            ) : null}
            {preview ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
                <p className="font-medium text-slate-900">Restore Preview</p>
                <p>Students: {preview.students}</p>
                <p>Year records: {preview.year_records}</p>
                <p>Payments: {preview.payments}</p>
                <p>Audit logs: {preview.audit_logs}</p>
                <p>Attendance records: {preview.attendance_records}</p>
                <p>Attendance settings: {preview.attendance_settings}</p>
                <p>Exported at: {preview.exported_at ?? 'Unknown'}</p>
                {previewWarnings.length ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-700">
                    <p className="font-medium">Warnings</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      {previewWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={confirmRestore}
                    onChange={(event) => setConfirmRestore(event.target.checked)}
                  />
                  <span>I understand this will overwrite the current batch data.</span>
                </label>
                <Button onClick={handleRestoreConfirm} disabled={!confirmRestore || isRestoring}>
                  {isRestoring ? 'Restoring...' : 'Confirm Restore'}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
