import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/client';
import * as mockRoute from './mock-route';

export interface Notification {
 id: string;
 type: 'error' | 'warning' | 'success' | 'info' | 'mention' | 'system' | 'alert';
 title: string;
 message: string;
 timestamp: string;
 read: boolean;
 pinned: boolean;
 archived: boolean;
 priority: 'urgent' | 'high' | 'medium' | 'low';
 source: {
 name: string;
 type: 'user' | 'system' | 'automation';
 };
 actions?: Array<{
 id: string;
 label: string;
 type: 'primary' | 'secondary' | 'danger';
 url?: string;
 data?: Record<string, any>;
 }>;
 metadata?: Record<string, any>;
 userId?: string;
 entityRef?: string;
 environment?: string;
 createdAt: Date;
 updatedAt: Date;
}

async function getNotifications(request: NextRequest) {
 try {
 // Check if database is available
 try {
 await prisma.$queryRaw`SELECT 1`;
 } catch (dbError) {
 console.warn('Database not available, using mock data');
 return mockRoute.GET(request);
 }
 const { searchParams } = new URL(request.url);
 const page = parseInt(searchParams.get('page') || '1', 10);
 const limit = parseInt(searchParams.get('limit') || '50', 10);
 const filter = searchParams.get('filter'); // 'all', 'unread', 'pinned', 'archived'
 const type = searchParams.get('type');
 const priority = searchParams.get('priority');
 const search = searchParams.get('search');
 const userId = searchParams.get('userId') || 'current-user'; // In production, get from auth

 const skip = (page - 1) * limit;

 // Build where clause
 const whereClause: any = {
 userId,
 };

 // Apply filters
 switch (filter) {
 case 'unread':
 whereClause.read = false;
 whereClause.archived = false;
 break;
 case 'pinned':
 whereClause.pinned = true;
 whereClause.archived = false;
 break;
 case 'archived':
 whereClause.archived = true;
 break;
 default:
 whereClause.archived = false;
 }

 if (type) {
 whereClause.type = type;
 }

 if (priority) {
 whereClause.priority = priority;
 }

 if (search) {
 whereClause.OR = [
 { title: { contains: search, mode: 'insensitive' } },
 { message: { contains: search, mode: 'insensitive' } },
 { sourceName: { contains: search, mode: 'insensitive' } }
 ];
 }

 // Get notifications
 const [notifications, total] = await Promise.all([
 prisma.notification.findMany({
 where: whereClause,
 orderBy: [
 { pinned: 'desc' },
 { 
 priority: 'desc' // This assumes priority is stored as enum with proper ordering
 },
 { createdAt: 'desc' }
 ],
 skip,
 take: limit
 }),
 prisma.notification.count({ where: whereClause })
 ]);

 // Get summary stats
 const summaryStats = await prisma.notification.groupBy({
 by: ['read', 'archived', 'priority', 'type'],
 where: { userId, archived: false },
 _count: true
 });

 const summary = {
 total,
 unread: summaryStats.filter(s => !s.read && !s.archived).reduce((sum, s) => sum + s._count, 0),
 pinned: await prisma.notification.count({ where: { userId, pinned: true, archived: false } }),
 archived: await prisma.notification.count({ where: { userId, archived: true } }),
 byType: summaryStats.reduce((acc, s) => {
 acc[s.type] = (acc[s.type] || 0) + s._count;
 return acc;
 }, {} as Record<string, number>),
 byPriority: summaryStats.reduce((acc, s) => {
 acc[s.priority] = (acc[s.priority] || 0) + s._count;
 return acc;
 }, {} as Record<string, number>)
 };

 return NextResponse.json({
 notifications: notifications.map(n => ({
 ...n,
 timestamp: n.createdAt.toISOString(),
 source: {
 name: n.sourceName,
 type: n.sourceType
 },
 actions: n.actions ? JSON.parse(n.actions) : undefined,
 metadata: n.metadata ? JSON.parse(n.metadata) : undefined
 })),
 pagination: {
 page,
 limit,
 total,
 pages: Math.ceil(total / limit)
 },
 summary
 });
 } catch (error) {
 console.error('Error fetching notifications:', error);
 return NextResponse.json(
 { error: 'Failed to fetch notifications' },
 { status: 500 }
 );
 }
}

