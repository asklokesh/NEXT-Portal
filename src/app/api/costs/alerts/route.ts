import { NextResponse } from 'next/server';

export async function GET() {
 return NextResponse.json({
 alerts: [
 {
 id: '1',
 title: 'Compute costs increased by 20%',
 severity: 'warning',
 timestamp: new Date().toISOString(),
 threshold: 10000,
 current: 12000,
 status: 'active'
 },
 {
 id: '2',
 title: 'Database costs approaching budget',
 severity: 'info',
 timestamp: new Date(Date.now() - 86400000).toISOString(),
 threshold: 3500,
 current: 3200,
 status: 'active'
 }
 ],
 total: 2
 });
}