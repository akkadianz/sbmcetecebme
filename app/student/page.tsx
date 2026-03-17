'use client'

import useSWR from 'swr'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBatch } from '@/context/batch-context'
import { formatCurrency } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

type YearRecord = {
  year: number
  total_fee: number
  paid_amount: number
  outstanding_amount: number
  status: string
}

type Payment = {
  payment_id: number
  bill_number: string
  receipt_number: string
  amount: number
  payment_method: string
  payment_date: string
  notes: string
}

type StudentDetail = {
  student_id_roll: string
  first_name: string
  last_name: string
  year: string
  section: string
  department: 'ECE' | 'BME'
  phone: string
  year_records: YearRecord[]
  payments: Payment[]
}

export default function StudentHome() {
  const { batch } = useBatch()
  const studentId = batch?.role === 'student' ? batch.student_id : null

  const { data: student, error } = useSWR<StudentDetail>(
    batch && studentId ? `/api/students/${studentId}?batch_id=${batch.batch_id}` : null,
    fetcher,
  )

  if (batch?.role !== 'student') {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Student Portal</CardTitle>
            <CardDescription>This page is only available for student accounts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-red-600">Failed to load student profile</div>
  }

  if (!student) {
    return <div className="p-6 text-slate-600">Loading...</div>
  }

  const fullName = `${student.first_name} ${student.last_name}`.trim()
  const totalFees = (student.year_records ?? []).reduce((sum, record) => sum + Number(record.total_fee ?? 0), 0)
  const totalPaid = (student.year_records ?? []).reduce((sum, record) => sum + Number(record.paid_amount ?? 0), 0)
  const totalOutstanding = (student.year_records ?? []).reduce((sum, record) => sum + Number(record.outstanding_amount ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-600 mt-1">
          {batch.batch_name} • {student.department}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{fullName}</CardTitle>
            <CardDescription>{student.student_id_roll}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-800">Year:</span> {student.year}
            </p>
            <p>
              <span className="font-medium text-slate-800">Section:</span> {student.section}
            </p>
            <p>
              <span className="font-medium text-slate-800">Mobile:</span> {student.phone || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Fees</CardTitle>
            <CardDescription>All 4 years</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatCurrency(totalFees)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Outstanding</CardTitle>
            <CardDescription>Pending amount</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</CardContent>
          <CardContent className="pt-0 text-sm text-slate-600">
            Paid: <span className="font-semibold text-slate-900">{formatCurrency(totalPaid)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Year-wise Summary</CardTitle>
          <CardDescription>Your fee status per year.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(student.year_records ?? []).map((record) => (
                <TableRow key={record.year}>
                  <TableCell>Year {record.year}</TableCell>
                  <TableCell>{formatCurrency(record.total_fee)}</TableCell>
                  <TableCell className="text-green-700 font-medium">{formatCurrency(record.paid_amount)}</TableCell>
                  <TableCell className="text-red-700 font-medium">{formatCurrency(record.outstanding_amount)}</TableCell>
                  <TableCell className="capitalize">{record.status.replaceAll('_', ' ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All your recorded payments.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {student.payments?.length ? (
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
                    <TableCell className="text-green-700 font-medium">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="capitalize">{payment.payment_method.replaceAll('_', ' ')}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{payment.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-slate-500">No payments recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

