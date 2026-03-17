'use client'

import React, { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { AlertCircle, FileText, Upload } from 'lucide-react'
import useSWR from 'swr'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBatch } from '@/context/batch-context'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

type YearFeeRow = {
  year: number
  tuition_fee: number
  books_fee: number
  bus_fee: number
  hostel_fee: number
  misc_fee: number
}

type CsvRow = {
  student_id_roll: string
  first_name: string
  last_name: string
  year: '1' | '2' | '3' | '4'
  section: string
  email?: string
  phone?: string
  hostel_status?: 'day-scholar' | 'hostel'
  year_fees: YearFeeRow[]
}

type ImportAction = 'create' | 'skip' | 'update'

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeRoll(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '')
}

function mapHeaders(headers: string[]) {
  const map = new Map<string, string>()
  headers.forEach((header) => {
    const key = normalizeHeader(header)
    if (['studentidroll', 'regno', 'regnumber', 'rollno', 'studentid'].includes(key)) {
      map.set(header, 'student_id_roll')
      return
    }
    if (['firstname', 'first'].includes(key)) {
      map.set(header, 'first_name')
      return
    }
    if (['lastname', 'last'].includes(key)) {
      map.set(header, 'last_name')
      return
    }
    if (key === 'year') {
      map.set(header, 'year')
      return
    }
    if (key === 'section') {
      map.set(header, 'section')
      return
    }
    if (key === 'email') {
      map.set(header, 'email')
      return
    }
    if (key === 'phone' || key === 'phonenumber') {
      map.set(header, 'phone')
      return
    }
    if (key === 'hostelstatus') {
      map.set(header, 'hostel_status')
      return
    }
    map.set(header, header)
  })
  return map
}

function parseCsv(text: string): CsvRow[] {
  const cleaned = text.replace(/^\uFEFF/, '')
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimiter: '',
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  })

  if (!parsed.data?.length) return []

  const headerMap = mapHeaders(parsed.meta.fields ?? [])

  return parsed.data.map((row) => {
    const normalized: Record<string, string> = {}
    for (const [header, value] of Object.entries(row)) {
      const key = headerMap.get(header) ?? header
      normalized[key] = value ?? ''
    }

    return {
      student_id_roll: normalized.student_id_roll ?? '',
      first_name: normalized.first_name ?? '',
      last_name: normalized.last_name ?? '',
      year: (String(normalized.year ?? '').trim() as '1' | '2' | '3' | '4') || '1',
      section: normalized.section ?? 'A',
      email: normalized.email ?? '',
      phone: normalized.phone ?? '',
      hostel_status: normalized.hostel_status === 'hostel' ? 'hostel' : 'day-scholar',
      year_fees: [1, 2, 3, 4].map((year) => ({
        year,
        tuition_fee: toNumber(normalized[`year${year}_tuition_fee`]),
        books_fee: toNumber(normalized[`year${year}_books_fee`]),
        bus_fee: toNumber(normalized[`year${year}_bus_fee`]),
        hostel_fee: toNumber(normalized[`year${year}_hostel_fee`]),
        misc_fee: toNumber(normalized[`year${year}_misc_fee`]),
      })),
    }
  })
}

