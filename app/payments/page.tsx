'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import useSWR from 'swr'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { PAYMENT_METHODS } from '@/lib/constants'
import { paymentSchema, type PaymentInput } from '@/lib/schemas'
import { formatCurrency } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

interface YearRecord {
  year_record_id: number
  year: number
  outstanding_amount: number
  status: string
}

interface Student {
  student_id: number
  student_id_roll: string
  first_name: string
  last_name: string
}

interface StudentDetail extends Student {
  year_records: YearRecord[]
}

interface Payment {
  payment_id: number
  bill_number: string
  receipt_number: string
  amount: number
  payment_method: string
  payment_date: string
}

export default function PaymentsPage() {
  const searchParams = useSearchParams()
  const { batch } = useBatch()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const { data: students = [] } = useSWR<Student[]>(
    batch ? `/api/students?batch_id=${batch.batch_id}&department=${batch.department}` : null,
    fetcher,
  )

  const { data: selectedStudentData } = useSWR<StudentDetail>(
    batch && selectedStudent ? `/api/students/${selectedStudent}?batch_id=${batch.batch_id}` : null,
    fetcher,
  )

  const selectedYearData = useMemo(
    () => selectedStudentData?.year_records.find((record) => record.year_record_id === selectedYear) ?? null,
    [selectedStudentData, selectedYear],
  )

  const { data: payments = [], mutate: mutatePayments } = useSWR<Payment[]>(
    batch
      ? selectedYear
        ? `/api/payments?year_record_id=${selectedYear}&batch_id=${batch.batch_id}`
        : `/api/payments?batch_id=${batch.batch_id}&department=${batch.department}`
      : null,
    fetcher,
  )

  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      bill_number: '',
      amount: 0,
      payment_method: '',
      payment_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  })

  useEffect(() => {
    if (!students.length) return
    const studentFromQuery = Number(searchParams.get('student'))
    const yearFromQuery = Number(searchParams.get('year'))
    if (studentFromQuery && students.some((student) => student.student_id === studentFromQuery)) setSelectedStudent(studentFromQuery)
    if (yearFromQuery) setSelectedYear(yearFromQuery)
  }, [students, searchParams])

  async function onSubmit(data: PaymentInput) {
    if (!batch || !selectedStudent || !selectedYear || !selectedYearData) {
      toast({ title: 'Error', description: 'Please select a student and year', variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent,
          year_record_id: selectedYear,
          batch_id: batch.batch_id,
          ...data,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast({ title: 'Error', description: result.error || 'Failed to record payment', variant: 'destructive' })
        return
      }

      toast({
        title: 'Success',
        description: `Payment recorded. Bill: ${result.bill_number} | Receipt: ${result.receipt_number}`,
      })

      form.reset({
        bill_number: '',
        amount: 0,
        payment_method: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
      })
      mutatePayments()
    } catch {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Payments</h1>
        <p className="text-slate-600 mt-1">Record {batch?.department} student fee payments</p>
      </div>

      <Tabs defaultValue="record" className="space-y-6">
        <TabsList>
          <TabsTrigger value="record">Record Payment</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle>Record Payment</CardTitle>
              <CardDescription>Add a payment with your manual bill number</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium">Select Student</label>
                  <Select
                    value={selectedStudent?.toString() || ''}
                    onValueChange={(value) => {
                      setSelectedStudent(Number(value))
                      setSelectedYear(null)
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.student_id} value={student.student_id.toString()}>
                          {student.student_id_roll} - {student.first_name} {student.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Select Fee Year</label>
                  <Select
                    value={selectedYear?.toString() || ''}
                    onValueChange={(value) => setSelectedYear(Number(value))}
                    disabled={!selectedStudentData}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a year" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedStudentData?.year_records.map((record) => (
                        <SelectItem key={record.year_record_id} value={record.year_record_id.toString()}>
                          Year {record.year} - {formatCurrency(record.outstanding_amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedYearData ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-lg border bg-slate-50 p-4 text-sm">
                    <p><span className="font-medium">Outstanding:</span> {formatCurrency(selectedYearData.outstanding_amount)}</p>
                    <p><span className="font-medium">Status:</span> {selectedYearData.status}</p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="bill_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bill Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter bill number" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max={selectedYearData.outstanding_amount}
                                placeholder="0"
                                value={field.value || ''}
                                onChange={(event) => field.onChange(Number(event.target.value))}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="payment_method"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Method</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PAYMENT_METHODS.map((method) => (
                                  <SelectItem key={method.value} value={method.value}>
                                    {method.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="payment_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Add any notes..." {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Recording...' : 'Record Payment'}
                      </Button>
                    </form>
                  </Form>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>{selectedYear ? 'Payments for the selected year record' : 'All recorded payments in this batch'}</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill #</TableHead>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.payment_id}>
                          <TableCell className="font-mono">{payment.bill_number}</TableCell>
                          <TableCell className="font-mono">{payment.receipt_number}</TableCell>
                          <TableCell>{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="capitalize">{payment.payment_method.replaceAll('_', ' ')}</TableCell>
                          <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">No payments recorded yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
