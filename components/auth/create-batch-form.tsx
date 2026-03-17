'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { batchCreateSchema, BatchCreateInput } from '@/lib/schemas';
import { useBatch } from '@/context/batch-context';
import { useRouter } from 'next/navigation';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export function CreateBatchForm() {
  const router = useRouter();
  const { setBatch } = useBatch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<BatchCreateInput>({
    resolver: zodResolver(batchCreateSchema),
    defaultValues: {
      batchName: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: BatchCreateInput) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/create-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchName: data.batchName,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: 'Creation Failed',
          description: error.error || 'Failed to create batch',
          variant: 'destructive',
        });
        return;
      }

      const batch = await response.json();
      
      // Auto-login to the new batch
      setBatch({
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        department: 'ECE',
        created_at: new Date().toISOString(),
      });

      toast({
        title: 'Success',
        description: `Batch created: ${batch.batch_name}`,
      });

      router.push('/batch-dashboard');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating the batch',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create New Batch</CardTitle>
        <CardDescription>Custom batch creation is currently disabled</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
          <p className="text-sm text-blue-900 font-semibold mb-2">Please use one of the available batches:</p>
          <div className="text-xs text-blue-700 space-y-1">
            <p>• 2023-27</p>
            <p>• 2024-28</p>
            <p>• 2025-29</p>
            <p>• 2026-30</p>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="batchName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., 2023-27" 
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
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
                    <Input 
                      type="password" 
                      placeholder="Minimum 6 characters" 
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Re-enter password" 
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={true}
            >
              Custom Creation Disabled
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
