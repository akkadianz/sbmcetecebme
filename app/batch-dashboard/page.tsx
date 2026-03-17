'use client'

import { useEffect, useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBatch } from '@/context/batch-context'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, FileText, TrendingUp, Users } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

interface Student {
  student_id: number
}

interface YearRecord {
  total_fee: number
  paid_amount: number
  outstanding_amount: number
}

interface DashboardStats {
  totalStudents: number
  totalFees: number
  totalPaid: number
  totalOutstanding: number
  collectionPercentage: number
}

function StatCard({ icon: Icon, title, value, description }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">{title}</span>
          <Icon className="h-5 w-5 text-slate-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description ? <p className="text-sm text-slate-600 mt-1">{description}</p> : null}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { batch } = useBatch()
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalFees: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    collectionPercentage: 0,
  })

  const { data: students } = useSWR<Student[]>(
    batch ? `/api/students?batch_id=${batch.batch_id}&department=${batch.department}` : null,
    fetcher,
  )

  useEffect(() => {
    const calculateStats = async () => {
      if (!students || !batch) return

      let totalFees = 0
      let totalPaid = 0
      let totalOutstanding = 0

      for (const student of students) {
        const response = await fetch(`/api/students/${student.student_id}?batch_id=${batch.batch_id}`)
        const data = await response.json()
        for (const record of (data.year_records ?? []) as YearRecord[]) {
          totalFees += record.total_fee
          totalPaid += record.paid_amount
          totalOutstanding += record.outstanding_amount
        }
      }

      setStats({
        totalStudents: students.length,
        totalFees,
        totalPaid,
        totalOutstanding,
        collectionPercentage: totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0,
      })
    }

    calculateStats().catch((error) => {
      console.error('Dashboard stats error:', error)
    })
  }, [students, batch])

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of your {batch?.department} batch student management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} title="Total Students" value={stats.totalStudents} description={`Active in ${batch?.batch_name} - ${batch?.department}`} />
        <StatCard icon={CreditCard} title="Total Fees" value={formatCurrency(stats.totalFees)} description="Sum of all fees" />
        <StatCard icon={FileText} title="Total Paid" value={formatCurrency(stats.totalPaid)} description="Amount collected" />
        <StatCard icon={TrendingUp} title="Collection %" value={`${stats.collectionPercentage}%`} description="of total fees" />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Fees</CardTitle>
            <CardDescription>Amount pending collection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</div>
            <p className="text-sm text-slate-600 mt-2">
              {stats.totalFees > 0 ? ((stats.totalOutstanding / stats.totalFees) * 100).toFixed(1) : '0.0'}% of total fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Info</CardTitle>
            <CardDescription>Batch information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm"><span className="font-medium">Batch Name:</span> {batch?.batch_name}</p>
              <p className="text-sm"><span className="font-medium">Total Students:</span> {stats.totalStudents}</p>
              <p className="text-sm">
                <span className="font-medium">Average Fee per Student:</span>{' '}
                {stats.totalStudents > 0 ? formatCurrency(Math.round(stats.totalFees / stats.totalStudents)) : formatCurrency(0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
