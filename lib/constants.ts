export const FEE_TYPES = [
  { value: 'tuition', label: 'Tuition Fee' },
  { value: 'books', label: 'Books Fee' },
  { value: 'bus', label: 'Bus Fee' },
  { value: 'hostel', label: 'Hostel Fee' },
  { value: 'misc', label: 'Miscellaneous' },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

export const DEPARTMENTS = [
  { value: 'ECE', label: 'ECE' },
  { value: 'BME', label: 'BME' },
] as const

export const DEPARTMENT_FULL_NAMES = {
  ECE: 'Department of Electronics and Communication Engineering',
  BME: 'Department of Biomedical Engineering',
} as const

export const COURSE_OPTIONS = DEPARTMENTS.map((department) => department.value)

export const STUDENT_YEARS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
]

export const SECTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
]

export const HOSTEL_STATUS = [
  { value: 'day-scholar', label: 'Day Scholar' },
  { value: 'hostel', label: 'Hostel' },
]
