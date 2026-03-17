import { NextRequest, NextResponse } from 'next/server'

import { auditOps, studentOps, yearRecordOps } from '@/lib/db'
import { studentWithYearFeesSchema } from '@/lib/schemas'

type ImportAction = 'create' | 'skip' | 'update'

function normalizeRoll(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)
    const department = body.department as 'ECE' | 'BME' | undefined
    const rows = Array.isArray(body.rows) ? (body.rows as Array<Record<string, unknown>>) : []

    if (!batchId || !department) {
      return NextResponse.json({ error: 'batch_id and department are required' }, { status: 400 })
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'rows are required' }, { status: 400 })
    }

    const existingStudents = await studentOps.getByBatch(batchId, department)
    const rollToStudent = new Map(existingStudents.map((student) => [normalizeRoll(student.student_id_roll), student]))

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: Array<{ index: number; message: string; roll?: string }> = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const action = String(row.action ?? 'create') as ImportAction
      if (action === 'skip') {
        skipped += 1
        continue
      }

      try {
        const parsed = studentWithYearFeesSchema.parse({
          ...row,
          department,
          course: department,
        })

        const rollKey = normalizeRoll(parsed.student_id_roll)
        const existing = rollToStudent.get(rollKey) ?? null

        if (!existing) {
          if (action === 'update') {
            // No existing record to update; treat as create.
          }

          const studentId = await studentOps.create(batchId, {
            student_id_roll: parsed.student_id_roll.trim(),
            first_name: parsed.first_name.trim(),
            last_name: parsed.last_name.trim(),
            email: parsed.email?.trim() ?? '',
            phone: parsed.phone?.trim() ?? '',
            hostel_status: parsed.hostel_status,
            year: parsed.year,
            section: parsed.section.trim(),
            department,
            course: department,
            year_fees: parsed.year_fees,
          })

          rollToStudent.set(
            rollKey,
            {
              student_id: studentId,
              batch_id: batchId,
              student_id_roll: parsed.student_id_roll.trim(),
              first_name: parsed.first_name.trim(),
              last_name: parsed.last_name.trim(),
              course: department,
              department,
              year: parsed.year,
              section: parsed.section.trim(),
              email: parsed.email?.trim() ?? '',
              phone: parsed.phone?.trim() ?? '',
              hostel_status: parsed.hostel_status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any,
          )
          created += 1
          await auditOps.log(batchId, 'create', 'student', studentId, `Imported student ${parsed.first_name} ${parsed.last_name}`.trim())
          continue
        }

        if (action === 'create') {
          // Duplicate and user chose create: skip to avoid hard error.
          skipped += 1
          continue
        }

        const updatedStudent = await studentOps.update(existing.student_id, {
          student_id_roll: parsed.student_id_roll.trim(),
          first_name: parsed.first_name.trim(),
          last_name: parsed.last_name.trim(),
          email: parsed.email?.trim() ?? '',
          phone: parsed.phone?.trim() ?? '',
          hostel_status: parsed.hostel_status,
          year: parsed.year,
          section: parsed.section.trim(),
          department,
          course: department,
        })

        const yearRecords = await yearRecordOps.getByStudent(existing.student_id)
        const yearToRecord = new Map(yearRecords.map((record) => [record.year, record]))

        for (const fees of parsed.year_fees) {
          const record = yearToRecord.get(fees.year)
          if (!record) continue
          await yearRecordOps.update(record.year_record_id, {
            tuition_fee: fees.tuition_fee,
            books_fee: fees.books_fee,
            bus_fee: fees.bus_fee,
            hostel_fee: fees.hostel_fee,
            misc_fee: fees.misc_fee,
          })
        }

        updated += 1
        await auditOps.log(
          batchId,
          'update',
          'student',
          existing.student_id,
          `Imported update for ${updatedStudent?.first_name ?? parsed.first_name} ${updatedStudent?.last_name ?? parsed.last_name}`.trim(),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import row'
        errors.push({ index, message, roll: typeof row.student_id_roll === 'string' ? row.student_id_roll : undefined })
      }
    }

    return NextResponse.json({ created, updated, skipped, errors })
  } catch (error) {
    console.error('Import students error:', error)
    const message = error instanceof Error ? error.message : 'Failed to import students'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
