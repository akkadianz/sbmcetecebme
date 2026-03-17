import { z } from 'zod'

export const departmentSchema = z.enum(['ECE', 'BME'])

export const batchLoginSchema = z.object({
  batchName: z.string().min(1, 'Batch name is required'),
  department: departmentSchema,
  password: z.string().min(1, 'Password is required'),
})

export type BatchLoginInput = z.infer<typeof batchLoginSchema>

export const batchCreateSchema = z.object({
  batchName: z.string().min(4, 'Batch name must be at least 4 characters'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type BatchCreateInput = z.infer<typeof batchCreateSchema>

export const studentSchema = z.object({
  student_id_roll: z.string().min(1, 'Student ID/Roll is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  hostel_status: z.enum(['day-scholar', 'hostel']),
  year: z.enum(['1', '2', '3', '4']),
  section: z.string().min(1, 'Section is required'),
  department: departmentSchema,
  course: departmentSchema.optional(),
})

export type StudentInput = z.infer<typeof studentSchema>

export const yearFeeEntrySchema = z.object({
  year: z.number().int().min(1).max(4),
  tuition_fee: z.number().min(0, 'Must be non-negative'),
  books_fee: z.number().min(0, 'Must be non-negative'),
  bus_fee: z.number().min(0, 'Must be non-negative'),
  hostel_fee: z.number().min(0, 'Must be non-negative'),
  misc_fee: z.number().min(0, 'Must be non-negative'),
})

export type YearFeeEntryInput = z.infer<typeof yearFeeEntrySchema>

export const studentWithYearFeesSchema = studentSchema.extend({
  year_fees: z.array(yearFeeEntrySchema).length(4, 'Fees for all 4 years are required'),
})

export type StudentWithYearFeesInput = z.infer<typeof studentWithYearFeesSchema>

export const yearRecordFeeSchema = z.object({
  tuition_fee: z.number().min(0, 'Must be non-negative'),
  books_fee: z.number().min(0, 'Must be non-negative'),
  bus_fee: z.number().min(0, 'Must be non-negative'),
  hostel_fee: z.number().min(0, 'Must be non-negative'),
  misc_fee: z.number().min(0, 'Must be non-negative'),
})

export type YearRecordFeeInput = z.infer<typeof yearRecordFeeSchema>

export const paymentSchema = z.object({
  bill_number: z.string().min(1, 'Bill number is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  fee_type: z.string().optional(),
  payment_method: z.string().min(1, 'Payment method is required'),
  payment_date: z.string().min(1, 'Payment date is required'),
  notes: z.string().optional(),
})

export type PaymentInput = z.infer<typeof paymentSchema>
