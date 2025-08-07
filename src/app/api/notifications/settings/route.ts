import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/client';

interface NotificationSettings {
 id: string;
 userId: string;
 preferences: {
 email: {
 enabled: boolean;
 types: string[];
 frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
 };
 push: {
 enabled: boolean;
 types: string[];
 };
 inApp: {
 enabled: boolean;
 types: string[];
 };
 slack: {
 enabled: boolean;
 webhookUrl?: string;
 channel?: string;
 types: string[];
 };
 teams: {
 enabled: boolean;
 webhookUrl?: string;
 types: string[];
 };
 };
 filters: {
 priorities: string[];
 environments: string[];
 entityTypes: string[];
 keywords: string[];
 };
 quietHours: {
 enabled: boolean;
 start: string; // HH:mm format
 end: string; // HH:mm format
 timezone: string;
 };
 createdAt: Date;
 updatedAt: Date;
}

async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const userId = searchParams.get('userId') || 'current-user';

 let settings = await prisma.notificationSettings.findUnique({
 where: { userId }
 });

 // Create default settings if they don't exist
 if (!settings) {
 const defaultSettings = {
 userId,
 preferences: JSON.stringify({
 email: {
 enabled: true,
 types: ['error', 'warning', 'mention'],
 frequency: 'immediate'
 },
 push: {
 enabled: true,
 types: ['error', 'warning', 'mention']
 },
 inApp: {
 enabled: true,
 types: ['error', 'warning', 'success', 'info', 'mention', 'system', 'alert']
 },
 slack: {
 enabled: false,
 types: ['error', 'warning']
 },
 teams: {
 enabled: false,
 types: ['error', 'warning']
 }
 }),
 filters: JSON.stringify({
 priorities: ['urgent', 'high', 'medium', 'low'],
 environments: ['production', 'staging', 'development'],
 entityTypes: ['component', 'api', 'website', 'service'],
 keywords: []
 }),
 quietHours: JSON.stringify({
 enabled: false,
 start: '22:00',
 end: '08:00',
 timezone: 'UTC'
 })
 };

 settings = await prisma.notificationSettings.create({
 data: defaultSettings
 });
 }

 return NextResponse.json({
 settings: {
 id: settings.id,
 userId: settings.userId,
 preferences: JSON.parse(settings.preferences),
 filters: JSON.parse(settings.filters),
 quietHours: JSON.parse(settings.quietHours),
 createdAt: settings.createdAt,
 updatedAt: settings.updatedAt
 }
 });
 } catch (error) {
 console.error('Error fetching notification settings:', error);
 return NextResponse.json(
 { error: 'Failed to fetch notification settings' },
 { status: 500 }
 );
 }
}

async function PUT(request: NextRequest) {
 try {
 const data = await request.json();
 const { userId = 'current-user', preferences, filters, quietHours } = data;

 const updateData: any = {
 updatedAt: new Date()
 };

 if (preferences) {
 updateData.preferences = JSON.stringify(preferences);
 }

 if (filters) {
 updateData.filters = JSON.stringify(filters);
 }

 if (quietHours) {
 updateData.quietHours = JSON.stringify(quietHours);
 }

 const settings = await prisma.notificationSettings.upsert({
 where: { userId },
 create: {
 userId,
 preferences: JSON.stringify(preferences || {}),
 filters: JSON.stringify(filters || {}),
 quietHours: JSON.stringify(quietHours || {})
 },
 update: updateData
 });

 return NextResponse.json({
 message: 'Notification settings updated successfully',
 settings: {
 id: settings.id,
 userId: settings.userId,
 preferences: JSON.parse(settings.preferences),
 filters: JSON.parse(settings.filters),
 quietHours: JSON.parse(settings.quietHours),
 createdAt: settings.createdAt,
 updatedAt: settings.updatedAt
 }
 });
 } catch (error) {
 console.error('Error updating notification settings:', error);
 return NextResponse.json(
 { error: 'Failed to update notification settings' },
 { status: 500 }
 );
 }
}

const authenticatedGET = withAuth(GET);
const authenticatedPUT = withAuth(PUT);

export { authenticatedGET as GET, authenticatedPUT as PUT };