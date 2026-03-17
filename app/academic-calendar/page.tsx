'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

type CalendarEvent = {
  event_id: number
  batch_id: number
  department: string | null
  title: string
  event_type: string
  start_date: string
  end_date: string
  notes: string | null
}

function toIsoDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isWithin(date: string, start: string, end: string) {
  return date >= start && date <= end
}

export default function AcademicCalendarPage() {
  const { batch } = useBatch()
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState('event')
  const [startDate, setStartDate] = useState(() => toIsoDate(new Date()))
  const [endDate, setEndDate] = useState(() => toIsoDate(new Date()))
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data: events = [], mutate } = useSWR<CalendarEvent[]>(
    batch ? `/api/academic-calendar?batch_id=${batch.batch_id}&department=${batch.department}` : null,
    fetcher,
  )

  const selectedIso = toIsoDate(selectedDate)

  const eventsForSelectedDay = useMemo(() => {
    return (events ?? []).filter((event) => isWithin(selectedIso, event.start_date, event.end_date))
  }, [events, selectedIso])

  const modifiers = useMemo(() => {
    const marked = new Set<string>()
    ;(events ?? []).forEach((event) => {
      // Only mark the start day for a lightweight indicator in the month view.
      marked.add(event.start_date)
    })
    const dates = Array.from(marked).map((iso) => new Date(`${iso}T00:00:00`))
    return { hasEvent: dates }
  }, [events])

  async function addEvent() {
    if (!batch) return
    if (!title.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/academic-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.batch_id,
          department: batch.department,
          title,
          event_type: eventType,
          start_date: startDate,
          end_date: endDate,
          notes,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create event')

      toast({ title: 'Added', description: 'Academic calendar event created.' })
      setTitle('')
      setNotes('')
      mutate()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create event',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteEvent(eventId: number) {
    if (!batch) return
    try {
      const response = await fetch('/api/academic-calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, event_id: eventId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to delete event')
      toast({ title: 'Deleted', description: 'Event removed.' })
      mutate()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete event',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-slate-900">Academic Calendar</h1>
        <p className="text-slate-600 mt-1">Add holidays, exams, and important events for your batch.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Calendar
            </CardTitle>
            <CardDescription>Select a day to view events.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (!date) return
                setSelectedDate(date)
                const iso = toIsoDate(date)
                setStartDate(iso)
                setEndDate(iso)
              }}
              modifiers={modifiers}
              modifiersClassNames={{
                hasEvent: 'bg-indigo-50 text-indigo-900',
              }}
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Events on {selectedIso}</CardTitle>
              <CardDescription>{eventsForSelectedDay.length ? 'Tap delete to remove an event.' : 'No events for this day.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {eventsForSelectedDay.map((event) => (
                <div key={event.event_id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white/70 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 break-words">{event.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {event.event_type} • {event.start_date}
                      {event.end_date !== event.start_date ? ` to ${event.end_date}` : ''}
                    </p>
                    {event.notes ? <p className="text-sm text-slate-600 mt-2 break-words">{event.notes}</p> : null}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => deleteEvent(event.event_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {eventsForSelectedDay.length === 0 ? (
                <p className="text-sm text-slate-600">Use the form below to add one.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Event</CardTitle>
              <CardDescription>Defaults to the selected date.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Internal Exam" disabled={isSaving} className="mt-2" />
              </div>

              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={eventType} onValueChange={setEventType} disabled={isSaving}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Start</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isSaving} className="mt-2" />
                </div>
                <div>
                  <label className="text-sm font-medium">End</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isSaving} className="mt-2" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra details..." disabled={isSaving} className="mt-2" />
              </div>

              <div className="md:col-span-2">
                <Button onClick={addEvent} disabled={isSaving} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  {isSaving ? 'Adding...' : 'Add Event'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

