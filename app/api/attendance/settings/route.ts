import { NextRequest, NextResponse } from 'next/server'

import { attendanceSettingsOps } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))
    const month = request.nextUrl.searchParams.get('month') ?? ''

    if (!batchId || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'batch_id and valid month are required' }, { status: 400 })
    }

    const settings = await attendanceSettingsOps.getByBatchMonth(batchId, month)
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Get attendance settings error:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)
    const month = String(body.month ?? '')
    const excludeWeekends = body.exclude_weekends
    const holidays = Array.isArray(body.holidays) ? body.holidays.map(String) : null

    if (!batchId || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'batch_id and valid month are required' }, { status: 400 })
    }

    await attendanceSettingsOps.upsert(batchId, month, {
      exclude_weekends: typeof excludeWeekends === 'boolean' ? excludeWeekends : undefined,
      holidays: holidays ?? undefined,
    })

    return NextResponse.json({ message: 'Attendance settings updated' })
  } catch (error) {
    console.error('Update attendance settings error:', error)
    return NextResponse.json({ error: 'Failed to update attendance settings' }, { status: 500 })
  }
}
