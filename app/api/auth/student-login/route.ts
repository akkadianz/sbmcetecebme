import { NextRequest, NextResponse } from 'next/server'

import { batchOps, studentOps } from '@/lib/db'
import { studentLoginSchema } from '@/lib/schemas'

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = studentLoginSchema.parse(body)

    const batch = await batchOps.getByName(parsed.batchName)
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const students = await studentOps.getByBatch(batch.batch_id, parsed.department)

    const normalizedName = normalize(parsed.student_name)
    const normalizedRoll = parsed.student_id_roll ? normalize(parsed.student_id_roll) : null

    const candidates = students.filter((student) => {
      if (normalizedRoll) return normalize(student.student_id_roll) === normalizedRoll
      const fullName = normalize(`${student.first_name} ${student.last_name}`.trim())
      return fullName === normalizedName
    })

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'Student not found for this batch/department' }, { status: 404 })
    }

    if (!normalizedRoll && candidates.length > 1) {
      return NextResponse.json(
        {
          error: 'Multiple students match this name. Please enter Reg No / Roll No.',
          matches: candidates.map((student) => ({
            student_id: student.student_id,
            student_id_roll: student.student_id_roll,
            name: `${student.first_name} ${student.last_name}`.trim(),
          })),
        },
        { status: 409 },
      )
    }

    const student = candidates[0]
    const phone = String(student.phone ?? '').trim()
    if (!phone) {
      return NextResponse.json({ error: 'Student mobile number is not set. Contact admin.' }, { status: 400 })
    }

    if (normalize(parsed.password) !== normalize(phone)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    return NextResponse.json({
      batch_id: batch.batch_id,
      batch_name: batch.batch_name,
      created_at: batch.created_at,
      department: parsed.department,
      role: 'student',
      student_id: student.student_id,
      student_name: `${student.first_name} ${student.last_name}`.trim(),
    })
  } catch (error) {
    console.error('Student login error:', error)
    const message = error instanceof Error ? error.message : 'Authentication failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

