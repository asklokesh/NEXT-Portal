import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'GitHub catalog scan initiated',
    jobId: `scan-${Date.now()}`,
    status: 'pending',
  });
}
