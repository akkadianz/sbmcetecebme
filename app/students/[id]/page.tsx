'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import useSWR from 'swr'
import { ArrowLeft, CreditCard, Download, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { type YearRecordFeeInput, yearRecordFeeSchema } from '@/lib/schemas'
import { downloadBlob, formatCurrency } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

interface YearRecord {
  year_record_id: number
  year: number
  tuition_fee: number
  books_fee: number
  bus_fee: number
  hostel_fee: number
  misc_fee: number
  total_fee: number
  paid_amount: number
  outstanding_amount: number
  status: string
}

interface Student {
  student_id_roll: string
  first_name: string
  last_name: string
  email: string
  phone: string
  department: 'ECE' | 'BME'
  year: string
  section: string
  hostel_status: string
  year_records: YearRecord[]
  payments: Payment[]
}

interface Payment {
  payment_id: number
  bill_number: string
  receipt_number: string
  amount: number
  payment_method: string
  payment_date: string
  notes: string
}

function getStatusColor(status: string) {
  if (status === 'paid') return 'bg-green-100 text-green-800'
  if (status === 'partially-paid') return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

export default function StudentDetailPage() {
  const { batch } = useBatch()
  const { toast } = useToast()
  const params = useParams()
  const studentId = Number(params.id)
  const [editingRecord, setEditingRecord] = useState<YearRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { data: student, error, mutate } = useSWR<Student>(
    batch && studentId ? `/api/students/${studentId}?batch_id=${batch.batch_id}` : null,
    fetcher,
  )

  const form = useForm<YearRecordFeeInput>({
    resolver: zodResolver(yearRecordFeeSchema),
    defaultValues: {
      tuition_fee: 0,
      books_fee: 0,
      bus_fee: 0,
      hostel_fee: 0,
      misc_fee: 0,
    },
  })

  function openEditDialog(record: YearRecord) {
    setEditingRecord(record)
    form.reset({
      tuition_fee: record.tuition_fee,
      books_fee: record.books_fee,
      bus_fee: record.bus_fee,
      hostel_fee: record.hostel_fee,
      misc_fee: record.misc_fee,
    })
  }

  async function saveYearFees(data: YearRecordFeeInput) {
    if (!batch || !editingRecord) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/year-records/${editingRecord.year_record_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, ...data }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Failed to update fees')

      toast({ title: 'Fees updated', description: `Year ${editingRecord.year} fees were updated successfully.` })
      setEditingRecord(null)
      mutate()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update fees',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function downloadStudentReport() {
    if (!batch) return
    try {
      const response = await fetch(
        `/api/reports?batch_id=${batch.batch_id}&student_id=${studentId}&type=student-printable&format=pdf`,
      )
      if (!response.ok) throw new Error('Failed to generate report')
      const blob = await response.blob()
      downloadBlob(`student-fee-report-${studentId}.pdf`, blob)
    } catch {
      toast({ title: 'Error', description: 'Could not generate student report', variant: 'destructive' })
    }
  }

  if (error) return <div className="p-6 text-red-600">Error loading student</div>
  if (!student) return <div className="p-6 text-slate-600">Loading...</div>

  const totalFees = student.year_records.reduce((sum, record) => sum + record.total_fee, 0)
  const totalPaid = student.year_records.reduce((sum, record) => sum + record.paid_amount, 0)
  const totalOutstanding = student.year_records.reduce((sum, record) => sum + record.outstanding_amount, 0)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/students" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Students
        </Link>
        <Button onClick={downloadStudentReport}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF Report
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{`${student.first_name} ${student.last_name}`}</CardTitle>
            <CardDescription>{student.student_id_roll}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm"><span className="font-medium">Department:</span> {student.department}</p>
            <p className="text-sm"><span className="font-medium">Year:</span> {student.year}</p>
            <p className="text-sm"><span className="font-medium">Section:</span> {student.section}</p>
            <p className="text-sm"><span className="font-medium">Email:</span> {student.email || '-'}</p>
            <p className="text-sm"><span className="font-medium">Phone:</span> {student.phone || '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">Total Fees</p>
              <p className="text-2xl font-bold">{formatCurrency(totalFees)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Paid</p>
              <p className="text-xl font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Outstanding</p>
              <p className="text-xl font-semibold text-red-600">{formatCurrency(totalOutstanding)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Year-wise Fee Details</CardTitle>
          <CardDescription>Each student year can have its own custom fee values.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Tuition</TableHead>
                <TableHead>Books</TableHead>
                <TableHead>Bus</TableHead>
                <TableHead>Hostel</TableHead>
                <TableHead>Misc</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {student.year_records.map((record) => (
                <TableRow key={record.year_record_id}>
                  <TableCell className="font-medium">Year {record.year}</TableCell>
                  <TableCell>{formatCurrency(record.tuition_fee)}</TableCell>
                  <TableCell>{formatCurrency(record.books_fee)}</TableCell>
                  <TableCell>{formatCurrency(record.bus_fee)}</TableCell>
                  <TableCell>{formatCurrency(record.hostel_fee)}</TableCell>
                  <TableCell>{formatCurrency(record.misc_fee)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(record.total_fee)}</TableCell>
                  <TableCell className="text-green-600 font-medium">{formatCurrency(record.paid_amount)}</TableCell>
                  <TableCell className="text-red-600 font-medium">{formatCurrency(record.outstanding_amount)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(record.status)}`}>
                      {record.status === 'paid' ? 'Paid' : record.status === 'partially-paid' ? 'Partial' : 'Pending'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(record)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Link href={`/payments?student=${studentId}&year=${record.year_record_id}`}>
                        <Button variant="ghost" size="sm">
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All payments recorded for this student.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {student.payments.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.payments.map((payment) => (
                  <TableRow key={payment.payment_id}>
                    <TableCell className="font-mono">{payment.bill_number}</TableCell>
                    <TableCell className="font-mono">{payment.receipt_number}</TableCell>
                    <TableCell className="font-medium text-green-700">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="capitalize">{payment.payment_method.replaceAll('_', ' ')}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{payment.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-slate-500">No payments recorded for this student yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingRecord !== null} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Year {editingRecord?.year} Fees</DialogTitle>
            <DialogDescription>Update the custom fee values for this student and year.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(saveYearFees)} className="space-y-4">
              {(['tuition_fee', 'books_fee', 'bus_fee', 'hostel_fee', 'misc_fee'] as const).map((fieldName) => (
                <FormField
                  key={fieldName}
                  control={form.control}
                  name={fieldName}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fieldName.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase())}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          value={field.value}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingRecord(null)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Fees'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
