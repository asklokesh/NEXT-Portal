import { NextResponse } from 'next/server';

export async function GET() {
 return NextResponse.json({
 total: 1247,
 today: 23,
 week: 156,
 month: 678,
 byAction: {
 CREATE_ENTITY: 234,
 UPDATE_ENTITY: 456,
 DELETE_ENTITY: 89,
 CREATE_TEMPLATE: 45,
 UPDATE_TEMPLATE: 123,
 LOGIN: 300
 },
 byStatus: {
 success: 1100,
 failure: 147
 }
 });
}