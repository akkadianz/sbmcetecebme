import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'

import { paymentOps, studentOps, yearRecordOps } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

type TableColumn = {
  key: string
  label: string
  width: number
  align?: 'left' | 'center' | 'right'
}

type PdfFont = 'F1' | 'F2'

type TextOptions = {
  font?: PdfFont
  size?: number
  color?: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const PAGE_MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

type DecodedPng = {
  width: number
  height: number
  rgb: Buffer
  alpha?: Buffer
}

let cachedSbmLogo: DecodedPng | null | undefined

function paethPredictor(a: number, b: number, c: number) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function decodePng(buffer: Buffer): DecodedPng {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (buffer.length < signature.length || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('Invalid PNG signature')
  }

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idatChunks: Buffer[] = []

  let offset = 8
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > buffer.length) break

    const data = buffer.subarray(dataStart, dataEnd)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data.readUInt8(8)
      colorType = data.readUInt8(9)
      interlace = data.readUInt8(12)
    } else if (type === 'IDAT') {
      idatChunks.push(data)
    } else if (type === 'IEND') {
      break
    }

    offset = dataEnd + 4
  }

  if (!width || !height) throw new Error('Missing IHDR')
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`)
  if (interlace !== 0) throw new Error('Interlaced PNG not supported')
  if (colorType !== 2 && colorType !== 6) throw new Error(`Unsupported PNG color type: ${colorType}`)

  const bytesPerPixel = colorType === 6 ? 4 : 3
  const rowBytes = width * bytesPerPixel

  const compressed = Buffer.concat(idatChunks)
  const inflated = zlib.inflateSync(compressed)

  const expected = (rowBytes + 1) * height
  if (inflated.length < expected) {
    throw new Error('PNG data too short')
  }

  const raw = Buffer.allocUnsafe(rowBytes * height)
  let inPos = 0
  let outPos = 0
  let prevRow: Buffer | null = null

  for (let y = 0; y < height; y++) {
    const filter = inflated.readUInt8(inPos)
    inPos += 1
    const row = inflated.subarray(inPos, inPos + rowBytes)
    inPos += rowBytes

    const recon = Buffer.allocUnsafe(rowBytes)
    for (let i = 0; i < rowBytes; i++) {
      const x = row[i]
      const a = i >= bytesPerPixel ? recon[i - bytesPerPixel] : 0
      const b = prevRow ? prevRow[i] : 0
      const c = prevRow && i >= bytesPerPixel ? prevRow[i - bytesPerPixel] : 0

      let value: number
      switch (filter) {
        case 0:
          value = x
          break
        case 1:
          value = (x + a) & 0xff
          break
        case 2:
          value = (x + b) & 0xff
          break
        case 3:
          value = (x + Math.floor((a + b) / 2)) & 0xff
          break
        case 4:
          value = (x + paethPredictor(a, b, c)) & 0xff
          break
        default:
          throw new Error(`Unsupported PNG filter: ${filter}`)
      }

      recon[i] = value
    }

    recon.copy(raw, outPos)
    outPos += rowBytes
    prevRow = recon
  }

  if (colorType === 2) {
    return { width, height, rgb: raw }
  }

  const rgb = Buffer.allocUnsafe(width * height * 3)
  const alpha = Buffer.allocUnsafe(width * height)
  let src = 0
  let rgbPos = 0
  let aPos = 0

  for (let i = 0; i < width * height; i++) {
    rgb[rgbPos++] = raw[src++]
    rgb[rgbPos++] = raw[src++]
    rgb[rgbPos++] = raw[src++]
    alpha[aPos++] = raw[src++]
  }

  return { width, height, rgb, alpha }
}

async function getSbmLogoPng(): Promise<DecodedPng | null> {
  if (cachedSbmLogo !== undefined) return cachedSbmLogo

  const candidates = [
    path.join(process.cwd(), 'public', 'sbm-logo.png'),
    path.join(process.cwd(), 'public', 'sbm logo.png'),
    path.join(process.cwd(), 'sbm logo.png'),
  ]

  for (const filePath of candidates) {
    try {
      const file = await readFile(filePath)
      cachedSbmLogo = decodePng(file)
      return cachedSbmLogo
    } catch {
      // Try next candidate.
    }
  }

  cachedSbmLogo = null
  return null
}

function fitColumns(columns: TableColumn[]) {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0)

  if (totalWidth <= CONTENT_WIDTH) {
    return columns
  }

  const scale = CONTENT_WIDTH / totalWidth
  let remainingWidth = CONTENT_WIDTH

  return columns.map((column, index) => {
    const width =
      index === columns.length - 1
        ? remainingWidth
        : Math.max(36, Math.floor(column.width * scale))

    remainingWidth -= width
    return { ...column, width }
  })
}

function createCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
}

function escapePdfText(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function hexToRgb(color: string) {
  const normalized = color.replace('#', '')
  const value = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized
  const red = Number.parseInt(value.slice(0, 2), 16) / 255
  const green = Number.parseInt(value.slice(2, 4), 16) / 255
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`
}