export default function ImportPage() {
  const { batch } = useBatch()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [actionsByRoll, setActionsByRoll] = useState<Record<string, ImportAction>>({})

  const { data: existingStudents = [] } = useSWR<Array<{ student_id: number; student_id_roll: string }>>(
    batch ? `/api/students?batch_id=${batch.batch_id}&department=${batch.department}` : null,
    fetcher,
  )

  const validRows = rows.filter((row) => row.student_id_roll && row.first_name && row.last_name && row.year_fees.length === 4)
  const invalidCount = rows.length - validRows.length

  const existingRolls = useMemo(() => {
    const map = new Map<string, { student_id: number; student_id_roll: string }>()
    existingStudents.forEach((student) => map.set(normalizeRoll(student.student_id_roll), student))
    return map
  }, [existingStudents])

  const previewRows = useMemo(() => {
    return rows.map((row) => {
      const rollKey = normalizeRoll(row.student_id_roll || '')
      const isValid = Boolean(row.student_id_roll && row.first_name && row.last_name && row.year_fees?.length === 4)
      const existing = rollKey ? existingRolls.get(rollKey) ?? null : null
      const isDuplicate = Boolean(existing)
      const action: ImportAction = actionsByRoll[rollKey] ?? (isDuplicate ? 'skip' : 'create')
      return { row, rollKey, isValid, existing, isDuplicate, action }
    })
  }, [actionsByRoll, existingRolls, rows])

  const duplicateCount = previewRows.filter((item) => item.isDuplicate && item.isValid).length
  const createCount = previewRows.filter((item) => item.isValid && item.action === 'create').length
  const updateCount = previewRows.filter((item) => item.isValid && item.action === 'update').length
  const skipCount = previewRows.filter((item) => item.isValid && item.action === 'skip').length

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Error', description: 'Please select a CSV file', variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      const text = await file.text()
      const parsedRows = parseCsv(text)
      setRows(parsedRows)
      setActionsByRoll({})
      toast({ title: 'File loaded', description: `Found ${parsedRows.length} rows to review` })
    } catch {
      toast({ title: 'Error', description: 'Failed to read CSV file', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  async function importRows() {
    if (!batch || !validRows.length) return

    setIsLoading(true)
    try {
      const payloadRows = previewRows
        .filter((item) => item.isValid)
        .map((item) => ({
          ...item.row,
          action: item.action,
        }))

      const response = await fetch('/api/import/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.batch_id,
          department: batch.department,
          rows: payloadRows,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import students')
      }

      const errorCount = Array.isArray(result.errors) ? result.errors.length : 0
      toast({
        title: 'Import complete',
        description: `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}${errorCount ? `, errors ${errorCount}` : ''}`,
      })

      setRows([])
      setActionsByRoll({})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import students'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Import Students</h1>
        <p className="text-slate-600 mt-1">Bulk import {batch?.department} students from CSV</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import CSV File</CardTitle>
              <CardDescription>Upload a CSV file with student details and per-year fees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <p className="text-sm font-medium text-slate-900 mb-1">Drop your CSV file here</p>
                <p className="text-sm text-slate-600 mb-4">or click to select</p>
                <Input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>Select File</Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">CSV Format Required</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Use the template with `year`, `section`, and year1 to year4 fee columns. Department is taken from your login.
                    </p>
                  </div>
                </div>
              </div>

              {rows.length ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Previewing {rows.length} rows{invalidCount ? ` (${invalidCount} invalid)` : ''}
                    </p>
                    <Button onClick={importRows} disabled={isLoading || !validRows.length}>Import</Button>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>
                      Duplicates detected: <span className="font-semibold text-slate-900">{duplicateCount}</span>
                    </p>
                    <p>
                      Plan: create <span className="font-semibold text-slate-900">{createCount}</span>, update{' '}
                      <span className="font-semibold text-slate-900">{updateCount}</span>, skip{' '}
                      <span className="font-semibold text-slate-900">{skipCount}</span>
                    </p>
                  </div>
                  {invalidCount ? (
                    <p className="text-xs text-amber-600">
                      Some rows are missing required fields (Reg No, first name, last name). Please fix them in the CSV.
                    </p>
                  ) : null}
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reg No</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Year 1 Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.slice(0, 25).map((item, index) => {
                          const row = item.row
                          const yearOne = row.year_fees[0]
                          const yearOneTotal = yearOne.tuition_fee + yearOne.books_fee + yearOne.bus_fee + yearOne.hostel_fee + yearOne.misc_fee
                          const statusLabel = !item.isValid ? 'Invalid' : item.isDuplicate ? 'Duplicate' : 'New'
                          const statusClass = !item.isValid ? 'text-red-700' : item.isDuplicate ? 'text-amber-700' : 'text-green-700'

                          return (
                            <TableRow key={`${row.student_id_roll}-${index}`}>
                              <TableCell>{row.student_id_roll}</TableCell>
                              <TableCell>{row.first_name} {row.last_name}</TableCell>
                              <TableCell>{row.year}</TableCell>
                              <TableCell>{row.section}</TableCell>
                              <TableCell className={`font-semibold ${statusClass}`}>{statusLabel}</TableCell>
                              <TableCell>
                                {item.isValid ? (
                                  <Select
                                    value={item.action}
                                    onValueChange={(value) => {
                                      const next = value as ImportAction
                                      setActionsByRoll((current) => ({ ...current, [item.rollKey]: next }))
                                    }}
                                    disabled={isLoading}
                                  >
                                    <SelectTrigger className="h-8 w-[120px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="create">Create</SelectItem>
                                      <SelectItem value="skip">Skip</SelectItem>
                                      <SelectItem value="update" disabled={!item.isDuplicate}>
                                        Update
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-xs text-slate-500">Fix CSV</span>
                                )}
                              </TableCell>
                              <TableCell>{formatCurrency(yearOneTotal)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-slate-500">Showing first 25 rows.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">Upload a CSV, review the preview, then import all valid rows into the current logged-in department.</p>
              <Button className="w-full" variant="outline" size="sm" asChild>
                <a href="/students-template.csv" download>
                  Download Template
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-slate-600 space-y-2">
            <li>- Students are imported into the department you selected at login</li>
            <li>- Reg numbers must be unique inside the same batch and department</li>
            <li>- Year-wise fees come directly from the CSV template</li>
            <li>- Imported records can still be edited later from the student details page</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
