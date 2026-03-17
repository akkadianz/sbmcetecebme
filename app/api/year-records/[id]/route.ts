import { NextRequest, NextResponse } from 'next/server'

import { auditOps, yearRecordOps } from '@/lib/db'
import { yearRecordFeeSchema } from '@/lib/schemas'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const yearRecordId = Number(id)
    const body = await request.json()
    const batchId = Number(body.batch_id)

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    const existingRecord = await yearRecordOps.getById(yearRecordId)
    if (!existingRecord || existingRecord.batch_id !== batchId) {
      return NextResponse.json({ error: 'Year record not found' }, { status: 404 })
    }

    const parsed = yearRecordFeeSchema.parse(body)
    const updatedRecord = await yearRecordOps.update(yearRecordId, parsed)

    await auditOps.log(
      batchId,
      'update',
      'year_record',
      yearRecordId,
      `Updated fee structure for year ${existingRecord.year}`,
    )

    return NextResponse.json(updatedRecord)
  } catch (error) {
    console.error('Update year record error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update year record'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