async function createNotification(request: NextRequest) {
 try {
 // Check if database is available
 try {
 await prisma.$queryRaw`SELECT 1`;
 } catch (dbError) {
 console.warn('Database not available, using mock data');
 return mockRoute.POST(request);
 }
 const data = await request.json();
 const {
 type,
 title,
 message,
 priority = 'medium',
 source,
 actions,
 metadata,
 userId = 'current-user', // In production, get from auth
 entityRef,
 environment
 } = data;

 // Validate required fields
 if (!type || !title || !message || !source) {
 return NextResponse.json(
 { error: 'Missing required fields: type, title, message, source' },
 { status: 400 }
 );
 }

 // Create notification
 const notification = await prisma.notification.create({
 data: {
 type,
 title,
 message,
 priority,
 sourceName: source.name,
 sourceType: source.type,
 actions: actions ? JSON.stringify(actions) : null,
 metadata: metadata ? JSON.stringify({
 ...metadata,
 entityRef,
 environment
 }) : null,
 userId,
 read: false,
 pinned: false,
 archived: false
 }
 });

 // In production, trigger real-time notifications here
 // await notificationService.broadcast(notification);

 return NextResponse.json({
 message: 'Notification created successfully',
 notification: {
 ...notification,
 timestamp: notification.createdAt.toISOString(),
 source: {
 name: notification.sourceName,
 type: notification.sourceType
 },
 actions: notification.actions ? JSON.parse(notification.actions) : undefined,
 metadata: notification.metadata ? JSON.parse(notification.metadata) : undefined
 }
 });
 } catch (error) {
 console.error('Error creating notification:', error);
 return NextResponse.json(
 { error: 'Failed to create notification' },
 { status: 500 }
 );
 }
}

async function updateNotification(request: NextRequest) {
 try {
 // Check if database is available
 try {
 await prisma.$queryRaw`SELECT 1`;
 } catch (dbError) {
 console.warn('Database not available, using mock data');
 return mockRoute.PUT(request);
 }
 const { searchParams } = new URL(request.url);
 const notificationId = searchParams.get('id');
 
 if (!notificationId) {
 return NextResponse.json(
 { error: 'Notification ID is required' },
 { status: 400 }
 );
 }

 const data = await request.json();
 const { action, ...updateData } = data;

 let updateFields: any = {};

 if (action) {
 // Handle specific actions
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
 default:
 return NextResponse.json(
 { error: 'Invalid action' },
 { status: 400 }
 );
 }
 } else {
 // Direct field updates
 const allowedFields = ['read', 'pinned', 'archived', 'priority'];
 updateFields = Object.keys(updateData)
 .filter(key => allowedFields.includes(key))
 .reduce((obj, key) => {
 obj[key] = updateData[key];
 return obj;
 }, {} as any);
 }

 if (Object.keys(updateFields).length === 0) {
 return NextResponse.json(
 { error: 'No valid fields to update' },
 { status: 400 }
 );
 }

 updateFields.updatedAt = new Date();

 const notification = await prisma.notification.update({
 where: { id: notificationId },
 data: updateFields
 });

 return NextResponse.json({
 message: 'Notification updated successfully',
 notification: {
 ...notification,
 timestamp: notification.createdAt.toISOString(),
 source: {
 name: notification.sourceName,
 type: notification.sourceType
 },
 actions: notification.actions ? JSON.parse(notification.actions) : undefined,
 metadata: notification.metadata ? JSON.parse(notification.metadata) : undefined
 }
 });
 } catch (error) {
 console.error('Error updating notification:', error);
 return NextResponse.json(
 { error: 'Failed to update notification' },
 { status: 500 }
 );
 }
}

async function deleteNotification(request: NextRequest) {
 try {
 // Check if database is available
 try {
 await prisma.$queryRaw`SELECT 1`;
 } catch (dbError) {
 console.warn('Database not available, using mock data');
 return mockRoute.DELETE(request);
 }
 const { searchParams } = new URL(request.url);
 const notificationId = searchParams.get('id');
 
 if (!notificationId) {
 return NextResponse.json(
 { error: 'Notification ID is required' },
 { status: 400 }
 );
 }

 await prisma.notification.delete({
 where: { id: notificationId }
 });

 return NextResponse.json({
 message: 'Notification deleted successfully'
 });
 } catch (error) {
 console.error('Error deleting notification:', error);
 return NextResponse.json(
 { error: 'Failed to delete notification' },
 { status: 500 }
 );
 }
}

// In development or localhost, don't require authentication - use mock data
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DISABLE_AUTH === 'true';

export const GET = isDevelopment ? mockRoute.GET : withAuth(getNotifications);
export const POST = isDevelopment ? mockRoute.POST : withAuth(createNotification);
export const PUT = isDevelopment ? mockRoute.PUT : withAuth(updateNotification);
export const DELETE = isDevelopment ? mockRoute.DELETE : withAuth(deleteNotification);