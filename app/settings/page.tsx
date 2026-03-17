'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBatch } from '@/context/batch-context'

export default function SettingsPage() {
  const { batch } = useBatch()

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Batch information and system notes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Management</CardTitle>
              <CardDescription>Fees are now managed directly on each student record for each year.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>- Add custom year-wise fees while creating a new student.</p>
              <p>- Edit any year later from the student details page.</p>
              <p>- Bulk import uses the template with year1 to year4 fee columns.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>All data is stored locally on this machine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>Storage type: Local JSON files</p>
              <p>No global default fee structure is applied anymore.</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Batch Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-600">Batch Name</p>
                <p className="font-medium">{batch?.batch_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Created</p>
                <p className="font-medium">{batch?.created_at ? new Date(batch.created_at).toLocaleDateString() : 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