function approximateTextWidth(text: string, size: number) {
  return text.length * size * 0.52
}

function wrapText(text: string, width: number, size: number) {
  const clean = text.trim() || '-'
  const maxChars = Math.max(1, Math.floor(width / (size * 0.52)))

  if (clean.length <= maxChars) {
    return [clean]
  }

  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = word
      continue
    }

    lines.push(`${word.slice(0, Math.max(1, maxChars - 3))}...`)
    current = ''
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

class PdfBuilder {
  private pages: string[][] = [[]]

  private currentPageIndex = 0

  private pageDecorator?: (builder: PdfBuilder) => void

  private images = new Map<
    string,
    {
      width: number
      height: number
      rgbDeflated: Buffer
      alphaDeflated?: Buffer
    }
  >()

  setPageDecorator(decorator: (builder: PdfBuilder) => void) {
    this.pageDecorator = decorator
    decorator(this)
  }

  addPage() {
    this.pages.push([])
    this.currentPageIndex = this.pages.length - 1
    if (this.pageDecorator) this.pageDecorator(this)
  }

  private push(command: string) {
    this.pages[this.currentPageIndex].push(command)
  }

  embedPng(name: string, png: DecodedPng) {
    if (this.images.has(name)) return

    const rgbDeflated = zlib.deflateSync(png.rgb)
    const alphaDeflated = png.alpha ? zlib.deflateSync(png.alpha) : undefined
    this.images.set(name, {
      width: png.width,
      height: png.height,
      rgbDeflated,
      alphaDeflated,
    })
  }

