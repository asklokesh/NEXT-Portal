import { NextRequest, NextResponse } from 'next/server';

// Mock notifications data
const mockNotifications = [
 {
 id: '1',
 type: 'info',
 title: 'Welcome to the Portal',
 message: 'Your development environment is now set up and ready to use.',
 timestamp: new Date().toISOString(),
 read: false,
 pinned: false,
 archived: false,
 priority: 'medium',
 source: {
 name: 'System',
 type: 'system'
 },
 userId: 'current-user',
 createdAt: new Date(),
 updatedAt: new Date()
 },
 {
 id: '2',
 type: 'success',
 title: 'Service Deployed Successfully',
 message: 'Your service has been deployed to production environment.',
 timestamp: new Date(Date.now() - 3600000).toISOString(),
 read: true,
 pinned: false,
 archived: false,
 priority: 'high',
 source: {
 name: 'Deployment Bot',
 type: 'automation'
 },
 actions: [
 {
 id: 'view-service',
 label: 'View Service',
 type: 'primary',
 url: '/catalog/services'
 }
 ],
 userId: 'current-user',
 createdAt: new Date(Date.now() - 3600000),
 updatedAt: new Date(Date.now() - 3600000)
 },
 {
 id: '3',
 type: 'warning',
 title: 'High Memory Usage Detected',
 message: 'Service API is using 85% of allocated memory.',
 timestamp: new Date(Date.now() - 7200000).toISOString(),
 read: false,
 pinned: true,
 archived: false,
 priority: 'urgent',
 source: {
 name: 'Monitoring',
 type: 'system'
 },
 actions: [
 {
 id: 'view-metrics',
 label: 'View Metrics',
 type: 'primary',
 url: '/monitoring'
 },
 {
 id: 'scale-service',
 label: 'Scale Service',
 type: 'secondary',
 url: '/services/api/scale'
 }
 ],
 userId: 'current-user',
 createdAt: new Date(Date.now() - 7200000),
 updatedAt: new Date(Date.now() - 7200000)
 }
];

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const page = parseInt(searchParams.get('page') || '1', 10);
 const limit = parseInt(searchParams.get('limit') || '50', 10);
 const filter = searchParams.get('filter');
 const type = searchParams.get('type');
 const search = searchParams.get('search');

 let filteredNotifications = [...mockNotifications];

 // Apply filters
 if (filter === 'unread') {
 filteredNotifications = filteredNotifications.filter(n => !n.read && !n.archived);
 } else if (filter === 'pinned') {
 filteredNotifications = filteredNotifications.filter(n => n.pinned && !n.archived);
 } else if (filter === 'archived') {
 filteredNotifications = filteredNotifications.filter(n => n.archived);
 } else {
 filteredNotifications = filteredNotifications.filter(n => !n.archived);
 }

 if (type && type !== 'all') {
 filteredNotifications = filteredNotifications.filter(n => n.type === type);
 }

 if (search) {
 const searchLower = search.toLowerCase();
 filteredNotifications = filteredNotifications.filter(n =>
 n.title.toLowerCase().includes(searchLower) ||
 n.message.toLowerCase().includes(searchLower) ||
 n.source.name.toLowerCase().includes(searchLower)
 );
 }

 // Paginate
 const start = (page - 1) * limit;
 const paginatedNotifications = filteredNotifications.slice(start, start + limit);

 const summary = {
 total: filteredNotifications.length,
 unread: mockNotifications.filter(n => !n.read && !n.archived).length,
 pinned: mockNotifications.filter(n => n.pinned && !n.archived).length,
 archived: mockNotifications.filter(n => n.archived).length,
 byType: {
 info: mockNotifications.filter(n => n.type === 'info').length,
 success: mockNotifications.filter(n => n.type === 'success').length,
 warning: mockNotifications.filter(n => n.type === 'warning').length,
 error: mockNotifications.filter(n => n.type === 'error').length
 },
 byPriority: {
 urgent: mockNotifications.filter(n => n.priority === 'urgent').length,
 high: mockNotifications.filter(n => n.priority === 'high').length,
 medium: mockNotifications.filter(n => n.priority === 'medium').length,
 low: mockNotifications.filter(n => n.priority === 'low').length
 }
 };

 return NextResponse.json({
 notifications: paginatedNotifications,
 pagination: {
 page,
 limit,
 total: filteredNotifications.length,
 pages: Math.ceil(filteredNotifications.length / limit)
 },
 summary
 });
 } catch (error) {
 console.error('Error in mock notifications:', error);
 return NextResponse.json(
 { error: 'Failed to fetch notifications' },
 { status: 500 }
 );
 }
}

export async function POST(request: NextRequest) {
 try {
 const data = await request.json();
 const newNotification = {
 id: Date.now().toString(),
 ...data,
 read: false,
 pinned: false,
 archived: false,
 timestamp: new Date().toISOString(),
 createdAt: new Date(),
 updatedAt: new Date()
 };
 
 mockNotifications.unshift(newNotification);
 
 return NextResponse.json({
 message: 'Notification created successfully',
 notification: newNotification
 });
 } catch (error) {
 return NextResponse.json(
 { error: 'Failed to create notification' },
 { status: 500 }
 );
 }
}

export async function PUT(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const notificationId = searchParams.get('id');
 
 if (!notificationId) {
 return NextResponse.json(
 { error: 'Notification ID is required' },
 { status: 400 }
 );
 }

 const data = await request.json();
 const { action } = data;
 
 const notificationIndex = mockNotifications.findIndex(n => n.id === notificationId);
 if (notificationIndex === -1) {
 return NextResponse.json(
 { error: 'Notification not found' },
 { status: 404 }
 );
 }

 const notification = mockNotifications[notificationIndex];

 switch (action) {
 case 'mark_read':
 notification.read = true;
 break;
 case 'mark_unread':
 notification.read = false;
 break;
 case 'pin':
 notification.pinned = true;
 break;
 case 'unpin':
 notification.pinned = false;
 break;
 case 'archive':
 notification.archived = true;
 break;
 case 'unarchive':
 notification.archived = false;
 break;
 }

 notification.updatedAt = new Date();

 return NextResponse.json({
 message: 'Notification updated successfully',
 notification
 });
 } catch (error) {
 return NextResponse.json(
 { error: 'Failed to update notification' },
 { status: 500 }
 );
 }
}

export async function DELETE(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const notificationId = searchParams.get('id');
 
 if (!notificationId) {
 return NextResponse.json(
 { error: 'Notification ID is required' },
 { status: 400 }
 );
 }

 const index = mockNotifications.findIndex(n => n.id === notificationId);
 if (index !== -1) {
 mockNotifications.splice(index, 1);
 }

 return NextResponse.json({
 message: 'Notification deleted successfully'
 });
 } catch (error) {
 return NextResponse.json(
 { error: 'Failed to delete notification' },
 { status: 500 }
 );
 }
}