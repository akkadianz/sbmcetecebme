import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Custom batch creation is disabled. Please use one of the available batches.' },
    { status: 403 }
  );
}
