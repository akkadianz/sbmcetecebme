import { supabaseAdmin } from '@/lib/supabaseAdmin'

const ISO_DATE_LENGTH = 10

type BatchRecord = {
  batch_id: number
  batch_name: string
  created_by: string
  created_at: string
}

type StudentRecord = {
  student_id: number
  batch_id: number
  student_id_roll: string
  first_name: string
  last_name: string
  course: 'ECE' | 'BME'
  department: 'ECE' | 'BME'
  year: '1' | '2' | '3' | '4'
  section: string
  email: string
  phone: string
  hostel_status: 'day-scholar' | 'hostel'
  created_at: string
  updated_at: string
}

type YearRecord = {
  year_record_id: number
  student_id: number
  batch_id: number
  year: number
  tuition_fee: number
  books_fee: number
  bus_fee: number
  hostel_fee: number
  misc_fee: number
  total_fee: number
  paid_amount: number
  outstanding_amount: number
  status: 'pending' | 'partially-paid' | 'paid'
  created_at: string
  updated_at: string
}

type PaymentRecord = {
  payment_id: number
  year_record_id: number
  student_id: number
  batch_id: number
  bill_number: string
  receipt_number: string
  amount: number
  payment_method: string
  payment_date: string
  reference_number: string
  notes: string
}

type AttendanceRecord = {
  attendance_id: number
  batch_id: number
  student_id: number
  date: string
  present: boolean
  created_at: string
  updated_at: string
}

type AttendanceSettingsRecord = {
  batch_id: number
  month: string
  exclude_weekends: boolean
  holidays: string[]
  updated_at: string
}

function toMonthRange(month: string) {
  const [yearString, monthString] = month.split('-')
  const year = Number(yearString)
  const monthIndex = Number(monthString) - 1

  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('Invalid month format. Expected YYYY-MM')
  }

  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 1))

  return {
    start: start.toISOString().slice(0, ISO_DATE_LENGTH),
    end: end.toISOString().slice(0, ISO_DATE_LENGTH),
  }
}

function sumFees(fees: Pick<YearRecord, 'tuition_fee' | 'books_fee' | 'bus_fee' | 'hostel_fee' | 'misc_fee'>) {
  return fees.tuition_fee + fees.books_fee + fees.bus_fee + fees.hostel_fee + fees.misc_fee
}

function createYearRecordInsert(
  batchId: number,
  studentId: number,
  fees: {
    year: number
    tuition_fee: number
    books_fee: number
    bus_fee: number
    hostel_fee: number
    misc_fee: number
  },
) {
  const timestamp = new Date().toISOString()
  const totalFee = sumFees(fees)

  return {
    student_id: studentId,
    batch_id: batchId,
    year: fees.year,
    tuition_fee: fees.tuition_fee,
    books_fee: fees.books_fee,
    bus_fee: fees.bus_fee,
    hostel_fee: fees.hostel_fee,
    misc_fee: fees.misc_fee,
    total_fee: totalFee,
    paid_amount: 0,
    outstanding_amount: totalFee,
    status: 'pending',
    created_at: timestamp,
    updated_at: timestamp,
  }
}

function recalculateYearRecord(record: YearRecord) {
  record.total_fee = sumFees(record)
  record.outstanding_amount = Math.max(0, record.total_fee - record.paid_amount)
  record.status = record.paid_amount >= record.total_fee ? 'paid' : record.paid_amount > 0 ? 'partially-paid' : 'pending'
  record.updated_at = new Date().toISOString()
}

function ensureData<T>(data: T | null, message: string) {
  if (!data) throw new Error(message)
  return data
}

export const batchOps = {
  create: async (name: string, createdBy: string) => {
    const { data, error } = await supabaseAdmin
      .from('batches')
      .insert({ batch_name: name, created_by: createdBy })
      .select('batch_id')
      .single()

    if (error) throw error
    return data.batch_id
  },

  getByName: async (name: string) => {
    const { data, error } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('batch_name', name)
      .maybeSingle()

    if (error) throw error
    return data as BatchRecord | null
  },

  getById: async (id: number) => {
    const { data, error } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('batch_id', id)
      .maybeSingle()

    if (error) throw error
    return data as BatchRecord | null
  },
}

