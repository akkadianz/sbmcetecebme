import { NextRequest, NextResponse } from 'next/server'

import { auditOps, studentOps } from '@/lib/db'
import { studentWithYearFeesSchema } from '@/lib/schemas'

export async function GET(request: NextRequest) {
  try {
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))
    const department = request.nextUrl.searchParams.get('department') as 'ECE' | 'BME' | null

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    const students = await studentOps.getByBatch(batchId, department ?? undefined)
    return NextResponse.json(students)
  } catch (error) {
    console.error('Get students error:', error)
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    const parsed = studentWithYearFeesSchema.parse(body)
    const studentId = await studentOps.create(batchId, {
      student_id_roll: parsed.student_id_roll.trim(),
      first_name: parsed.first_name.trim(),
      last_name: parsed.last_name.trim(),
      email: parsed.email?.trim() ?? '',
      phone: parsed.phone?.trim() ?? '',
      hostel_status: parsed.hostel_status,
      year: parsed.year,
      section: parsed.section.trim(),
      department: parsed.department,
      course: parsed.department,
      year_fees: parsed.year_fees,
    })

    await auditOps.log(
      batchId,
      'create',
      'student',
      studentId,
      `Created student ${parsed.first_name} ${parsed.last_name}`.trim(),
    )

    return NextResponse.json({ student_id: studentId, message: 'Student created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Create student error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create student'
    const status = message.includes('already exists') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
