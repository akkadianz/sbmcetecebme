import { NextRequest, NextResponse } from 'next/server'

import { auditOps, paymentOps, studentOps, yearRecordOps } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const studentId = Number(searchParams.get('student_id'))
    const yearRecordId = Number(searchParams.get('year_record_id'))
    const batchId = Number(searchParams.get('batch_id'))
    const department = searchParams.get('department') as 'ECE' | 'BME' | null

    if (yearRecordId) {
      if (!batchId) {
        return NextResponse.json({ error: 'batch_id is required with year_record_id' }, { status: 400 })
      }
      const yearRecord = await yearRecordOps.getById(yearRecordId)
      if (!yearRecord || yearRecord.batch_id !== batchId) {
        return NextResponse.json({ error: 'Year record not found' }, { status: 404 })
      }
      return NextResponse.json(await paymentOps.getByYearRecord(yearRecordId))
    }

    if (studentId) {
      if (!batchId) {
        return NextResponse.json({ error: 'batch_id is required with student_id' }, { status: 400 })
      }
      const student = await studentOps.getById(studentId)
      if (!student || student.batch_id !== batchId) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }
      return NextResponse.json(await paymentOps.getByStudent(studentId))
    }

    if (batchId) {
      const payments = await paymentOps.getByBatch(batchId)
      if (!department) {
        return NextResponse.json(payments)
      }
      const students = await studentOps.getByBatch(batchId, department)
      const allowedIds = new Set(students.map((student) => student.student_id))
      return NextResponse.json(payments.filter((payment) => allowedIds.has(payment.student_id)))
    }

    return NextResponse.json({ error: 'student_id, year_record_id, or batch_id is required' }, { status: 400 })
  } catch (error) {
    console.error('Get payments error:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const studentId = Number(body.student_id)
    const yearRecordId = Number(body.year_record_id)
    const batchId = Number(body.batch_id)
    const amount = Number(body.amount)
    const billNumber = String(body.bill_number || '')

    if (!studentId || !yearRecordId || !batchId || !amount || !billNumber.trim()) {
      return NextResponse.json(
        { error: 'student_id, year_record_id, batch_id, bill_number, and amount are required' },
        { status: 400 },
      )
    }

    const payment = await paymentOps.create(
      yearRecordId,
      studentId,
      batchId,
      billNumber,
      amount,
      body.payment_method || 'cash',
      body.payment_date || new Date().toISOString().split('T')[0],
      body.reference_number || '',
      body.notes || '',
    )

    await auditOps.log(
      batchId,
      'create',
      'payment',
      studentId,
      `Recorded payment ${amount} with bill ${payment.bill_number}`,
    )

    return NextResponse.json(
      {
        receipt_number: payment.receipt_number,
        bill_number: payment.bill_number,
        message: 'Payment recorded successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Create payment error:', error)
    const message = error instanceof Error ? error.message : 'Failed to record payment'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