export const studentOps = {
  create: async (
    batchId: number,
    studentData: Omit<StudentRecord, 'student_id' | 'batch_id' | 'created_at' | 'updated_at'> & {
      year_fees: Array<{
        year: number
        tuition_fee: number
        books_fee: number
        bus_fee: number
        hostel_fee: number
        misc_fee: number
      }>
    },
  ) => {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('students')
      .select('student_id')
      .eq('batch_id', batchId)
      .eq('department', studentData.department)
      .ilike('student_id_roll', studentData.student_id_roll)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) {
      throw new Error('Student roll number already exists in this department')
    }

    const timestamp = new Date().toISOString()
    const { year_fees, ...baseStudentData } = studentData

    const { data: studentInsert, error: insertError } = await supabaseAdmin
      .from('students')
      .insert({
        batch_id: batchId,
        created_at: timestamp,
        updated_at: timestamp,
        ...baseStudentData,
      })
      .select('student_id')
      .single()

    if (insertError) throw insertError

    const studentId = studentInsert.student_id
    const yearRecords = year_fees
      .sort((left, right) => left.year - right.year)
      .map((fees) => createYearRecordInsert(batchId, studentId, fees))

    const { error: yearError } = await supabaseAdmin.from('year_records').insert(yearRecords)
    if (yearError) throw yearError

    return studentId
  },

  getByBatch: async (batchId: number, department?: 'ECE' | 'BME') => {
    let query = supabaseAdmin.from('students').select('*').eq('batch_id', batchId)
    if (department) query = query.eq('department', department)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as StudentRecord[]
  },

  getById: async (id: number) => {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('*')
      .eq('student_id', id)
      .maybeSingle()

    if (error) throw error
    return data as StudentRecord | null
  },

  update: async (id: number, updates: Partial<StudentRecord>) => {
    const { data, error } = await supabaseAdmin
      .from('students')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('student_id', id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    return data as StudentRecord | null
  },

  delete: async (id: number) => {
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('batch_id')
      .eq('student_id', id)
      .maybeSingle()

    if (studentError) throw studentError
    if (!student) return

    const batchId = student.batch_id

    const { error: yearError } = await supabaseAdmin.from('year_records').delete().eq('student_id', id)
    if (yearError) throw yearError

    const { error: paymentError } = await supabaseAdmin.from('payments').delete().eq('student_id', id)
    if (paymentError) throw paymentError

    const { error: studentDeleteError } = await supabaseAdmin
      .from('students')
      .delete()
      .eq('student_id', id)

    if (studentDeleteError) throw studentDeleteError

    const { error: auditError } = await supabaseAdmin.from('audit_logs').delete().eq('batch_id', batchId)
    if (auditError) throw auditError
  },
}

