import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toFiniteNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export function formatCurrency(amount: number | string | null | undefined) {
  const safeAmount = toFiniteNumber(amount)
  return `Rs. ${safeAmount.toLocaleString('en-IN')}`
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