  image(name: string, x: number, y: number, width: number, height: number) {
    const pdfY = PAGE_HEIGHT - y - height
    this.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${pdfY.toFixed(2)} cm /${name} Do Q`)
  }

  text(text: string, x: number, y: number, options: TextOptions = {}) {
    const size = options.size ?? 10
    const font = options.font ?? 'F1'
    const color = hexToRgb(options.color ?? '#111827')
    const width = options.width
    const align = options.align ?? 'left'
    const estimatedWidth = approximateTextWidth(text, size)
    let textX = x

    if (width && align === 'center') {
      textX = x + Math.max(0, (width - estimatedWidth) / 2)
    } else if (width && align === 'right') {
      textX = x + Math.max(0, width - estimatedWidth)
    }

    const pdfY = PAGE_HEIGHT - y - size
    this.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${textX.toFixed(2)} ${pdfY.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`)
  }

  line(x1: number, y1: number, x2: number, y2: number, color = '#cbd5e1', width = 1) {
    const stroke = hexToRgb(color)
    const startY = PAGE_HEIGHT - y1
    const endY = PAGE_HEIGHT - y2
    this.push(`${stroke} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${startY.toFixed(2)} m ${x2.toFixed(2)} ${endY.toFixed(2)} l S`)
  }

  rect(x: number, y: number, width: number, height: number, fillColor?: string, strokeColor = '#cbd5e1', lineWidth = 1) {
    const pdfY = PAGE_HEIGHT - y - height
    const stroke = hexToRgb(strokeColor)
    if (fillColor) {
      const fill = hexToRgb(fillColor)
      this.push(`${fill} rg ${stroke} RG ${lineWidth.toFixed(2)} w ${x.toFixed(2)} ${pdfY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`)
      return
    }

    this.push(`${stroke} RG ${lineWidth.toFixed(2)} w ${x.toFixed(2)} ${pdfY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`)
  }

  toBuffer() {
    const objectBuffers: Buffer[] = []
    const pageCount = this.pages.length
    const pageObjectStart = 3
    const contentObjectStart = pageObjectStart + pageCount
    const fontObjectStart = contentObjectStart + pageCount
    const fontNormalId = fontObjectStart
    const fontBoldId = fontObjectStart + 1

    const images = Array.from(this.images.entries())
    const imageObjectIds = new Map<string, { imageId: number; smaskId?: number }>()

    let nextObjectId = fontObjectStart + 2
    for (const [name, img] of images) {
      const smaskId = img.alphaDeflated ? nextObjectId++ : undefined
      const imageId = nextObjectId++
      imageObjectIds.set(name, { imageId, smaskId })
    }

    const xObjectDict = images.length
      ? `/XObject << ${images
          .map(([name]) => `/${name} ${imageObjectIds.get(name)!.imageId} 0 R`)
          .join(' ')} >> `
      : ''

    // 1: Catalog
    objectBuffers.push(Buffer.from('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n', 'utf8'))

    // 2: Pages
    objectBuffers.push(
      Buffer.from(
        `2 0 obj << /Type /Pages /Kids [${this.pages.map((_, index) => `${pageObjectStart + index} 0 R`).join(' ')}] /Count ${pageCount} >> endobj\n`,
        'utf8',
      ),
    )

    // Page objects
    this.pages.forEach((_, index) => {
      const pageId = pageObjectStart + index
      const contentObjectId = contentObjectStart + index
      const pageObject = `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontNormalId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjectDict}>> /Contents ${contentObjectId} 0 R >> endobj\n`
      objectBuffers.push(Buffer.from(pageObject, 'utf8'))
    })

    // Content streams
    this.pages.forEach((commands, index) => {
      const objectId = contentObjectStart + index
      const stream = Buffer.from(commands.join('\n'), 'utf8')
      const header = Buffer.from(`${objectId} 0 obj << /Length ${stream.length} >> stream\n`, 'utf8')
      const footer = Buffer.from('\nendstream endobj\n', 'utf8')
      objectBuffers.push(Buffer.concat([header, stream, footer]))
    })

    // Fonts
    objectBuffers.push(
      Buffer.from(`${fontNormalId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`, 'utf8'),
    )
    objectBuffers.push(
      Buffer.from(`${fontBoldId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n`, 'utf8'),
    )

    // Images (optional)
    for (const [name, img] of images) {
      const ids = imageObjectIds.get(name)!

      if (ids.smaskId) {
        const smaskStream = img.alphaDeflated!
        const smaskHeader = Buffer.from(
          `${ids.smaskId} 0 obj << /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${smaskStream.length} >> stream\n`,
          'utf8',
        )
        const smaskFooter = Buffer.from('\nendstream endobj\n', 'utf8')
        objectBuffers.push(Buffer.concat([smaskHeader, smaskStream, smaskFooter]))
      }

      const imageStream = img.rgbDeflated
      const imageDictParts = [
        `${ids.imageId} 0 obj << /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
        ids.smaskId ? `/SMask ${ids.smaskId} 0 R` : null,
        `/Length ${imageStream.length} >> stream\n`,
      ]
        .filter(Boolean)
        .join(' ')

      const imageHeader = Buffer.from(imageDictParts, 'utf8')
      const imageFooter = Buffer.from('\nendstream endobj\n', 'utf8')
      objectBuffers.push(Buffer.concat([imageHeader, imageStream, imageFooter]))
    }

    const header = Buffer.from('%PDF-1.4\n', 'utf8')
    const parts: Buffer[] = [header]
    const offsets: number[] = [0]
    let currentOffset = header.length

    for (const objectBuffer of objectBuffers) {
      offsets.push(currentOffset)
      parts.push(objectBuffer)
      currentOffset += objectBuffer.length
    }

    const xrefOffset = currentOffset
    const objectCount = objectBuffers.length
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`
    for (const offset of offsets.slice(1)) {
      xref += `${String(offset).padStart(10, '0')} 00000 n \n`
    }

    xref += `trailer << /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    parts.push(Buffer.from(xref, 'utf8'))

    return Buffer.concat(parts)
  }
}

async function applySbmLogo(builder: PdfBuilder) {
  const logo = await getSbmLogoPng()
  if (!logo) return

  builder.embedPng('SBMLogo', logo)
  builder.setPageDecorator((decoratedBuilder) => {
    const size = 32
    decoratedBuilder.image('SBMLogo', PAGE_MARGIN, 8, size, size)
  })
}

function drawWrappedText(builder: PdfBuilder, text: string, x: number, y: number, width: number, options: TextOptions = {}) {
  const size = options.size ?? 10
  const lines = wrapText(text, width, size)

  lines.forEach((line, index) => {
    builder.text(line, x, y + index * (size + 2), {
      ...options,
      width,
    })
  })

  return lines.length
}

function drawCenteredHeading(builder: PdfBuilder, text: string, y: number, size: number) {
  builder.text(text, PAGE_MARGIN, y, {
    width: CONTENT_WIDTH,
    align: 'center',
    size,
    font: 'F2',
    color: '#0f172a',
  })
}

function drawInfoRow(builder: PdfBuilder, y: number, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
  const halfWidth = (CONTENT_WIDTH - 24) / 2
  const leftX = PAGE_MARGIN + 12
  const rightX = leftX + halfWidth + 24

  builder.text(`${leftLabel}:`, leftX, y, { font: 'F2', size: 10, color: '#0f172a' })
  drawWrappedText(builder, leftValue, leftX + 84, y, halfWidth - 84, { size: 10, color: '#111827' })

  builder.text(`${rightLabel}:`, rightX, y, { font: 'F2', size: 10, color: '#0f172a' })
  drawWrappedText(builder, rightValue, rightX + 84, y, halfWidth - 84, { size: 10, color: '#111827' })
}

function drawSectionTitle(builder: PdfBuilder, title: string, y: number) {
  builder.text(title, PAGE_MARGIN, y, { font: 'F2', size: 12, color: '#0f172a' })
  builder.line(PAGE_MARGIN, y + 18, PAGE_MARGIN + CONTENT_WIDTH, y + 18)
}

function drawTable(
  builder: PdfBuilder,
  columns: TableColumn[],
  rows: Array<Record<string, string>>,
  startY: number,
  topOffsetForNewPage: number,
) {
  const fittedColumns = fitColumns(columns)
  const headerHeight = 22
  const paddingX = 6
  const paddingY = 6
  let y = startY

  const drawHeader = () => {
    let x = PAGE_MARGIN
    builder.rect(PAGE_MARGIN, y, CONTENT_WIDTH, headerHeight, '#e2e8f0')

    for (const column of fittedColumns) {
      builder.rect(x, y, column.width, headerHeight, '#e2e8f0')
      builder.text(column.label, x + paddingX, y + 6, {
        font: 'F2',
        size: 9,
        width: column.width - paddingX * 2,
        align: column.align ?? 'left',
        color: '#0f172a',
      })
      x += column.width
    }

    y += headerHeight
  }

  drawHeader()

  for (const row of rows) {
    const preparedCells = fittedColumns.map((column) => {
      const text = row[column.key] ?? '-'
      const lines = wrapText(text, column.width - paddingX * 2, 9)
      return { text, lines }
    })
    const rowHeight = Math.max(...preparedCells.map((cell) => cell.lines.length)) * 11 + paddingY * 2

    if (y + rowHeight > PAGE_HEIGHT - PAGE_MARGIN) {
      builder.addPage()
      y = topOffsetForNewPage
      drawHeader()
    }

    let x = PAGE_MARGIN

    preparedCells.forEach((cell, index) => {
      const column = fittedColumns[index]
      builder.rect(x, y, column.width, rowHeight)
      cell.lines.forEach((line, lineIndex) => {
        builder.text(line, x + paddingX, y + paddingY + lineIndex * 11, {
          size: 9,
          width: column.width - paddingX * 2,
          align: column.align ?? 'left',
          color: '#111827',
        })
      })
      x += column.width
    })

    y += rowHeight
  }

  return y
}

async function buildStudentPrintableReport(batchId: number, studentId: number) {
  const student = await studentOps.getById(studentId)
  if (!student || student.batch_id !== batchId) {
    throw new Error('Student not found')
  }

  const yearRecords = await yearRecordOps.getByStudent(studentId)
  const payments = await paymentOps.getByStudent(studentId)
  const totalPaid = yearRecords.reduce((sum, record) => sum + record.paid_amount, 0)
  const totalBalance = yearRecords.reduce((sum, record) => sum + record.outstanding_amount, 0)

  const departmentName =
    student.department === 'ECE'
      ? 'DEPARTMENT OF ELECTRONICS AND COMMUNICATION ENGINEERING'
      : 'DEPARTMENT OF BIOMEDICAL ENGINEERING'

  const builder = new PdfBuilder()
  await applySbmLogo(builder)

  drawCenteredHeading(builder, 'SBM COLLEGE OF ENGINEERING AND TECHNOLOGY', 44, 15)
  drawCenteredHeading(builder, departmentName, 66, 11)
  drawCenteredHeading(builder, 'Student Fee Report', 90, 13)

  builder.rect(PAGE_MARGIN, 122, CONTENT_WIDTH, 76)
  drawInfoRow(builder, 136, 'Student Name', `${student.first_name} ${student.last_name}`, 'Register No', student.student_id_roll)
  drawInfoRow(builder, 156, 'Department', student.department, 'Section', student.section)
  drawInfoRow(builder, 176, 'Current Year', student.year, 'Generated On', new Date().toLocaleDateString('en-IN'))

  let y = 222
  drawSectionTitle(builder, 'Year-wise Fee Breakdown', y)
  y = drawTable(
    builder,
    [
      { key: 'year', label: 'Year', width: 35, align: 'center' },
      { key: 'tuition', label: 'Tuition', width: 67, align: 'right' },
      { key: 'books', label: 'Books', width: 56, align: 'right' },
      { key: 'bus', label: 'Bus', width: 52, align: 'right' },
      { key: 'hostel', label: 'Hostel', width: 60, align: 'right' },
      { key: 'misc', label: 'Misc', width: 50, align: 'right' },
      { key: 'total', label: 'Total', width: 65, align: 'right' },
      { key: 'paid', label: 'Paid', width: 62, align: 'right' },
      { key: 'balance', label: 'Balance', width: 68, align: 'right' },
    ],
    yearRecords.map((record) => ({
      year: String(record.year),
      tuition: formatCurrency(record.tuition_fee),
      books: formatCurrency(record.books_fee),
      bus: formatCurrency(record.bus_fee),
      hostel: formatCurrency(record.hostel_fee),
      misc: formatCurrency(record.misc_fee),
      total: formatCurrency(record.total_fee),
      paid: formatCurrency(record.paid_amount),
      balance: formatCurrency(record.outstanding_amount),
    })),
    y + 24,
    56,
  )

  y += 28
  if (y > PAGE_HEIGHT - 180) {
    builder.addPage()
    y = 56
  }

  drawSectionTitle(builder, 'Payment History', y)
  y = drawTable(
    builder,
    [
      { key: 'bill', label: 'Bill No', width: 88 },
      { key: 'receipt', label: 'Receipt No', width: 90 },
      { key: 'date', label: 'Date', width: 74, align: 'center' },
      { key: 'method', label: 'Method', width: 120 },
      { key: 'amount', label: 'Amount', width: 103, align: 'right' },
    ],
    payments.length
      ? payments.map((payment) => ({
          bill: payment.bill_number,
          receipt: payment.receipt_number,
          date: payment.payment_date,
          method: payment.payment_method,
          amount: formatCurrency(payment.amount),
        }))
      : [
          {
            bill: '-',
            receipt: '-',
            date: '-',
            method: 'No payments recorded',
            amount: '-',
          },
        ],
    y + 24,
    56,
  )

  y += 34
  if (y > PAGE_HEIGHT - 120) {
    builder.addPage()
    y = 70
  }

  builder.text(`Total Paid: ${formatCurrency(totalPaid)}`, PAGE_MARGIN, y, {
    font: 'F2',
    size: 11,
    color: '#0f172a',
  })
  builder.text(`Outstanding Balance: ${formatCurrency(totalBalance)}`, PAGE_MARGIN, y + 20, {
    font: 'F2',
    size: 11,
    color: '#0f172a',
  })

  const signatureY = y + 58
  const signatureWidth = 200
  const gap = 60
  const leftX = PAGE_MARGIN
  const rightX = PAGE_MARGIN + signatureWidth + gap

  builder.line(leftX, signatureY, leftX + signatureWidth, signatureY, '#64748b')
  builder.line(rightX, signatureY, rightX + signatureWidth, signatureY, '#64748b')
  builder.text('Tutor Signature', leftX, signatureY + 8, {
    width: signatureWidth,
    align: 'center',
    size: 10,
    color: '#334155',
  })
  builder.text('HOD Signature', rightX, signatureY + 8, {
    width: signatureWidth,
    align: 'center',
    size: 10,
    color: '#334155',
  })

  return {
    filename: `${student.student_id_roll}-fee-report.pdf`,
    buffer: builder.toBuffer(),
  }
}

async function buildGeneralPdfReport(title: string, subtitle: string, columns: TableColumn[], rows: Array<Record<string, string>>) {
  const builder = new PdfBuilder()
  await applySbmLogo(builder)

  drawCenteredHeading(builder, 'Student Management System', 44, 15)
  drawCenteredHeading(builder, title, 68, 13)
  builder.text(subtitle, PAGE_MARGIN, 94, {
    width: CONTENT_WIDTH,
    align: 'center',
    size: 10,
    color: '#475569',
  })

  drawTable(
    builder,
    columns,
    rows.length
      ? rows
      : [Object.fromEntries(columns.map((column, index) => [column.key, index === 0 ? 'No data available' : '-']))],
    128,
    56,
  )

  return builder.toBuffer()
}

export async function GET(request: NextRequest) {
  try {
    const batchId = Number(request.nextUrl.searchParams.get('batch_id'))
    const studentId = Number(request.nextUrl.searchParams.get('student_id'))
    const department = request.nextUrl.searchParams.get('department') as 'ECE' | 'BME' | null
    const type = request.nextUrl.searchParams.get('type') ?? 'summary'
    const format = request.nextUrl.searchParams.get('format') ?? 'csv'

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    }

    if (type === 'student-printable') {
      if (!studentId) {
        return NextResponse.json({ error: 'student_id is required' }, { status: 400 })
      }

      const report = await buildStudentPrintableReport(batchId, studentId)
      return new NextResponse(report.buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${report.filename}"`,
        },
      })
    }

    const students = await studentOps.getByBatch(batchId, department ?? undefined)
    const studentIds = new Set(students.map((student) => student.student_id))
    const yearRecords = (await yearRecordOps.getByBatch(batchId)).filter((record) => studentIds.has(record.student_id))
    const payments = (await paymentOps.getByBatch(batchId)).filter((payment) => studentIds.has(payment.student_id))
    const studentMap = new Map(students.map((student) => [student.student_id, student]))

    let title = 'Batch Summary Report'
    let rows: string[][] = []
    let pdfColumns: TableColumn[] = []
    let pdfRows: Array<Record<string, string>> = []

    if (type === 'pending') {
      title = 'Pending Fees Report'
      rows = [
        ['Reg No', 'Student', 'Department', 'Year', 'Outstanding', 'Status'],
        ...yearRecords
          .filter((record) => record.outstanding_amount > 0)
          .map((record) => {
            const student = studentMap.get(record.student_id)
            return [
              student?.student_id_roll ?? '',
              `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(),
              student?.department ?? '',
              `Year ${record.year}`,
              String(record.outstanding_amount),
              record.status,
            ]
          }),
      ]
      pdfColumns = [
        { key: 'regNo', label: 'Reg No', width: 82 },
        { key: 'student', label: 'Student', width: 150 },
        { key: 'department', label: 'Department', width: 82, align: 'center' },
        { key: 'year', label: 'Year', width: 60, align: 'center' },
        { key: 'outstanding', label: 'Outstanding', width: 85, align: 'right' },
        { key: 'status', label: 'Status', width: 56, align: 'center' },
      ]
      pdfRows = rows.slice(1).map((row) => ({
        regNo: row[0],
        student: row[1],
        department: row[2],
        year: row[3],
        outstanding: formatCurrency(Number(row[4])),
        status: row[5],
      }))
    } else if (type === 'payments') {
      title = 'Payment History Report'
      rows = [
        ['Bill', 'Receipt', 'Reg No', 'Student', 'Amount', 'Method', 'Date'],
        ...payments.map((payment) => {
          const student = studentMap.get(payment.student_id)
          return [
            payment.bill_number,
            payment.receipt_number,
            student?.student_id_roll ?? '',
            `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(),
            String(payment.amount),
            payment.payment_method,
            payment.payment_date,
          ]
        }),
      ]
      pdfColumns = [
        { key: 'bill', label: 'Bill', width: 76 },
        { key: 'receipt', label: 'Receipt', width: 78 },
        { key: 'regNo', label: 'Reg No', width: 74 },
        { key: 'student', label: 'Student', width: 115 },
        { key: 'amount', label: 'Amount', width: 70, align: 'right' },
        { key: 'method', label: 'Method', width: 62, align: 'center' },
        { key: 'date', label: 'Date', width: 64, align: 'center' },
      ]
      pdfRows = rows.slice(1).map((row) => ({
        bill: row[0],
        receipt: row[1],
        regNo: row[2],
        student: row[3],
        amount: formatCurrency(Number(row[4])),
        method: row[5],
        date: row[6],
      }))
    } else if (type === 'students') {
      title = 'Student Fee Report'
      rows = [
        ['Reg No', 'Student', 'Department', 'Year', 'Total Fee', 'Paid', 'Outstanding'],
        ...yearRecords.map((record) => {
          const student = studentMap.get(record.student_id)
          return [
            student?.student_id_roll ?? '',
            `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(),
            student?.department ?? '',
            `Year ${record.year}`,
            String(record.total_fee),
            String(record.paid_amount),
            String(record.outstanding_amount),
          ]
        }),
      ]
      pdfColumns = [
        { key: 'regNo', label: 'Reg No', width: 82 },
        { key: 'student', label: 'Student', width: 145 },
        { key: 'department', label: 'Department', width: 78, align: 'center' },
        { key: 'year', label: 'Year', width: 58, align: 'center' },
        { key: 'total', label: 'Total Fee', width: 70, align: 'right' },
        { key: 'paid', label: 'Paid', width: 68, align: 'right' },
        { key: 'outstanding', label: 'Outstanding', width: 74, align: 'right' },
      ]
      pdfRows = rows.slice(1).map((row) => ({
        regNo: row[0],
        student: row[1],
        department: row[2],
        year: row[3],
        total: formatCurrency(Number(row[4])),
        paid: formatCurrency(Number(row[5])),
        outstanding: formatCurrency(Number(row[6])),
      }))
    } else {
      const totalFees = yearRecords.reduce((sum, record) => sum + record.total_fee, 0)
      const totalPaid = yearRecords.reduce((sum, record) => sum + record.paid_amount, 0)
      const totalOutstanding = yearRecords.reduce((sum, record) => sum + record.outstanding_amount, 0)
      const collectionPercentage = totalFees > 0 ? ((totalPaid / totalFees) * 100).toFixed(1) : '0.0'

      rows = [
        ['Metric', 'Value'],
        ['Total Students', String(students.length)],
        ['Total Fees', String(totalFees)],
        ['Total Paid', String(totalPaid)],
        ['Total Outstanding', String(totalOutstanding)],
        ['Collection Percentage', `${collectionPercentage}%`],
      ]
      pdfColumns = [
        { key: 'metric', label: 'Metric', width: 260 },
        { key: 'value', label: 'Value', width: 255, align: 'right' },
      ]
      pdfRows = [
        { metric: 'Total Students', value: String(students.length) },
        { metric: 'Total Fees', value: formatCurrency(totalFees) },
        { metric: 'Total Paid', value: formatCurrency(totalPaid) },
        { metric: 'Total Outstanding', value: formatCurrency(totalOutstanding) },
        { metric: 'Collection Percentage', value: `${collectionPercentage}%` },
      ]
    }

    if (format === 'pdf') {
      const buffer = await buildGeneralPdfReport(
        title,
        `Generated on ${new Date().toLocaleDateString('en-IN')} for batch ${batchId}${department ? ` | ${department}` : ''}`,
        pdfColumns,
        pdfRows,
      )

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${title.toLowerCase().replaceAll(' ', '-')}.pdf"`,
        },
      })
    }

    const csv = createCsv(rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${title.toLowerCase().replaceAll(' ', '-')}.csv"`,
      },
    })
  } catch (error) {
    console.error('Generate report error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