export const yearRecordOps = {
  getByStudent: async (studentId: number) => {
    const { data, error } = await supabaseAdmin
      .from('year_records')
      .select('*')
      .eq('student_id', studentId)
      .order('year', { ascending: true })

    if (error) throw error
    return (data ?? []) as YearRecord[]
  },

  getById: async (id: number) => {
    const { data, error } = await supabaseAdmin
      .from('year_records')
      .select('*')
      .eq('year_record_id', id)
      .maybeSingle()

    if (error) throw error
    return data as YearRecord | null
  },

  getByBatch: async (batchId: number) => {
    const { data, error } = await supabaseAdmin
      .from('year_records')
      .select('*')
      .eq('batch_id', batchId)

    if (error) throw error
    return (data ?? []) as YearRecord[]
  },

  update: async (id: number, updates: Partial<YearRecord>) => {
    const { data: current, error: currentError } = await supabaseAdmin
      .from('year_records')
      .select('*')
      .eq('year_record_id', id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return null

    const record = { ...current, ...updates } as YearRecord
    recalculateYearRecord(record)

    const { data, error } = await supabaseAdmin
      .from('year_records')
      .update({
        tuition_fee: record.tuition_fee,
        books_fee: record.books_fee,
        bus_fee: record.bus_fee,
        hostel_fee: record.hostel_fee,
        misc_fee: record.misc_fee,
        total_fee: record.total_fee,
        paid_amount: record.paid_amount,
        outstanding_amount: record.outstanding_amount,
        status: record.status,
        updated_at: record.updated_at,
      })
      .eq('year_record_id', id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    return data as YearRecord | null
  },
}

export const paymentOps = {
  create: async (
    yearRecordId: number,
    studentId: number,
    batchId: number,
    billNumber: string,
    amount: number,
    paymentMethod: string,
    paymentDate: string,
    referenceNumber: string,
    notes: string,
  ) => {
    const { data: yearRecord, error: yearError } = await supabaseAdmin
      .from('year_records')
      .select('*')
      .eq('year_record_id', yearRecordId)
      .maybeSingle()

    if (yearError) throw yearError
    const record = ensureData(yearRecord as YearRecord | null, 'Year record not found')

    if (!billNumber.trim()) throw new Error('Bill number is required')
    if (amount <= 0) throw new Error('Payment amount must be greater than 0')
    if (amount > record.outstanding_amount) throw new Error('Payment exceeds outstanding amount')
    if (record.batch_id !== batchId || record.student_id !== studentId) {
      throw new Error('Payment record does not belong to the selected student or batch')
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('payments')
      .select('payment_id')
      .eq('batch_id', batchId)
      .ilike('bill_number', billNumber.trim())
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) throw new Error('Bill number already exists')

    const { data: receiptData, error: receiptError } = await supabaseAdmin
      .rpc('next_receipt_number', { batch_id_input: batchId })

    if (receiptError) throw receiptError

    const receiptNumber = String(receiptData)

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        year_record_id: yearRecordId,
        student_id: studentId,
        batch_id: batchId,
        bill_number: billNumber.trim(),
        receipt_number: receiptNumber,
        amount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: referenceNumber,
        notes,
      })
      .select('*')
      .single()

    if (paymentError) throw paymentError

    const updatedPaid = record.paid_amount + amount
    const updated = {
      ...record,
      paid_amount: updatedPaid,
    }
    recalculateYearRecord(updated)

    const { error: updateError } = await supabaseAdmin
      .from('year_records')
      .update({
        paid_amount: updated.paid_amount,
        total_fee: updated.total_fee,
        outstanding_amount: updated.outstanding_amount,
        status: updated.status,
        updated_at: updated.updated_at,
      })
      .eq('year_record_id', yearRecordId)

    if (updateError) throw updateError

    return payment as PaymentRecord
  },

  getByStudent: async (studentId: number) => {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false })

    if (error) throw error
    return (data ?? []) as PaymentRecord[]
  },

  getByYearRecord: async (yearRecordId: number) => {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('year_record_id', yearRecordId)
      .order('payment_date', { ascending: false })

    if (error) throw error
    return (data ?? []) as PaymentRecord[]
  },

  getByBatch: async (batchId: number) => {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('batch_id', batchId)
      .order('payment_date', { ascending: false })

    if (error) throw error
    return (data ?? []) as PaymentRecord[]
  },
}

export const settingsOps = {
  getByBatch: async (_batchId: number) => ({}),
  upsert: async (_batchId: number, _feeStructure: unknown) => {},
}

export const auditOps = {
  log: async (batchId: number, action: string, entityType: string, entityId: number, details: string) => {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      batch_id: batchId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      timestamp: new Date().toISOString(),
    })

    if (error) throw error
  },

  getByBatch: async (batchId: number) => {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('batch_id', batchId)
      .order('timestamp', { ascending: false })

    if (error) throw error
    return (data ?? []) as Array<Record<string, unknown> & { batch_id: number }>
  },
}

export const attendanceOps = {
  getByBatchMonth: async (batchId: number, month: string) => {
    const { start, end } = toMonthRange(month)
    const { data, error } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('batch_id', batchId)
      .gte('date', start)
      .lt('date', end)

    if (error) throw error
    return (data ?? []) as AttendanceRecord[]
  },

  upsert: async (batchId: number, studentId: number, date: string, present: boolean) => {
    const timestamp = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('attendance_records')
      .upsert(
        {
          batch_id: batchId,
          student_id: studentId,
          date,
          present,
          updated_at: timestamp,
          created_at: timestamp,
        },
        { onConflict: 'batch_id,student_id,date' },
      )

    if (error) throw error
  },

  remove: async (batchId: number, studentId: number, date: string) => {
    const { error } = await supabaseAdmin
      .from('attendance_records')
      .delete()
      .eq('batch_id', batchId)
      .eq('student_id', studentId)
      .eq('date', date)

    if (error) throw error
  },
}

