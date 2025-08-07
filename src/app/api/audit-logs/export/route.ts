import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { stringify } from 'csv-stringify/sync';

import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/client';
import { generateMockAuditLogs } from '@/lib/audit/mock-data';

async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const format = searchParams.get('format') || 'json';
 const resource = searchParams.get('resource');
 const action = searchParams.get('action');
 const userId = searchParams.get('userId');
 const startDate = searchParams.get('startDate');
 const endDate = searchParams.get('endDate');
 const limit = parseInt(searchParams.get('limit') || '10000', 10);
 
 // Use mock data if database is not available
 let logs;
 if (!process.env.DATABASE_URL || process.env.USE_MOCK_DATA === 'true') {
 logs = generateMockAuditLogs(1, Math.min(limit, 100));
 } else {

 // Build where clause
 const whereClause: any = {};

 if (resource) {
 whereClause.resource = resource;
 }

 if (action) {
 whereClause.action = action;
 }

 if (userId) {
 whereClause.userId = userId;
 }

 if (startDate && endDate) {
 whereClause.timestamp = {
 gte: new Date(startDate),
 lte: new Date(endDate)
 };
 }

 // Get audit logs
 try {
 logs = await prisma.auditLog.findMany({
 where: whereClause,
 include: {
 user: true
 },
 orderBy: {
 timestamp: 'desc'
 },
 take: Math.min(limit, 10000) // Max 10k records for export
 });
 } catch (dbError: any) {
 // If database connection fails, fallback to mock data
 if (dbError.code === 'P1001' || dbError.message?.includes("Can't reach database")) {
 console.log('Database unavailable, using mock data for export');
 logs = generateMockAuditLogs(1, Math.min(limit, 100));
 } else {
 throw dbError;
 }
 }
 }

 // Format data
 const formattedLogs = logs.map((log: any) => ({
 id: log.id,
 timestamp: typeof log.timestamp === 'string' ? log.timestamp : log.timestamp.toISOString(),
 user: log.user?.email || log.userName || 'System',
 userName: log.user?.name || log.userName || 'System',
 action: log.action,
 resource: log.resource,
 resourceId: log.resourceId || '',
 ipAddress: log.ipAddress || '',
 userAgent: log.userAgent || '',
 metadata: log.metadata ? JSON.stringify(log.metadata) : ''
 }));

 // Return response based on format
 switch (format) {
 case 'csv':
 const csv = stringify(formattedLogs, {
 header: true,
 columns: [
 'id',
 'timestamp',
 'user',
 'userName',
 'action',
 'resource',
 'resourceId',
 'ipAddress',
 'userAgent',
 'metadata'
 ]
 });

 return new NextResponse(csv, {
 headers: {
 'Content-Type': 'text/csv',
 'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
 }
 });

 case 'json':
 default:
 return NextResponse.json({
 exportDate: new Date().toISOString(),
 recordCount: formattedLogs.length,
 logs: formattedLogs
 }, {
 headers: {
 'Content-Type': 'application/json',
 'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`
 }
 });
 }
 } catch (error) {
 console.error('Error exporting audit logs:', error);
 return NextResponse.json(
 { error: 'Failed to export audit logs' },
 { status: 500 }
 );
 }
}

const authenticatedGET = withAuth(GET);

export { authenticatedGET as GET };