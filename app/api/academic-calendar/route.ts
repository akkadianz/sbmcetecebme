import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(request: NextRequest) {
  try {
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))
    const department = request.nextUrl.searchParams.get('department')

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    let query = supabaseAdmin.from('academic_calendar_events').select('*').eq('batch_id', batchId)
    if (department) query = query.or(`department.is.null,department.eq.${department}`)

    const { data, error } = await query.order('start_date', { ascending: true })
    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Get academic calendar error:', error)
    return NextResponse.json({ error: 'Failed to fetch academic calendar events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)
    const department = body.department ? String(body.department) : null
    const title = String(body.title ?? '').trim()
    const eventType = String(body.event_type ?? 'event').trim() || 'event'
    const startDate = String(body.start_date ?? '')
    const endDate = String(body.end_date ?? '')
    const notes = body.notes ? String(body.notes) : ''

    if (!batchId || !title || !isIsoDate(startDate) || !isIsoDate(endDate)) {
      return NextResponse.json({ error: 'batch_id, title, start_date and end_date are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('academic_calendar_events')
      .insert({
        batch_id: batchId,
        department,
        title,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate,
        notes,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Create academic calendar event error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create event'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const eventId = Number(body.event_id)
    const batchId = Number(body.batch_id)

    if (!eventId || !batchId) {
      return NextResponse.json({ error: 'event_id and batch_id are required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) updates.title = String(body.title).trim()
    if (body.department !== undefined) updates.department = body.department ? String(body.department) : null
    if (body.event_type !== undefined) updates.event_type = String(body.event_type).trim() || 'event'
    if (body.start_date !== undefined) {
      const startDate = String(body.start_date)
      if (!isIsoDate(startDate)) return NextResponse.json({ error: 'Invalid start_date' }, { status: 400 })
      updates.start_date = startDate
    }
    if (body.end_date !== undefined) {
      const endDate = String(body.end_date)
      if (!isIsoDate(endDate)) return NextResponse.json({ error: 'Invalid end_date' }, { status: 400 })
      updates.end_date = endDate
    }
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : ''

    const { data, error } = await supabaseAdmin
      .from('academic_calendar_events')
      .update(updates)
      .eq('event_id', eventId)
      .eq('batch_id', batchId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Update academic calendar event error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update event'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const eventId = Number(body.event_id)
    const batchId = Number(body.batch_id)

    if (!eventId || !batchId) {
      return NextResponse.json({ error: 'event_id and batch_id are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('academic_calendar_events')
      .delete()
      .eq('event_id', eventId)
      .eq('batch_id', batchId)

    if (error) throw error
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('Delete academic calendar event error:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}