export const attendanceSettingsOps = {
  getByBatchMonth: async (batchId: number, month: string) => {
    const { data, error } = await supabaseAdmin
      .from('attendance_settings')
      .select('*')
      .eq('batch_id', batchId)
      .eq('month', month)
      .maybeSingle()

    if (error) throw error
    return (
      (data as AttendanceSettingsRecord | null) ?? {
        batch_id: batchId,
        month,
        exclude_weekends: true,
        holidays: [],
        updated_at: new Date().toISOString(),
      }
    )
  },

  upsert: async (batchId: number, month: string, updates: Partial<AttendanceSettingsRecord>) => {
    const timestamp = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('attendance_settings')
      .upsert(
        {
          batch_id: batchId,
          month,
          exclude_weekends: updates.exclude_weekends ?? true,
          holidays: updates.holidays ?? [],
          updated_at: timestamp,
        },
        { onConflict: 'batch_id,month' },
      )

    if (error) throw error
  },
}

export const backupOps = {
  exportBatch: async (batchId: number) => {
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('batch_id', batchId)
      .maybeSingle()

    if (batchError) throw batchError

    const [students, yearRecords, payments, auditLogs, attendanceRecords, attendanceSettings] = await Promise.all([
      supabaseAdmin.from('students').select('*').eq('batch_id', batchId),
      supabaseAdmin.from('year_records').select('*').eq('batch_id', batchId),
      supabaseAdmin.from('payments').select('*').eq('batch_id', batchId),
      supabaseAdmin.from('audit_logs').select('*').eq('batch_id', batchId),
      supabaseAdmin.from('attendance_records').select('*').eq('batch_id', batchId),
      supabaseAdmin.from('attendance_settings').select('*').eq('batch_id', batchId),
    ])

    if (students.error) throw students.error
    if (yearRecords.error) throw yearRecords.error
    if (payments.error) throw payments.error
    if (auditLogs.error) throw auditLogs.error
    if (attendanceRecords.error) throw attendanceRecords.error
    if (attendanceSettings.error) throw attendanceSettings.error

    return {
      exported_at: new Date().toISOString(),
      batch: (batch as BatchRecord | null) ?? null,
      students: students.data ?? [],
      year_records: yearRecords.data ?? [],
      payments: payments.data ?? [],
      audit_logs: auditLogs.data ?? [],
      attendance_records: attendanceRecords.data ?? [],
      attendance_settings: attendanceSettings.data ?? [],
    }
  },

  restoreBatch: async (
    batchId: number,
    backup: {
      batch?: BatchRecord | null
      students?: StudentRecord[]
      year_records?: YearRecord[]
      payments?: PaymentRecord[]
      audit_logs?: Array<Record<string, unknown> & { batch_id: number }>
      attendance_records?: AttendanceRecord[]
      attendance_settings?: AttendanceSettingsRecord[]
    },
  ) => {
    const tablesToClear = [
      supabaseAdmin.from('students').delete().eq('batch_id', batchId),
      supabaseAdmin.from('year_records').delete().eq('batch_id', batchId),
      supabaseAdmin.from('payments').delete().eq('batch_id', batchId),
      supabaseAdmin.from('audit_logs').delete().eq('batch_id', batchId),
      supabaseAdmin.from('attendance_records').delete().eq('batch_id', batchId),
      supabaseAdmin.from('attendance_settings').delete().eq('batch_id', batchId),
    ]

    const clearResults = await Promise.all(tablesToClear)
    const clearError = clearResults.find((result) => result.error)?.error
    if (clearError) throw clearError

    if (backup.batch) {
      const { error } = await supabaseAdmin
        .from('batches')
        .upsert({ ...backup.batch, batch_id: batchId }, { onConflict: 'batch_id' })
      if (error) throw error
    }

    const insertIfAny = async (table: string, rows?: Array<Record<string, unknown>>) => {
      if (!rows || rows.length === 0) return
      const { error } = await supabaseAdmin.from(table).insert(rows)
      if (error) throw error
    }

    await insertIfAny('students', backup.students)
    await insertIfAny('year_records', backup.year_records)
    await insertIfAny('payments', backup.payments)
    await insertIfAny('audit_logs', backup.audit_logs)
    await insertIfAny('attendance_records', backup.attendance_records)
    await insertIfAny('attendance_settings', backup.attendance_settings)

    const { error: resetError } = await supabaseAdmin.rpc('reset_sequences')
    if (resetError) throw resetError
  },
}


