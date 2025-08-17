#!/usr/bin/env node

/**
 * Script to add missing dependencies for the notification and communication system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define the required dependencies
const dependencies = [
  'handlebars@^4.7.8',
  'rate-limiter-flexible@^3.0.8',
  'p-queue@^7.4.1',
  'nodemailer@^6.9.8',
  '@slack/web-api@^6.10.0',
  'discord.js@^14.14.1',
];

const devDependencies = [
  '@types/handlebars@^4.1.0',
  '@types/nodemailer@^6.4.14',
];

console.log('🚀 Adding notification system dependencies...\n');

// Add production dependencies
console.log('📦 Installing production dependencies:');
dependencies.forEach(dep => console.log(`  - ${dep}`));
console.log('');

try {
  execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit' });
  console.log('✅ Production dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install production dependencies:', error.message);
  process.exit(1);
}

// Add development dependencies
console.log('🛠️  Installing development dependencies:');
devDependencies.forEach(dep => console.log(`  - ${dep}`));
console.log('');

try {
  execSync(`npm install --save-dev ${devDependencies.join(' ')}`, { stdio: 'inherit' });
  console.log('✅ Development dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install development dependencies:', error.message);
  process.exit(1);
}

// Check if environment variables file exists, if not create template
const envPath = path.join(__dirname, '..', '.env.local');
const envTemplatePath = path.join(__dirname, '..', '.env.notification-template');

if (!fs.existsSync(envPath)) {
  console.log('📄 Creating environment variables template...');
  
  const envTemplate = `
# Notification System Configuration
# Copy these variables to your .env.local file

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Your Name <your-email@gmail.com>"

# Slack Integration
SLACK_TOKEN=xoxb-your-slack-bot-token
SLACK_DEFAULT_CHANNEL=#general

# Teams Integration
TEAMS_WEBHOOK=https://outlook.office.com/webhook/your-webhook-url

# Discord Integration
DISCORD_TOKEN=your-discord-bot-token
DISCORD_DEFAULT_CHANNEL=your-channel-id

# Redis Configuration (for scaling)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=http://localhost:4403

# ML Models (optional)
ALERT_PREDICTION_MODEL_PATH=./models/alert-prediction
ANOMALY_DETECTION_MODEL_PATH=./models/anomaly-detection

# Message Encryption (optional)
MESSAGE_ENCRYPTION_KEY=your-32-character-encryption-key

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4400
`;
  
  fs.writeFileSync(envTemplatePath, envTemplate);
  console.log(`✅ Environment template created at ${envTemplatePath}`);
  console.log('📝 Please copy the relevant variables to your .env.local file\n');
}

// Create configuration guide
const configGuidePath = path.join(__dirname, '..', 'docs', 'NOTIFICATION_SETUP.md');

if (!fs.existsSync(path.dirname(configGuidePath))) {
  fs.mkdirSync(path.dirname(configGuidePath), { recursive: true });
}

const configGuide = `# Notification System Setup Guide

This guide will help you configure the advanced notification and communication system.

## Quick Start

### 1. Basic Setup (In-App Notifications Only)

\`\`\`typescript
import { notificationSystem, quickStart } from '@/services/notifications';

// Initialize with basic configuration
const system = quickStart.basic();

// Send a notification
await system.sendNotification({
  userId: 'user123',
  title: 'Welcome!',
  message: 'Your account has been created successfully',
  priority: 'normal'
});
\`\`\`

### 2. Full Setup (With Real-Time Communication)

\`\`\`typescript
import { createServer } from 'http';
import { notificationSystem, quickStart } from '@/services/notifications';

// Create HTTP server for WebSocket
const server = createServer();

// Initialize with full configuration
const system = quickStart.full(server);

// Start server
server.listen(4403, () => {
  console.log('Communication server running on port 4403');
});
\`\`\`

## Configuration

### Email (SMTP)

\`\`\`typescript
import { configureNotifications } from '@/services/notifications';

configureNotifications.email({
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password'
    }
  },
  from: 'Your Name <your-email@gmail.com>'
});
\`\`\`

### Slack

\`\`\`typescript
configureNotifications.slack({
  token: 'xoxb-your-slack-bot-token',
  defaultChannel: '#general'
});
\`\`\`

### Teams

\`\`\`typescript
configureNotifications.teams({
  webhookUrl: 'https://outlook.office.com/webhook/your-webhook-url'
});
\`\`\`

### Discord

\`\`\`typescript
configureNotifications.discord({
  token: 'your-discord-bot-token',
  defaultChannel: 'your-channel-id'
});
\`\`\`

### PagerDuty

\`\`\`typescript
await configureNotifications.pagerduty({
  apiKey: 'your-pagerduty-integration-key',
  routingKey: 'your-routing-key'
});
\`\`\`

### OpsGenie

\`\`\`typescript
await configureNotifications.opsgenie({
  apiKey: 'your-opsgenie-api-key',
  region: 'us' // or 'eu'
});
\`\`\`

## Features

### 1. Multi-Channel Notifications

The notification engine supports multiple channels:
- **Email** - SMTP-based email notifications
- **Slack** - Direct messages and channel notifications
- **Teams** - Microsoft Teams channel notifications
- **Discord** - Discord server notifications
- **In-App** - Browser notifications and UI alerts
- **Webhooks** - Custom HTTP endpoints
- **SMS** - Text message notifications (requires integration)
- **Push** - Mobile push notifications (requires integration)

### 2. Real-Time Communication

- **Instant Messaging** - Channel-based chat with threads
- **Video/Voice Calls** - WebRTC-based calling
- **Screen Sharing** - Share screens during calls
- **File Sharing** - Upload and share files
- **Presence** - See who's online and their status
- **Mentions** - @mention users in messages
- **Reactions** - React to messages with emojis

### 3. Intelligent Alerting

- **Alert Correlation** - Group related alerts together
- **Deduplication** - Prevent duplicate alerts
- **Escalation Policies** - Route alerts based on severity
- **On-Call Scheduling** - Rotate on-call responsibilities
- **Incident Management** - Create and track incidents
- **ML Predictions** - Predict future alerts using machine learning

### 4. Advanced Features

- **Quiet Hours** - Respect user's do-not-disturb settings
- **Batching** - Group notifications into digests
- **Rate Limiting** - Prevent notification spam
- **Rich Media** - Include images, charts, and code snippets
- **Templates** - Reusable notification templates
- **GDPR Compliance** - Privacy controls and data retention

## Usage Examples

### Send Notifications

\`\`\`typescript
import { notificationSystem } from '@/services/notifications';

// Simple notification
await notificationSystem.sendNotification({
  userId: 'user123',
  title: 'Deployment Complete',
  message: 'Your application has been deployed to production',
  priority: 'normal'
});

// Rich notification with data
await notificationSystem.getNotificationEngine().send({
  userId: 'user123',
  templateId: 'deployment-status',
  priority: 'high',
  data: {
    serviceName: 'user-service',
    environment: 'production',
    version: 'v1.2.3',
    success: true
  },
  richMedia: [{
    type: 'image',
    url: 'https://example.com/deployment-chart.png',
    alt: 'Deployment metrics chart'
  }]
});
\`\`\`

### Create Alerts

\`\`\`typescript
// Create an alert
await notificationSystem.createAlert({
  name: 'High CPU Usage',
  severity: 'warning',
  source: 'monitoring',
  service: 'user-service',
  message: 'CPU usage is above 80% for 5 minutes',
  labels: {
    environment: 'production',
    team: 'platform'
  }
});
\`\`\`

### User Preferences

\`\`\`typescript
// Set user notification preferences
await notificationSystem.getNotificationEngine().setUserPreferences({
  userId: 'user123',
  channels: {
    email: { 
      enabled: true,
      quietHours: { start: '22:00', end: '08:00' }
    },
    slack: { enabled: true },
    'in-app': { enabled: true }
  },
  batching: {
    enabled: true,
    interval: 60, // minutes
    maxBatch: 10
  }
});
\`\`\`

## Integration with Next.js

### API Routes

Create API routes to handle notifications:

\`\`\`typescript
// pages/api/notifications/send.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { notificationSystem } from '@/services/notifications';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const notificationId = await notificationSystem.sendNotification(req.body);
      res.status(200).json({ success: true, id: notificationId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
\`\`\`

### React Components

Use the notification system in React components:

\`\`\`typescript
import { useEffect, useState } from 'react';
import { notificationService } from '@/services/notifications';

export function NotificationBell() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const updateCount = () => {
      setCount(notificationService.getUnreadCount());
    };
    
    notificationService.on('new_notification', updateCount);
    notificationService.on('notification_read', updateCount);
    
    return () => {
      notificationService.off('new_notification', updateCount);
      notificationService.off('notification_read', updateCount);
    };
  }, []);
  
  return (
    <button className="notification-bell">
      🔔 {count > 0 && <span>{count}</span>}
    </button>
  );
}
\`\`\`

## Security Considerations

1. **API Keys** - Store sensitive API keys in environment variables
2. **Rate Limiting** - Built-in rate limiting prevents abuse
3. **Encryption** - Optional message encryption for sensitive data
4. **Authentication** - Integrate with your authentication system
5. **CORS** - Configure allowed origins for WebSocket connections

## Monitoring and Analytics

The system provides comprehensive metrics:

\`\`\`typescript
const metrics = notificationSystem.getAlertManager().getMetrics();
console.log('Alert metrics:', {
  totalAlerts: metrics.totalAlerts,
  mttr: metrics.mttr, // Mean Time To Resolution
  alertNoise: metrics.alertNoise, // Percentage of suppressed alerts
  falsePositiveRate: metrics.falsePositiveRate
});
\`\`\`

## Scaling

For high-volume deployments:

1. **Redis Clustering** - Use Redis cluster for WebSocket scaling
2. **Load Balancing** - Deploy multiple server instances
3. **Database Optimization** - Use appropriate indexes and partitioning
4. **Message Queues** - Use Redis or RabbitMQ for background processing

## Troubleshooting

Common issues and solutions:

### WebSocket Connection Failed
- Check that port 4403 is available
- Verify CORS configuration
- Ensure WebSocket server is running

### Email Notifications Not Sending
- Verify SMTP credentials
- Check firewall/network restrictions
- Test with a simple SMTP client

### Slack Integration Issues
- Verify bot token permissions
- Check channel membership
- Ensure webhook URLs are correct

For more help, check the logs or create an issue.
`;

fs.writeFileSync(configGuidePath, configGuide);
console.log(`📖 Configuration guide created at ${configGuidePath}\n`);

console.log('🎉 Notification system setup complete!\n');
console.log('Next steps:');
console.log('1. Copy environment variables from .env.notification-template to .env.local');
console.log('2. Configure your preferred notification channels');
console.log('3. Read the setup guide at docs/NOTIFICATION_SETUP.md');
console.log('4. Import and use the notification system in your application\n');

console.log('Example usage:');
console.log(`
import { notificationSystem, quickStart } from '@/services/notifications';

// Basic setup
const system = quickStart.basic();

// Send a notification
await system.sendNotification({
  userId: 'user123',
  title: 'Welcome!',
  message: 'Setup complete!',
  priority: 'normal'
});
`);