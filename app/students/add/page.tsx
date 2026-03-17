'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { HOSTEL_STATUS, SECTIONS, STUDENT_YEARS } from '@/lib/constants'
import { studentWithYearFeesSchema, type StudentWithYearFeesInput } from '@/lib/schemas'

const emptyYearFees = [1, 2, 3, 4].map((year) => ({
  year,
  tuition_fee: 0,
  books_fee: 0,
  bus_fee: 0,
  hostel_fee: 0,
  misc_fee: 0,
}))

export default function AddStudentPage() {
  const router = useRouter()
  const { batch } = useBatch()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<StudentWithYearFeesInput>({
    resolver: zodResolver(studentWithYearFeesSchema),
    defaultValues: {
      student_id_roll: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      hostel_status: 'day-scholar',
      year: '1',
      section: 'A',
      department: batch?.department ?? 'ECE',
      course: batch?.department ?? 'ECE',
      year_fees: emptyYearFees,
    },
  })

  const { fields } = useFieldArray({
    control: form.control,
    name: 'year_fees',
  })

  async function onSubmit(data: StudentWithYearFeesInput) {
    if (!batch) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.batch_id,
          ...data,
          department: batch.department,
          course: batch.department,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast({ title: 'Error', description: error.error || 'Failed to create student', variant: 'destructive' })
        return
      }

      toast({ title: 'Success', description: 'Student added successfully with yearly fees' })
      router.push('/students')
    } catch {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <Link href="/students" className="mb-6 inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Students
      </Link>

      <Card className="max-w-5xl">
        <CardHeader>
          <CardTitle>Add New Student</CardTitle>
          <CardDescription>Students added here will be saved under the {batch?.department} department.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="student_id_roll"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reg No</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ECE001" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input value={batch?.department ?? ''} disabled />
                  </FormControl>
                </FormItem>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Year</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STUDENT_YEARS.map((year) => (
                            <SelectItem key={year.value} value={year.value}>
                              {year.label}
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
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SECTIONS.map((section) => (
                            <SelectItem key={section.value} value={section.value}>
                              {section.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="9876543210" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="hostel_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hostel Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HOSTEL_STATUS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Year-wise Fees</h3>
                  <p className="text-sm text-slate-600">Set custom fees for all four academic years.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="border-dashed">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Year {index + 1}</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        {(['tuition_fee', 'books_fee', 'bus_fee', 'hostel_fee', 'misc_fee'] as const).map((feeField) => (
                          <FormField
                            key={feeField}
                            control={form.control}
                            name={`year_fees.${index}.${feeField}`}
                            render={({ field: feeInput }) => (
                              <FormItem>
                                <FormLabel>{feeField.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase())}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={feeInput.value}
                                    onChange={(event) => feeInput.onChange(Number(event.target.value))}
                                    disabled={isLoading}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Student'}
                </Button>
                <Link href="/students">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
