import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Default fee settings have been removed. Fees are managed per student and per year.',
  })
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Default fee settings are no longer supported.' },
    { status: 400 },
  )
}
