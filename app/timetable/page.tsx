'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { CalendarClock, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      result && typeof result === 'object' && 'error' in result ? String((result as any).error) : 'Failed to load timetable'
    throw new Error(message)
  }
  return result
}

type TimetableEntry = {
  entry_id: number
  day_of_week: number
  period: number
  subject: string
  faculty: string | null
  room: string | null
  notes: string | null
}

const DAYS: Array<{ key: number; label: string }> = [
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
]

const PERIODS = Array.from({ length: 8 }, (_, idx) => idx + 1)

export default function TimetablePage() {
  const { batch } = useBatch()
  const { toast } = useToast()

  const [year, setYear] = useState('1')
  const [section, setSection] = useState('A')

  const [editingSlot, setEditingSlot] = useState<{
    day_of_week: number
    period: number
    entry?: TimetableEntry | null
  } | null>(null)

  const [subject, setSubject] = useState('')
  const [faculty, setFaculty] = useState('')
  const [room, setRoom] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data, error, mutate } = useSWR<TimetableEntry[]>(
    batch ? `/api/timetable?batch_id=${batch.batch_id}&department=${batch.department}&year=${year}&section=${encodeURIComponent(section)}` : null,
    fetcher,
  )

  const entries = Array.isArray(data) ? data : []

  const bySlot = useMemo(() => {
    const map = new Map<string, TimetableEntry>()
    entries.forEach((entry) => {
      map.set(`${entry.day_of_week}-${entry.period}`, entry)
    })
    return map
  }, [entries])

  function openEditor(dayOfWeek: number, period: number) {
    const entry = bySlot.get(`${dayOfWeek}-${period}`) ?? null
    setEditingSlot({ day_of_week: dayOfWeek, period, entry })
    setSubject(entry?.subject ?? '')
    setFaculty(entry?.faculty ?? '')
    setRoom(entry?.room ?? '')
  }

  async function saveEntry() {
    if (!batch || !editingSlot) return
    if (!subject.trim()) {
      toast({ title: 'Error', description: 'Subject is required', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.batch_id,
          department: batch.department,
          year: Number(year),
          section,
          day_of_week: editingSlot.day_of_week,
          period: editingSlot.period,
          subject,
          faculty,
          room,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save timetable entry')
      toast({ title: 'Saved', description: 'Timetable updated.' })
      setEditingSlot(null)
      mutate()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save timetable entry',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteEntry(entryId: number) {
    if (!batch) return
    try {
      const response = await fetch('/api/timetable', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, entry_id: entryId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to delete timetable entry')
      toast({ title: 'Deleted', description: 'Entry removed.' })
      setEditingSlot(null)
      mutate()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete timetable entry',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-slate-900">Class Timetable</h1>
        <p className="text-slate-600 mt-1">Weekly timetable view by year and section.</p>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Timetable Not Available</CardTitle>
            <CardDescription>
              {error.message}. If you just deployed, run the latest SQL in `scripts/supabase-schema.sql` to create the `class_timetable_entries` table.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Pick the class to view/edit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Year</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Year 1</SelectItem>
                <SelectItem value="2">Year 2</SelectItem>
                <SelectItem value="3">Year 3</SelectItem>
                <SelectItem value="4">Year 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Section</label>
            <Input value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} className="mt-2" placeholder="A" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly View</CardTitle>
          <CardDescription>Click a cell to add/edit. Empty cells mean no entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Period</th>
                  {DAYS.map((day) => (
                    <th key={day.key} className="py-2 px-2 text-center">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-700">P{period}</td>
                    {DAYS.map((day) => {
                      const entry = bySlot.get(`${day.key}-${period}`) ?? null
                      return (
                        <td key={`${day.key}-${period}`} className="py-2 px-2 align-top">
                          <button
                            type="button"
                            onClick={() => openEditor(day.key, period)}
                            className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-left shadow-sm hover:bg-slate-50"
                          >
                            {entry ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-900 break-words">{entry.subject}</p>
                                <p className="text-xs text-slate-500 break-words">
                                  {entry.room ? `Room ${entry.room}` : 'Room -'}
                                  {entry.faculty ? ` • ${entry.faculty}` : ''}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">Add</p>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editingSlot !== null} onOpenChange={(open) => !open && setEditingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Entry
            </DialogTitle>
            <DialogDescription>
              {editingSlot ? `Day ${editingSlot.day_of_week}, Period ${editingSlot.period} (Year ${year} - ${section})` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2" placeholder="e.g., Digital Signal Processing" disabled={isSaving} />
            </div>
            <div>
              <label className="text-sm font-medium">Faculty (Optional)</label>
              <Input value={faculty} onChange={(e) => setFaculty(e.target.value)} className="mt-2" placeholder="e.g., Dr. Kumar" disabled={isSaving} />
            </div>
            <div>
              <label className="text-sm font-medium">Room (Optional)</label>
              <Input value={room} onChange={(e) => setRoom(e.target.value)} className="mt-2" placeholder="e.g., 202" disabled={isSaving} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {editingSlot?.entry ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => deleteEntry(editingSlot.entry!.entry_id)}
                disabled={isSaving}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button type="button" onClick={saveEntry} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
