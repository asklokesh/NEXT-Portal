import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/client';
import * as mockRoute from './mock-route';

async function POST(request: NextRequest) {
 try {
 // Check if database is available
 try {
 await prisma.$queryRaw`SELECT 1`;
 } catch (dbError) {
 console.warn('Database not available, using mock data for bulk operations');
 return mockRoute.POST(request);
 }
 const data = await request.json();
 const { action, notificationIds, userId = 'current-user' } = data;

 if (!action || !notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
 return NextResponse.json(
 { error: 'Missing required fields: action, notificationIds' },
 { status: 400 }
 );
 }

 let updateFields: any = {};

 switch (action) {
 case 'mark_read':
 updateFields.read = true;
 break;
 case 'mark_unread':
 updateFields.read = false;
 break;
 case 'pin':
 updateFields.pinned = true;
 break;
 case 'unpin':
 updateFields.pinned = false;
 break;
 case 'archive':
 updateFields.archived = true;
 break;
 case 'unarchive':
 updateFields.archived = false;
 break;
 case 'delete':
 // Handle delete separately
 const deleteResult = await prisma.notification.deleteMany({
 where: {
 id: { in: notificationIds },
 userId
 }
 });

 return NextResponse.json({
 message: `${deleteResult.count} notifications deleted successfully`,
 affected: deleteResult.count
 });
 default:
 return NextResponse.json(
 { error: 'Invalid action' },
 { status: 400 }
 );
 }

 updateFields.updatedAt = new Date();

 const result = await prisma.notification.updateMany({
 where: {
 id: { in: notificationIds },
 userId
 },
 data: updateFields
 });

 return NextResponse.json({
 message: `${result.count} notifications updated successfully`,
 affected: result.count
 });
 } catch (error) {
 console.error('Error processing bulk notification action:', error);
 return NextResponse.json(
 { error: 'Failed to process bulk action' },
 { status: 500 }
 );
 }
}

const authenticatedPOST = withAuth(POST);

export { authenticatedPOST as POST };