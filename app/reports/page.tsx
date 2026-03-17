'use client'

import { Download, FileText } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { downloadBlob } from '@/lib/utils'

const reportCards = [
  {
    type: 'summary',
    title: 'Batch Summary Report',
    description: 'Overview of total fees and collections',
    points: ['Total students in batch', 'Total fees charged', 'Total amount paid', 'Collection percentage', 'Outstanding fees'],
  },
  {
    type: 'pending',
    title: 'Pending Fees Report',
    description: 'List of students with outstanding fees',
    points: ['Students with pending fees', 'Outstanding amount per student', 'Year-wise pending details', 'Sortable export data', 'Batch-wise view'],
  },
  {
    type: 'payments',
    title: 'Payment History Report',
    description: 'Detailed payment transaction log',
    points: ['All payment transactions', 'Receipt numbers', 'Payment dates and methods', 'Student-wise payment details', 'Portable export file'],
  },
  {
    type: 'students',
    title: 'Student Fees Report',
    description: 'Fee details for all students',
    points: ['All student records', 'Year-wise fee breakdown', 'Payment status for each year', 'Printable PDF export', 'Spreadsheet-friendly CSV'],
  },
]

export default function ReportsPage() {
  const { batch } = useBatch()
  const { toast } = useToast()

  async function exportReport(type: string, format: 'csv' | 'pdf') {
    if (!batch) return

    try {
      const response = await fetch(
        `/api/reports?batch_id=${batch.batch_id}&department=${batch.department}&type=${type}&format=${format}`,
      )
      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const blob = await response.blob()
      downloadBlob(`${type}-report.${format}`, blob)
      toast({ title: 'Report ready', description: `${type} report downloaded as ${format.toUpperCase()}` })
    } catch (error) {
      toast({ title: 'Error', description: 'Could not generate report', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Image
            src="/sbm-logo.png"
            alt="SBM College logo"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl border border-white/70 bg-white/80 object-contain p-1.5 shadow-sm"
          />
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
        </div>
        <p className="text-slate-600 mt-1">Generate and export fee reports for {batch?.department}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCards.map((report) => (
          <Card key={report.type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {report.title}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-1 mb-4">
                {report.points.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportReport(report.type, 'csv')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportReport(report.type, 'pdf')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
