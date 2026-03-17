import { NextRequest, NextResponse } from 'next/server'

import { auditOps, paymentOps, studentOps, yearRecordOps } from '@/lib/db'
import { studentSchema } from '@/lib/schemas'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const studentId = Number(id)
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    const student = await studentOps.getById(studentId)

    if (!student || student.batch_id !== batchId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const yearRecords = await yearRecordOps.getByStudent(studentId)
    const payments = await paymentOps.getByStudent(studentId)
    return NextResponse.json({ ...student, year_records: yearRecords, payments })
  } catch (error) {
    console.error('Get student error:', error)
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const studentId = Number(id)
    const body = await request.json()
    const batchId = Number(body.batch_id)

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    const existingStudent = await studentOps.getById(studentId)
    if (!existingStudent || existingStudent.batch_id !== batchId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const parsed = studentSchema.parse(body)
    await studentOps.update(studentId, {
      student_id_roll: parsed.student_id_roll.trim(),
      first_name: parsed.first_name.trim(),
      last_name: parsed.last_name.trim(),
      course: parsed.department,
      department: parsed.department,
      year: parsed.year,
      section: parsed.section.trim(),
      email: parsed.email?.trim() ?? '',
      phone: parsed.phone?.trim() ?? '',
      hostel_status: parsed.hostel_status,
    })

    await auditOps.log(batchId, 'update', 'student', studentId, 'Updated student information')
    return NextResponse.json({ message: 'Student updated successfully' })
  } catch (error) {
    console.error('Update student error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update student'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const studentId = Number(id)
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    const student = await studentOps.getById(studentId)
    if (!student || student.batch_id !== batchId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    await studentOps.delete(studentId)
    await auditOps.log(
      batchId,
      'delete',
      'student',
      studentId,
      `Deleted student ${student.first_name} ${student.last_name}`.trim(),
    )

    return NextResponse.json({ message: 'Student deleted successfully' })
  } catch (error) {
    console.error('Delete student error:', error)
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
