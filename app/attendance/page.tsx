'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { CalendarCheck, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

type Student = {
  student_id: number
  student_id_roll: string
  first_name: string
  last_name: string
  year: string
  section: string
}

type AttendanceRecord = {
  attendance_id: number
  student_id: number
  date: string
  present: boolean
}

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonthKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getDaysInMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
}

export default function AttendancePage() {
  const { batch } = useBatch()
  const { toast } = useToast()
  const [monthDate, setMonthDate] = useState(() => new Date())
  const monthKey = formatMonthKey(monthDate)
  const today = new Date()
  const todayKey = formatDate(today)
  const isCurrentMonth = formatMonthKey(today) === monthKey
  const totalDaysInMonth = getDaysInMonth(monthDate)
  const editableDayLimit = isCurrentMonth ? today.getDate() : totalDaysInMonth

  const { data: students } = useSWR<Student[]>(
    batch ? `/api/students?batch_id=${batch.batch_id}&department=${batch.department}` : null,
    fetcher,
  )

  const { data: attendanceRecords, mutate: mutateAttendance } = useSWR<AttendanceRecord[]>(
    batch ? `/api/attendance?batch_id=${batch.batch_id}&month=${monthKey}` : null,
    fetcher,
  )

  const { data: attendanceSettings, mutate: mutateSettings } = useSWR<{
    exclude_weekends: boolean
    holidays: string[]
  }>(batch ? `/api/attendance/settings?batch_id=${batch.batch_id}&month=${monthKey}` : null, fetcher)

  const attendanceSet = useMemo(() => {
    const set = new Set<string>()
    ;(attendanceRecords ?? []).forEach((record) => {
      if (record.present) {
        set.add(`${record.student_id}-${record.date}`)
      }
    })
    return set
  }, [attendanceRecords])

  const holidays = useMemo(() => new Set(attendanceSettings?.holidays ?? []), [attendanceSettings])
  const excludeWeekends = attendanceSettings?.exclude_weekends ?? true

  const days = useMemo(() => {
    const list = []
    for (let day = 1; day <= totalDaysInMonth; day += 1) {
      const dayStr = String(day).padStart(2, '0')
      const date = `${monthKey}-${dayStr}`
      const dateObj = new Date(`${date}T00:00:00`)
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
      const excluded = holidays.has(date) || (excludeWeekends && isWeekend)
      list.push({
        day,
        date,
        excluded,
        isWeekend,
        isHoliday: holidays.has(date),
      })
    }
    return list
  }, [monthKey, totalDaysInMonth, holidays, excludeWeekends])

  const activeDays = useMemo(() => days.filter((day) => !day.excluded), [days])
  const effectiveDays = useMemo(
    () => activeDays.filter((day) => Number(day.date.slice(-2)) <= editableDayLimit),
    [activeDays, editableDayLimit],
  )
  const last7Days = useMemo(() => effectiveDays.slice(-7), [effectiveDays])

  const attendanceSummary = useMemo(() => {
    const activeDayLimit = effectiveDays.length
    if (!students?.length) {
      return { average: 0, totalPresent: 0, activeDayLimit }
    }

    const totalSlots = students.length * activeDayLimit
    let totalPresent = 0

    students.forEach((student) => {
      effectiveDays.forEach((day) => {
        if (attendanceSet.has(`${student.student_id}-${day.date}`)) {
          totalPresent += 1
        }
      })
    })

    const average = totalSlots ? Math.round((totalPresent / totalSlots) * 100) : 0
    return { average, totalPresent, activeDayLimit }
  }, [students, effectiveDays, attendanceSet])

  const studentStats = useMemo(() => {
    if (!students?.length) return []
    return students.map((student) => {
      let presentCount = 0
      effectiveDays.forEach((day) => {
        if (attendanceSet.has(`${student.student_id}-${day.date}`)) {
          presentCount += 1
        }
      })
      const percentage = attendanceSummary.activeDayLimit
        ? Math.round((presentCount / attendanceSummary.activeDayLimit) * 100)
        : 0
      return { student, presentCount, percentage }
    })
  }, [students, effectiveDays, attendanceSet, attendanceSummary.activeDayLimit])

  const reportRows = useMemo(() => {
    if (!students?.length) return []
    return students.map((student) => {
      let presentCount = 0
      effectiveDays.forEach((day) => {
        if (attendanceSet.has(`${student.student_id}-${day.date}`)) {
          presentCount += 1
        }
      })

      let last7Present = 0
      last7Days.forEach((day) => {
        if (attendanceSet.has(`${student.student_id}-${day.date}`)) {
          last7Present += 1
        }
      })

      let streak = 0
      for (let index = effectiveDays.length - 1; index >= 0; index -= 1) {
        const day = effectiveDays[index]
        if (attendanceSet.has(`${student.student_id}-${day.date}`)) {
          streak += 1
        } else {
          break
        }
      }

      const totalDays = effectiveDays.length
      const percentage = totalDays ? Math.round((presentCount / totalDays) * 100) : 0
      const last7Percent = last7Days.length ? Math.round((last7Present / last7Days.length) * 100) : 0

      return {
        student,
        presentCount,
        totalDays,
        percentage,
        last7Percent,
        streak,
      }
    })
  }, [students, effectiveDays, last7Days, attendanceSet])

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const selectedStudent = studentStats.find((item) => item.student.student_id === selectedStudentId)?.student ?? null

  const trendData = useMemo(() => {
    if (!selectedStudent) return []
    return days.map((day) => ({
      day: day.day,
      value: day.excluded
        ? null
        : attendanceSet.has(`${selectedStudent.student_id}-${day.date}`)
          ? 1
          : 0,
    }))
  }, [days, attendanceSet, selectedStudent])

  async function updateSettings(next: { exclude_weekends?: boolean; holidays?: string[] }) {
    if (!batch) return
    await fetch('/api/attendance/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_id: batch.batch_id,
        month: monthKey,
        exclude_weekends: next.exclude_weekends ?? excludeWeekends,
        holidays: next.holidays ?? Array.from(holidays),
      }),
    })
    mutateSettings()
  }

  const calendarWeeks = useMemo(() => {
    const firstDayIndex = new Date(`${monthKey}-01T00:00:00`).getDay()
    const slots: Array<(typeof days)[number] | null> = Array.from({ length: firstDayIndex }, () => null)
    days.forEach((day) => slots.push(day))
    const weeks: Array<Array<(typeof days)[number] | null>> = []
    for (let index = 0; index < slots.length; index += 7) {
      weeks.push(slots.slice(index, index + 7))
    }
    return weeks
  }, [days, monthKey])

  function toggleHoliday(date: string) {
    const next = holidays.has(date)
      ? Array.from(holidays).filter((item) => item !== date)
      : Array.from(new Set([...holidays, date]))
    updateSettings({ holidays: next })
  }

  async function updateAttendance(studentId: number, date: string, present: boolean) {
    if (!batch) return

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, student_id: studentId, date, present }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to update attendance')
      }

      mutateAttendance()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update attendance'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  async function markAllPresent() {
    if (!batch || !students?.length) return

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.batch_id,
          date: todayKey,
          present: true,
          student_ids: students.map((student) => student.student_id),
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to update attendance')
      }

      mutateAttendance()
      toast({ title: 'Updated', description: 'Marked all students present for today.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update attendance'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Attendance</h1>
          <p className="text-slate-600 mt-1">Checkbox-based daily attendance tracking for {batch?.department}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            {monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <Button variant="outline" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" />
              Monthly Overview
            </CardTitle>
            <CardDescription>Default status is absent. Checked means present.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Students: {students?.length ?? 0}</p>
            <p className="text-sm text-slate-600">Active days in view: {attendanceSummary.activeDayLimit}</p>
            <p className="text-lg font-semibold text-slate-900">Average attendance: {attendanceSummary.average}%</p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/attendance?batch_id=${batch?.batch_id}&month=${monthKey}&format=csv`, '_blank')}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/attendance?batch_id=${batch?.batch_id}&month=${monthKey}&format=pdf`, '_blank')}
              >
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Editing is only allowed on the same day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={markAllPresent} disabled={!isCurrentMonth || holidays.has(todayKey) || (excludeWeekends && (today.getDay() === 0 || today.getDay() === 6))}>
              Mark All Present (Today)
            </Button>
            <p className="text-xs text-slate-500">
              Only today&apos;s checkboxes are editable. Past and future dates are locked.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Holiday and Weekend Rules</CardTitle>
          <CardDescription>Excluded dates do not count toward attendance percentage. Click a date to add or remove a holiday.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={excludeWeekends}
              onChange={(event) => updateSettings({ exclude_weekends: event.target.checked })}
            />
            Exclude weekends (Saturday, Sunday)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value=""
              onChange={(event) => {
                const value = event.target.value
                if (!value) return
                updateSettings({ holidays: Array.from(new Set([...holidays, value])) })
              }}
              className="w-48"
            />
            <div className="flex flex-wrap gap-2">
              {Array.from(holidays).map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => updateSettings({ holidays: Array.from(holidays).filter((item) => item !== date) })}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                >
                  {date}
                </button>
              ))}
              {holidays.size === 0 ? <span className="text-xs text-slate-400">No custom holidays yet.</span> : null}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[520px] rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 grid grid-cols-7 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                  <div key={label} className="text-center">{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarWeeks.flat().map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="h-10" />
                  }

                  const isExcluded = day.excluded
                  const bgClass = day.isHoliday
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : day.isWeekend && excludeWeekends
                      ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : 'bg-white text-slate-700 border-slate-200'

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => toggleHoliday(day.date)}
                      className={`h-10 rounded-md border text-sm font-medium transition ${bgClass} ${isExcluded ? 'ring-1 ring-amber-200' : ''}`}
                      title={day.isHoliday ? 'Holiday' : day.isWeekend ? 'Weekend' : 'Working day'}
                    >
                      {day.day}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />
                  Holiday
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-slate-100 border border-slate-200" />
                  Weekend (excluded)
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-white border border-slate-200" />
                  Working day
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Student Attendance Trend</CardTitle>
          <CardDescription>Daily presence trend for the selected student.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={selectedStudentId ?? ''}
              onChange={(event) => setSelectedStudentId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Select a student</option>
              {studentStats.map(({ student }) => (
                <option key={student.student_id} value={student.student_id}>
                  {student.first_name} {student.last_name} ({student.student_id_roll})
                </option>
              ))}
            </select>
          </div>
          <div className="h-48 rounded-lg border border-slate-200 bg-white">
            {selectedStudent ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={(value) => (value === 1 ? 'P' : 'A')} />
                  <Tooltip formatter={(value) => (value === 1 ? 'Present' : value === 0 ? 'Absent' : 'Excluded')} />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Select a student to view their trend.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Attendance Report</CardTitle>
          <CardDescription>Student list with attendance trend stats for the month.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Reg No</th>
                  <th className="py-2 pr-3">Present/Total</th>
                  <th className="py-2 pr-3">%</th>
                  <th className="py-2 pr-3">Last 7 Days</th>
                  <th className="py-2 pr-3">Streak</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.student.student_id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {row.student.first_name} {row.student.last_name}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{row.student.student_id_roll}</td>
                    <td className="py-2 pr-3 text-slate-700">
                      {row.presentCount}/{row.totalDays}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-800">{row.percentage}%</td>
                    <td className="py-2 pr-3 text-slate-700">{row.last7Percent}%</td>
                    <td className="py-2 pr-3 text-slate-700">{row.streak} days</td>
                  </tr>
                ))}
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No students found for this batch.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Student Attendance</CardTitle>
          <CardDescription>Student-wise attendance with daily checkboxes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Reg No</th>
                  <th className="py-2 pr-3">%</th>
                  {days.map((day) => (
                    <th key={day.date} className="py-2 px-1 text-center">
                      {day.day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentStats.map(({ student, percentage }) => (
                  <tr key={student.student_id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{student.student_id_roll}</td>
                    <td className="py-2 pr-3 font-semibold text-slate-800">{percentage}%</td>
                    {days.map((day) => {
                      const isToday = day.date === todayKey
                      const checked = attendanceSet.has(`${student.student_id}-${day.date}`)
                      const disabled = day.excluded || !isToday
                      return (
                        <td key={`${student.student_id}-${day.date}`} className="py-2 px-1 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => updateAttendance(student.student_id, day.date, event.target.checked)}
                            disabled={disabled}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {studentStats.length === 0 ? (
                  <tr>
                    <td colSpan={3 + days.length} className="py-6 text-center text-slate-500">
                      No students found for this batch.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
