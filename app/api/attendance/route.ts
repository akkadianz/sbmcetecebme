import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { attendanceOps, attendanceSettingsOps, batchOps, studentOps } from '@/lib/db'

export const runtime = 'nodejs'

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(request: NextRequest) {
  try {
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))
    const month = request.nextUrl.searchParams.get('month') ?? ''
    const format = request.nextUrl.searchParams.get('format') ?? 'json'

    if (!batchId || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'batch_id and valid month are required' }, { status: 400 })
    }

    const records = await attendanceOps.getByBatchMonth(batchId, month)

    if (format === 'json') {
      return NextResponse.json(records)
    }

    const batch = await batchOps.getById(batchId)
    const students = await studentOps.getByBatch(batchId)
    const settings = await attendanceSettingsOps.getByBatchMonth(batchId, month)
    const holidays = new Set(settings.holidays ?? [])
    const excludeWeekends = settings.exclude_weekends ?? true

    const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const dayEntries = Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, '0')
      const date = `${month}-${day}`
      const dateObj = new Date(`${date}T00:00:00`)
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
      const excluded = holidays.has(date) || (excludeWeekends && isWeekend)
      return { date, day: index + 1, excluded }
    })

    const presentSet = new Set(records.filter((record) => record.present).map((record) => `${record.student_id}-${record.date}`))
    const activeDays = dayEntries.filter((day) => !day.excluded)
    const activeDayCount = activeDays.length

    if (format === 'csv') {
      const header = ['Reg No', 'Name', ...dayEntries.map((day) => `${day.day}${day.excluded ? ' (X)' : ''}`), 'Present', 'Total Days', 'Percentage']
      const rows = students.map((student) => {
        let presentCount = 0
        const dayValues = dayEntries.map((day) => {
          if (day.excluded) return 'X'
          const key = `${student.student_id}-${day.date}`
          if (presentSet.has(key)) {
            presentCount += 1
            return 'P'
          }
          return 'A'
        })
        const percentage = activeDayCount ? Math.round((presentCount / activeDayCount) * 100) : 0
        return [
          student.student_id_roll,
          `${student.first_name} ${student.last_name}`.trim(),
          ...dayValues,
          String(presentCount),
          String(activeDayCount),
          `${percentage}%`,
        ]
      })
      const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-${month}.csv"`,
        },
      })
    }

    if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create()
      let page = pdfDoc.addPage([595, 842])
      const { width, height } = page.getSize()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const marginX = 40
      const tableWidth = width - marginX * 2

      const departmentSet = new Set(students.map((student) => student.department))
      const yearSet = new Set(students.map((student) => student.year))
      const departmentLabel = departmentSet.size === 1 ? Array.from(departmentSet)[0] : 'Multiple'
      const yearLabel = yearSet.size === 1 ? `Year ${Array.from(yearSet)[0]}` : 'All Years'

      let cursorY = height - 50
      page.drawText('SBM College of Engineering and Technology', {
        x: marginX,
        y: cursorY,
        size: 12,
        font: boldFont,
        color: rgb(0.1, 0.12, 0.16),
      })
      cursorY -= 16
      page.drawText(`Attendance Report`, { x: marginX, y: cursorY, size: 16, font: boldFont, color: rgb(0.1, 0.15, 0.2) })
      cursorY -= 16
      const batchLabel = batch?.batch_name ? `Batch ${batch.batch_name}` : `Batch ${batchId}`
      page.drawText(`Department: ${departmentLabel}  •  ${yearLabel}  •  ${batchLabel}`, { x: marginX, y: cursorY, size: 10, font, color: rgb(0.35, 0.4, 0.45) })
      cursorY -= 14
      page.drawText(`Month: ${month}`, { x: marginX, y: cursorY, size: 10, font, color: rgb(0.35, 0.4, 0.45) })
      cursorY -= 14
      page.drawText(`Excluded days: ${dayEntries.filter((day) => day.excluded).length}`, { x: marginX, y: cursorY, size: 10, font })
      cursorY -= 14
      page.drawText(`Active days: ${activeDayCount}`, { x: marginX, y: cursorY, size: 10, font })
      cursorY -= 20

      const headers = ['Reg No', 'Name', 'Present', 'Total', 'Percent']
      const colWidths = [0.18, 0.42, 0.13, 0.13, 0.14].map((ratio) => Math.floor(tableWidth * ratio))
      const colAlign: Array<'left' | 'right'> = ['left', 'left', 'right', 'right', 'right']

      const drawHeader = () => {
        let colX = marginX
        page.drawRectangle({
          x: marginX,
          y: cursorY - 4,
          width: tableWidth,
          height: 18,
          color: rgb(0.95, 0.96, 0.98),
        })
        headers.forEach((label, index) => {
          page.drawText(label, { x: colX + 2, y: cursorY, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.25) })
          colX += colWidths[index]
        })
        cursorY -= 18
      }

      const drawRow = (values: string[]) => {
        let x = marginX
        values.forEach((value, index) => {
          const textWidth = font.widthOfTextAtSize(value, 10)
          const alignedX = colAlign[index] === 'right' ? x + colWidths[index] - textWidth - 2 : x + 2
          page.drawText(value, { x: alignedX, y: cursorY, size: 10, font, color: rgb(0.1, 0.1, 0.12) })
          x += colWidths[index]
        })
        cursorY -= 14
      }

      drawHeader()

      students.forEach((student) => {
        let presentCount = 0
        activeDays.forEach((day) => {
          if (presentSet.has(`${student.student_id}-${day.date}`)) {
            presentCount += 1
          }
        })
        const percentage = activeDayCount ? Math.round((presentCount / activeDayCount) * 100) : 0

        if (cursorY < 60) {
          page = pdfDoc.addPage([595, 842])
          cursorY = height - 60
          drawHeader()
        }

        drawRow([
            student.student_id_roll,
            `${student.first_name} ${student.last_name}`.trim(),
            String(presentCount),
            String(activeDayCount),
            `${percentage}%`,
          ])
      })

      const pdfBytes = await pdfDoc.save()
      const pdfBody = new Uint8Array(pdfBytes)
      return new NextResponse(pdfBody, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="attendance-${month}.pdf"`,
        },
      })
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  } catch (error) {
    console.error('Get attendance error:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const batchId = Number(body.batch_id)
    const date = String(body.date ?? '')
    const present = Boolean(body.present)
    const studentId = body.student_id ? Number(body.student_id) : null
    const studentIds = Array.isArray(body.student_ids) ? body.student_ids.map(Number).filter(Number.isFinite) : []

    if (!batchId || !isValidDate(date) || (!studentId && studentIds.length === 0)) {
      return NextResponse.json({ error: 'batch_id, date and student_id(s) are required' }, { status: 400 })
    }

    const today = formatDate(new Date())
    if (date !== today) {
      return NextResponse.json({ error: 'Attendance can only be edited on the same day' }, { status: 403 })
    }

    const monthKey = date.slice(0, 7)
    const settings = await attendanceSettingsOps.getByBatchMonth(batchId, monthKey)
    const isWeekend = new Date(`${date}T00:00:00`).getDay() === 0 || new Date(`${date}T00:00:00`).getDay() === 6
    const excluded = (settings.exclude_weekends && isWeekend) || (settings.holidays ?? []).includes(date)
    if (excluded) {
      return NextResponse.json({ error: 'Attendance cannot be edited on excluded days' }, { status: 403 })
    }

    const students = await studentOps.getByBatch(batchId)
    const allowedIds = new Set(students.map((student) => student.student_id))

    const targets: number[] = studentId ? [studentId] : studentIds
    const filteredTargets = targets.filter((id: number) => allowedIds.has(id))
    if (!filteredTargets.length) {
      return NextResponse.json({ error: 'No matching students found for this batch' }, { status: 404 })
    }

    for (const id of filteredTargets) {
      if (present) {
        await attendanceOps.upsert(batchId, id, date, true)
      } else {
        await attendanceOps.remove(batchId, id, date)
      }
    }

    return NextResponse.json({ message: 'Attendance updated', updated: filteredTargets.length })
  } catch (error) {
    console.error('Attendance update error:', error)
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
  }
}
