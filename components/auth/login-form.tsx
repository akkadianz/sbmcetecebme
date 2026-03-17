'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { DEPARTMENTS } from '@/lib/constants'
import { batchLoginSchema, studentLoginSchema, type BatchLoginInput, type StudentLoginInput } from '@/lib/schemas'

const AVAILABLE_BATCHES = [
  { label: '2023-27', value: '2023-27' },
  { label: '2024-28', value: '2024-28' },
  { label: '2025-29', value: '2025-29' },
  { label: '2026-30', value: '2026-30' },
]

export function LoginForm() {
  const router = useRouter()
  const { setBatch } = useBatch()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const adminForm = useForm<BatchLoginInput>({
    resolver: zodResolver(batchLoginSchema),
    defaultValues: {
      batchName: '',
      department: 'ECE',
      password: '',
    },
  })

  const studentForm = useForm<StudentLoginInput>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: {
      batchName: '',
      department: 'ECE',
      student_name: '',
      student_id_roll: '',
      password: '',
    },
  })

  async function onAdminSubmit(role: 'admin' | 'staff', data: BatchLoginInput) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        toast({
          title: 'Login Failed',
          description: error.error || 'Invalid batch name or password',
          variant: 'destructive',
        })
        return
      }

      const batch = await response.json()
      setBatch({ ...batch, department: data.department, role })
      toast({
        title: 'Success',
        description: `Logged in as ${role} (${data.department} - ${batch.batch_name})`,
      })
      router.push('/batch-dashboard')
    } catch {
      toast({
        title: 'Error',
        description: 'An error occurred during login',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function onStudentSubmit(data: StudentLoginInput) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      if (!response.ok) {
        toast({
          title: 'Login Failed',
          description: result.error || 'Invalid username or password',
          variant: 'destructive',
        })
        return
      }

      setBatch(result)
      toast({
        title: 'Welcome',
        description: `Logged in as student (${result.student_name})`,
      })
      router.push('/student')
    } catch {
      toast({
        title: 'Error',
        description: 'An error occurred during login',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Student Management System</CardTitle>
        <CardDescription>Login as admin, staff, or student</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="admin" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="student">Student</TabsTrigger>
          </TabsList>

          {(['admin', 'staff'] as const).map((role) => (
            <TabsContent key={role} value={role}>
              <Form {...adminForm}>
                <form onSubmit={adminForm.handleSubmit((data) => onAdminSubmit(role, data))} className="space-y-4">
                  <FormField
                    control={adminForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DEPARTMENTS.map((department) => (
                              <SelectItem key={department.value} value={department.value}>
                                {department.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={adminForm.control}
                    name="batchName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Batch</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a batch..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AVAILABLE_BATCHES.map((batch) => (
                              <SelectItem key={batch.value} value={batch.value}>
                                {batch.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={adminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter password" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Logging in...' : `Login as ${role}`}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          ))}

          <TabsContent value="student">
            <Form {...studentForm}>
              <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-4">
                <FormField
                  control={studentForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEPARTMENTS.map((department) => (
                            <SelectItem key={department.value} value={department.value}>
                              {department.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={studentForm.control}
                  name="batchName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Batch</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a batch..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AVAILABLE_BATCHES.map((batch) => (
                            <SelectItem key={batch.value} value={batch.value}>
                              {batch.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={studentForm.control}
                  name="student_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username (Student Name)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={studentForm.control}
                  name="student_id_roll"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reg No / Roll No (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Use if name is common" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={studentForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (Mobile Number)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your mobile number" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Logging in...' : 'Login as student'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
