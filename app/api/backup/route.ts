import { NextRequest, NextResponse } from 'next/server'

import { backupOps, batchOps } from '@/lib/db'

type BackupPayload = {
  exported_at?: string
  batch?: Record<string, unknown> | null
  students?: Array<Record<string, unknown>>
  year_records?: Array<Record<string, unknown>>
  payments?: Array<Record<string, unknown>>
  audit_logs?: Array<Record<string, unknown>>
  attendance_records?: Array<Record<string, unknown>>
  attendance_settings?: Array<Record<string, unknown>>
}

type BackupValidation = {
  errors: string[]
  warnings: string[]
  summary: {
    exported_at: string | null
    has_batch: boolean
    students: number
    year_records: number
    payments: number
    audit_logs: number
    attendance_records: number
    attendance_settings: number
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toArray(value: unknown): Array<Record<string, unknown>> | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  return value.filter(isObject)
}

function validateBackupPayload(backup: BackupPayload): BackupValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isObject(backup)) {
    return {
      errors: ['Backup file is not a valid JSON object.'],
      warnings: [],
      summary: {
        exported_at: null,
        has_batch: false,
        students: 0,
        year_records: 0,
        payments: 0,
        audit_logs: 0,
        attendance_records: 0,
        attendance_settings: 0,
      },
    }
  }

  const students = toArray(backup.students)
  const yearRecords = toArray(backup.year_records)
  const payments = toArray(backup.payments)
  const auditLogs = toArray(backup.audit_logs)
  const attendanceRecords = toArray(backup.attendance_records)
  const attendanceSettings = toArray(backup.attendance_settings)

  if (students === null) errors.push('students must be an array.')
  if (yearRecords === null) errors.push('year_records must be an array.')
  if (payments === null) errors.push('payments must be an array.')
  if (auditLogs === null) errors.push('audit_logs must be an array.')
  if (attendanceRecords === null) errors.push('attendance_records must be an array.')
  if (attendanceSettings === null) errors.push('attendance_settings must be an array.')

  const safeStudents = students ?? []
  const safeYearRecords = yearRecords ?? []
  const safePayments = payments ?? []
  const safeAuditLogs = auditLogs ?? []
  const safeAttendance = attendanceRecords ?? []
  const safeAttendanceSettings = attendanceSettings ?? []

  const studentIdSet = new Set<number>()
  const regNoSet = new Set<string>()
  const yearRecordIdSet = new Set<number>()
  const receiptSet = new Set<string>()

  safeStudents.forEach((student, index) => {
    const studentId = Number(student.student_id)
    const regNo = String(student.student_id_roll ?? '').trim()
    const firstName = String(student.first_name ?? '').trim()
    const lastName = String(student.last_name ?? '').trim()
    const year = String(student.year ?? '').trim()
    const section = String(student.section ?? '').trim()
    const department = String(student.department ?? '').trim()

    if (!Number.isFinite(studentId)) errors.push(`students[${index}].student_id is invalid.`)
    if (!regNo) errors.push(`students[${index}].student_id_roll is missing.`)
    if (!firstName) errors.push(`students[${index}].first_name is missing.`)
    if (!lastName) errors.push(`students[${index}].last_name is missing.`)
    if (!['1', '2', '3', '4'].includes(year)) errors.push(`students[${index}].year is invalid.`)
    if (!section) errors.push(`students[${index}].section is missing.`)
    if (!['ECE', 'BME'].includes(department)) errors.push(`students[${index}].department is invalid.`)

    if (Number.isFinite(studentId)) studentIdSet.add(studentId)
    if (regNo) {
      if (regNoSet.has(regNo)) warnings.push(`Duplicate student_id_roll detected: ${regNo}.`)
      regNoSet.add(regNo)
    }
  })

  safeYearRecords.forEach((record, index) => {
    const recordId = Number(record.year_record_id)
    const studentId = Number(record.student_id)
    const year = Number(record.year)

    if (!Number.isFinite(recordId)) errors.push(`year_records[${index}].year_record_id is invalid.`)
    if (!Number.isFinite(studentId)) errors.push(`year_records[${index}].student_id is invalid.`)
    if (!Number.isFinite(year) || year < 1 || year > 4) errors.push(`year_records[${index}].year is invalid.`)
    if (Number.isFinite(studentId) && !studentIdSet.has(studentId)) {
      errors.push(`year_records[${index}] references missing student_id ${studentId}.`)
    }
    if (Number.isFinite(recordId)) yearRecordIdSet.add(recordId)
  })

  safePayments.forEach((payment, index) => {
    const paymentId = Number(payment.payment_id)
    const recordId = Number(payment.year_record_id)
    const amount = Number(payment.amount)
    const receipt = String(payment.receipt_number ?? '').trim()

    if (!Number.isFinite(paymentId)) errors.push(`payments[${index}].payment_id is invalid.`)
    if (!Number.isFinite(recordId)) errors.push(`payments[${index}].year_record_id is invalid.`)
    if (Number.isFinite(recordId) && !yearRecordIdSet.has(recordId)) {
      errors.push(`payments[${index}] references missing year_record_id ${recordId}.`)
    }
    if (!Number.isFinite(amount) || amount <= 0) errors.push(`payments[${index}].amount is invalid.`)
    if (receipt) {
      if (receiptSet.has(receipt)) warnings.push(`Duplicate receipt_number detected: ${receipt}.`)
      receiptSet.add(receipt)
    }
  })

  safeAttendance.forEach((record, index) => {
    const studentId = Number(record.student_id)
    const date = String(record.date ?? '').trim()
    if (!Number.isFinite(studentId)) errors.push(`attendance_records[${index}].student_id is invalid.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`attendance_records[${index}].date is invalid.`)
    if (Number.isFinite(studentId) && !studentIdSet.has(studentId)) {
      errors.push(`attendance_records[${index}] references missing student_id ${studentId}.`)
    }
  })

  safeAttendanceSettings.forEach((record, index) => {
    const month = String(record.month ?? '').trim()
    const holidays = record.holidays
    if (!/^\d{4}-\d{2}$/.test(month)) errors.push(`attendance_settings[${index}].month is invalid.`)
    if (holidays !== undefined && !Array.isArray(holidays)) errors.push(`attendance_settings[${index}].holidays must be an array.`)
  })

  if (!backup.exported_at) warnings.push('exported_at is missing.')
  if (!backup.batch) warnings.push('batch metadata is missing.')

  return {
    errors,
    warnings,
    summary: {
      exported_at: typeof backup.exported_at === 'string' ? backup.exported_at : null,
      has_batch: Boolean(backup.batch),
      students: safeStudents.length,
      year_records: safeYearRecords.length,
      payments: safePayments.length,
      audit_logs: safeAuditLogs.length,
      attendance_records: safeAttendance.length,
      attendance_settings: safeAttendanceSettings.length,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    const batch = await batchOps.getById(batchId)
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const backup = await backupOps.exportBatch(batchId)
    return NextResponse.json(backup)
  } catch (error) {
    console.error('Backup export error:', error)
    return NextResponse.json({ error: 'Failed to export backup' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)
    const preview = Boolean(body.preview)

    if (!batchId || !body.backup) {
      return NextResponse.json({ error: 'batch_id and backup are required' }, { status: 400 })
    }

    const batch = await batchOps.getById(batchId)
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const validation = validateBackupPayload(body.backup as BackupPayload)
    if (validation.errors.length) {
      return NextResponse.json({ error: 'Backup validation failed', details: validation }, { status: 422 })
    }

    if (preview) {
      return NextResponse.json({ message: 'Backup preview ready', details: validation })
    }

    await backupOps.restoreBatch(batchId, body.backup)
    return NextResponse.json({ message: 'Backup restored successfully', details: validation })
  } catch (error) {
    console.error('Backup restore error:', error)
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 })
  }
}
