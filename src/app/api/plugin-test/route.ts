import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
 try {
 return NextResponse.json({
 message: 'Test endpoint working',
 timestamp: new Date().toISOString(),
 url: req.url
 });
 } catch (error) {
 return NextResponse.json(
 { error: 'Test failed' },
 { status: 500 }
 );
 }
}