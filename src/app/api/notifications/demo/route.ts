/**
 * Demo API Routes for Notification System
 * 
 * These routes demonstrate how to integrate the notification system
 * with Next.js API routes for server-side notification handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationSystem } from '@/services/notifications';

// POST /api/notifications/demo/send
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      userId = 'demo-user',
      title,
      message,
      priority = 'normal',
      channel,
      data,
      templateId,
    } = body;

    // Validate required fields
    if (!title && !templateId) {
      return NextResponse.json(
        { error: 'Either title or templateId is required' },
        { status: 400 }
      );
    }

    if (!message && !templateId) {
      return NextResponse.json(
        { error: 'Message is required when not using template' },
        { status: 400 }
      );
    }

    // Send notification using the unified system
    let notificationId: string;
    
    if (templateId) {
      // Use template-based notification
      notificationId = await notificationSystem.getNotificationEngine().send({
        userId,
        templateId,
        priority,
        channel,
        data,
      });
    } else {
      // Use simple notification
      notificationId = await notificationSystem.sendNotification({
        userId,
        title,
        message,
        priority,
        channel,
        data,
      });
    }

    return NextResponse.json({
      success: true,
      notificationId,
      message: 'Notification sent successfully',
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET /api/notifications/demo/status
export async function GET() {
  try {
    // Get system status
    const alertMetrics = notificationSystem.getAlertManager().getMetrics();
    const legacyService = notificationSystem.getLegacyNotificationService();
    
    // Sample user preferences (in real app, get from database)
    const samplePreferences = await notificationSystem.getNotificationEngine().getUserPreferences('demo-user');
    
    const status = {
      system: {
        initialized: true,
        version: '1.0.0',
        uptime: process.uptime(),
      },
      notificationEngine: {
        channels: ['email', 'slack', 'teams', 'discord', 'in-app', 'webhook'],
        templates: notificationSystem.getNotificationEngine().listTemplates().length,
      },
      alertManager: {
        totalAlerts: alertMetrics.totalAlerts,
        firingAlerts: alertMetrics.firingAlerts,
        mttr: alertMetrics.mttr,
        alertNoise: alertMetrics.alertNoise,
      },
      communicationHub: {
        available: !!notificationSystem.getCommunicationHub(),
        status: notificationSystem.getCommunicationHub() ? 'active' : 'not-initialized',
      },
      legacy: {
        connected: legacyService.isConnected(),
        unreadCount: legacyService.getUnreadCount(),
      },
      samplePreferences,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get system status:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get system status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Examples of different notification types
export const notificationExamples = {
  // Simple text notification
  simple: {
    userId: 'demo-user',
    title: 'Welcome to the Platform',
    message: 'Your account has been created successfully!',
    priority: 'normal',
  },
  
  // High priority alert
  alert: {
    userId: 'demo-user',
    title: 'System Alert',
    message: 'High CPU usage detected on production servers',
    priority: 'high',
    channel: 'slack',
  },
  
  // Template-based notification
  template: {
    userId: 'demo-user',
    templateId: 'deployment-status',
    priority: 'normal',
    data: {
      serviceName: 'user-service',
      environment: 'production',
      version: 'v1.2.3',
      success: true,
      link: 'https://dashboard.example.com/deployments/123',
    },
  },
  
  // Rich media notification
  richMedia: {
    userId: 'demo-user',
    title: 'Performance Report',
    message: 'Weekly performance metrics are now available',
    priority: 'normal',
    data: {
      reportUrl: 'https://dashboard.example.com/reports/weekly',
      metrics: {
        uptime: '99.9%',
        responseTime: '150ms',
        errorRate: '0.01%',
      },
    },
  },
  
  // Incident notification
  incident: {
    userId: 'demo-user',
    templateId: 'incident-alert',
    priority: 'critical',
    data: {
      title: 'Database Connection Issues',
      severity: 'high',
      service: 'user-service',
      time: new Date().toISOString(),
      impact: 'User authentication is affected',
      description: 'Unable to connect to primary database cluster',
      link: 'https://dashboard.example.com/incidents/456',
      critical: true,
    },
  },
};