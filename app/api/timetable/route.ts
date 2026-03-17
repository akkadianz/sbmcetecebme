import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

function toInt(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : 0
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const batchId = Number(params.get('batch_id'))
    const department = params.get('department')
    const year = toInt(params.get('year'))
    const section = params.get('section')

    if (!batchId || !department || !year || !section) {
      return NextResponse.json({ error: 'batch_id, department, year and section are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('class_timetable_entries')
      .select('*')
      .eq('batch_id', batchId)
      .eq('department', department)
      .eq('year', year)
      .eq('section', section)
      .order('day_of_week', { ascending: true })
      .order('period', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Get timetable error:', error)
    return NextResponse.json({ error: 'Failed to fetch timetable' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)
    const department = String(body.department ?? '')
    const year = toInt(body.year)
    const section = String(body.section ?? '').trim()
    const dayOfWeek = toInt(body.day_of_week)
    const period = toInt(body.period)
    const subject = String(body.subject ?? '').trim()
    const faculty = body.faculty ? String(body.faculty).trim() : ''
    const room = body.room ? String(body.room).trim() : ''
    const notes = body.notes ? String(body.notes).trim() : ''

    if (!batchId || !department || !year || !section || !dayOfWeek || !period || !subject) {
      return NextResponse.json(
        { error: 'batch_id, department, year, section, day_of_week, period and subject are required' },
        { status: 400 },
      )
    }

    if (dayOfWeek < 1 || dayOfWeek > 7) {
      return NextResponse.json({ error: 'day_of_week must be 1..7' }, { status: 400 })
    }

    if (period < 1 || period > 12) {
      return NextResponse.json({ error: 'period must be 1..12' }, { status: 400 })
    }

    const timestamp = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('class_timetable_entries')
      .upsert(
        {
          batch_id: batchId,
          department,
          year,
          section,
          day_of_week: dayOfWeek,
          period,
          subject,
          faculty,
          room,
          notes,
          updated_at: timestamp,
        },
        { onConflict: 'batch_id,department,year,section,day_of_week,period' },
      )
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Upsert timetable entry error:', error)
    const message = error instanceof Error ? error.message : 'Failed to save timetable entry'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)
    const entryId = toInt(body.entry_id)

    if (!batchId || !entryId) {
      return NextResponse.json({ error: 'batch_id and entry_id are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('class_timetable_entries')
      .delete()
      .eq('batch_id', batchId)
      .eq('entry_id', entryId)

    if (error) throw error
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('Delete timetable entry error:', error)
    return NextResponse.json({ error: 'Failed to delete timetable entry' }, { status: 500 })
  }
}

