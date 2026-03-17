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
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { DEPARTMENTS } from '@/lib/constants'
import { batchLoginSchema, type BatchLoginInput } from '@/lib/schemas'

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

  const form = useForm<BatchLoginInput>({
    resolver: zodResolver(batchLoginSchema),
    defaultValues: {
      batchName: '',
      department: 'ECE',
      password: '',
    },
  })

  async function onSubmit(data: BatchLoginInput) {
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
      setBatch({ ...batch, department: data.department })
      toast({
        title: 'Success',
        description: `Logged into ${data.department} - ${batch.batch_name}`,
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

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Student Management System</CardTitle>
        <CardDescription>Login to your batch department account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
