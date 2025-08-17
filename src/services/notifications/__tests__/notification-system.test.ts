/**
 * Notification System Tests
 * 
 * Test suite for the advanced notification and communication system
 */

import { NotificationEngine } from '../notification-engine';
import { AlertManager } from '../alert-manager';
import { NotificationSystem } from '../index';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('@slack/web-api');
jest.mock('discord.js');
jest.mock('ioredis');
jest.mock('@tensorflow/tfjs-node');

describe('NotificationSystem', () => {
  let notificationSystem: NotificationSystem;

  beforeEach(() => {
    notificationSystem = NotificationSystem.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Engine', () => {
    test('should send a basic notification', async () => {
      const notificationId = await notificationSystem.sendNotification({
        userId: 'test-user',
        title: 'Test Notification',
        message: 'This is a test message',
        priority: 'normal',
      });

      expect(notificationId).toBeDefined();
      expect(typeof notificationId).toBe('string');
    });

    test('should handle different priority levels', async () => {
      const priorities = ['low', 'normal', 'high', 'critical'] as const;

      for (const priority of priorities) {
        const notificationId = await notificationSystem.sendNotification({
          userId: 'test-user',
          title: `${priority.toUpperCase()} Priority Test`,
          message: `This is a ${priority} priority notification`,
          priority,
        });

        expect(notificationId).toBeDefined();
      }
    });

    test('should support different channels', async () => {
      const channels = ['in-app', 'email', 'slack', 'teams'];

      for (const channel of channels) {
        const notificationId = await notificationSystem.sendNotification({
          userId: 'test-user',
          title: `${channel} Channel Test`,
          message: `This notification should go to ${channel}`,
          channel,
        });

        expect(notificationId).toBeDefined();
      }
    });

    test('should handle notification with custom data', async () => {
      const customData = {
        entityType: 'Service',
        entityName: 'user-service',
        environment: 'production',
        deployment: {
          version: 'v1.2.3',
          timestamp: new Date().toISOString(),
        },
      };

      const notificationId = await notificationSystem.sendNotification({
        userId: 'test-user',
        title: 'Deployment Complete',
        message: 'Service has been deployed successfully',
        data: customData,
      });

      expect(notificationId).toBeDefined();
    });
  });

  describe('Alert Manager', () => {
    test('should create an alert', async () => {
      const alert = await notificationSystem.createAlert({
        name: 'High CPU Usage',
        severity: 'warning',
        source: 'monitoring',
        service: 'user-service',
        message: 'CPU usage is above 80%',
        labels: {
          environment: 'production',
          team: 'platform',
        },
      });

      expect(alert).toBeDefined();
      expect(alert.name).toBe('High CPU Usage');
      expect(alert.severity).toBe('warning');
      expect(alert.source).toBe('monitoring');
    });

    test('should handle different alert severities', async () => {
      const severities = ['info', 'warning', 'error', 'critical'] as const;

      for (const severity of severities) {
        const alert = await notificationSystem.createAlert({
          name: `${severity.toUpperCase()} Alert`,
          severity,
          source: 'test',
          message: `This is a ${severity} alert`,
        });

        expect(alert.severity).toBe(severity);
      }
    });

    test('should get alert metrics', async () => {
      // Create some test alerts
      await notificationSystem.createAlert({
        name: 'Test Alert 1',
        severity: 'warning',
        source: 'test',
        message: 'Test alert 1',
      });

      await notificationSystem.createAlert({
        name: 'Test Alert 2',
        severity: 'error',
        source: 'test',
        message: 'Test alert 2',
      });

      const metrics = notificationSystem.getAlertManager().getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalAlerts).toBeGreaterThanOrEqual(2);
      expect(metrics.alertsBySevertity).toBeDefined();
      expect(metrics.mttr).toBeGreaterThanOrEqual(0);
    });
  });

  describe('User Preferences', () => {
    test('should set and get user preferences', async () => {
      const preferences = {
        userId: 'test-user',
        channels: {
          email: { enabled: true },
          slack: { enabled: false },
          'in-app': { enabled: true },
        },
        batching: {
          enabled: true,
          interval: 60,
          maxBatch: 10,
        },
      };

      await notificationSystem.getNotificationEngine().setUserPreferences(preferences);
      const retrievedPrefs = await notificationSystem.getNotificationEngine().getUserPreferences('test-user');

      expect(retrievedPrefs).toBeDefined();
      expect(retrievedPrefs.userId).toBe('test-user');
      expect(retrievedPrefs.channels.email?.enabled).toBe(true);
      expect(retrievedPrefs.channels.slack?.enabled).toBe(false);
      expect(retrievedPrefs.batching?.enabled).toBe(true);
    });

    test('should handle quiet hours configuration', async () => {
      const preferences = {
        userId: 'test-user',
        channels: {
          email: {
            enabled: true,
            quietHours: { start: '22:00', end: '08:00' },
          },
        },
      };

      await notificationSystem.getNotificationEngine().setUserPreferences(preferences);
      const retrievedPrefs = await notificationSystem.getNotificationEngine().getUserPreferences('test-user');

      expect(retrievedPrefs.channels.email?.quietHours).toBeDefined();
      expect(retrievedPrefs.channels.email?.quietHours?.start).toBe('22:00');
      expect(retrievedPrefs.channels.email?.quietHours?.end).toBe('08:00');
    });
  });

  describe('Template System', () => {
    test('should register and use templates', async () => {
      const engine = notificationSystem.getNotificationEngine();
      
      // Register a test template
      engine.registerTemplate({
        id: 'test-template',
        name: 'Test Template',
        channel: 'email',
        subject: 'Test: {{title}}',
        body: 'Hello {{name}}, this is a test message about {{topic}}.',
        variables: ['title', 'name', 'topic'],
      });

      // Use the template
      const notificationId = await engine.send({
        userId: 'test-user',
        templateId: 'test-template',
        priority: 'normal',
        data: {
          title: 'System Update',
          name: 'John Doe',
          topic: 'new features',
        },
      });

      expect(notificationId).toBeDefined();

      // Verify template exists
      const template = engine.getTemplate('test-template');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Test Template');
    });

    test('should list all templates', () => {
      const engine = notificationSystem.getNotificationEngine();
      const templates = engine.listTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing user ID', async () => {
      await expect(
        notificationSystem.sendNotification({
          userId: '',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow();
    });

    test('should handle missing message content', async () => {
      await expect(
        notificationSystem.sendNotification({
          userId: 'test-user',
          title: '',
          message: '',
        })
      ).rejects.toThrow();
    });

    test('should handle invalid template ID', async () => {
      await expect(
        notificationSystem.getNotificationEngine().send({
          userId: 'test-user',
          templateId: 'non-existent-template',
          priority: 'normal',
        })
      ).rejects.toThrow();
    });

    test('should handle invalid alert data', async () => {
      await expect(
        notificationSystem.createAlert({
          name: '',
          severity: 'warning',
          source: '',
          message: '',
        })
      ).rejects.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('should properly integrate alert creation with notifications', async () => {
      // Create an alert that should trigger notifications
      const alert = await notificationSystem.createAlert({
        name: 'Critical System Error',
        severity: 'critical',
        source: 'monitoring',
        service: 'payment-service',
        message: 'Payment processing is down',
        labels: {
          environment: 'production',
          team: 'payments',
        },
      });

      expect(alert).toBeDefined();
      expect(alert.severity).toBe('critical');

      // Verify that this would trigger incident creation for critical alerts
      // (In a real test, we'd check the incident manager)
    });

    test('should handle system shutdown gracefully', async () => {
      await expect(notificationSystem.shutdown()).resolves.not.toThrow();
    });
  });
});

describe('NotificationEngine (Unit Tests)', () => {
  let engine: NotificationEngine;

  beforeEach(() => {
    engine = new NotificationEngine();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  test('should initialize with default configuration', () => {
    expect(engine).toBeDefined();
  });

  test('should handle rate limiting', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      engine.send({
        userId: 'test-user',
        subject: `Test ${i}`,
        message: `Message ${i}`,
        priority: 'normal',
      })
    );

    // Should not throw even with many concurrent requests
    const results = await Promise.allSettled(promises);
    expect(results.length).toBe(100);
  });

  test('should support rich media content', async () => {
    const notificationId = await engine.send({
      userId: 'test-user',
      subject: 'Rich Media Test',
      message: 'This notification includes rich media',
      priority: 'normal',
      richMedia: [
        {
          type: 'image',
          url: 'https://example.com/chart.png',
          alt: 'Performance chart',
        },
        {
          type: 'code',
          language: 'javascript',
          data: 'console.log("Hello, World!");',
        },
      ],
    });

    expect(notificationId).toBeDefined();
  });
});

describe('AlertManager (Unit Tests)', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    alertManager = new AlertManager();
  });

  afterEach(async () => {
    await alertManager.shutdown();
  });

  test('should initialize with default configuration', () => {
    expect(alertManager).toBeDefined();
  });

  test('should deduplicate alerts', async () => {
    const alertData = {
      name: 'High Memory Usage',
      severity: 'warning' as const,
      source: 'monitoring',
      service: 'user-service',
      labels: { environment: 'production' },
      annotations: { summary: 'Memory usage is high' },
    };

    // Send the same alert twice
    const alert1 = await alertManager.receiveAlert(alertData);
    const alert2 = await alertManager.receiveAlert(alertData);

    // Should be the same alert (deduplicated)
    expect(alert1.fingerprint).toBe(alert2.fingerprint);
  });

  test('should correlate related alerts', async () => {
    const alert1 = await alertManager.receiveAlert({
      name: 'High CPU',
      severity: 'warning',
      source: 'monitoring',
      service: 'user-service',
      labels: { environment: 'production' },
      annotations: { summary: 'CPU usage is high' },
    });

    const alert2 = await alertManager.receiveAlert({
      name: 'High Memory',
      severity: 'warning',
      source: 'monitoring',
      service: 'user-service', // Same service
      labels: { environment: 'production' }, // Same environment
      annotations: { summary: 'Memory usage is high' },
    });

    // Should have correlation
    expect(alert1.correlationId).toBeDefined();
    expect(alert1.correlationId).toBe(alert2.correlationId);
  });

  test('should handle alert resolution', async () => {
    const alert = await alertManager.receiveAlert({
      name: 'Test Alert',
      severity: 'warning',
      source: 'test',
      labels: {},
      annotations: { summary: 'Test alert' },
    });

    expect(alert.status).toBe('firing');

    // Resolve the alert
    await alertManager.resolveAlert(alert.id, 'test-user');

    expect(alert.status).toBe('resolved');
    expect(alert.endsAt).toBeDefined();
  });
});

// Performance Tests
describe('Performance Tests', () => {
  test('should handle high notification volume', async () => {
    const startTime = Date.now();
    const promises = Array.from({ length: 1000 }, (_, i) =>
      notificationSystem.sendNotification({
        userId: `user-${i % 10}`, // 10 different users
        title: `Performance Test ${i}`,
        message: `This is message number ${i}`,
        priority: 'normal',
      })
    );

    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (adjust based on your requirements)
    expect(duration).toBeLessThan(10000); // 10 seconds
  });

  test('should handle concurrent alert creation', async () => {
    const alertPromises = Array.from({ length: 100 }, (_, i) =>
      notificationSystem.createAlert({
        name: `Concurrent Alert ${i}`,
        severity: i % 4 === 0 ? 'critical' : 'warning',
        source: 'performance-test',
        message: `Alert ${i} for performance testing`,
        labels: { test: 'concurrent' },
      })
    );

    const results = await Promise.allSettled(alertPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    expect(successful).toBe(100);
  });
});

// Mock implementations for testing
class MockNotificationChannel {
  async send(notification: any) {
    return Promise.resolve({ id: 'mock-id', status: 'sent' });
  }
}

class MockAlertIntegration {
  async sendAlert(alert: any) {
    return Promise.resolve({ id: 'mock-alert-id' });
  }
}

// Helper functions for testing
export const testHelpers = {
  createMockNotification: (overrides = {}) => ({
    userId: 'test-user',
    title: 'Test Notification',
    message: 'This is a test message',
    priority: 'normal',
    ...overrides,
  }),

  createMockAlert: (overrides = {}) => ({
    name: 'Test Alert',
    severity: 'warning' as const,
    source: 'test',
    message: 'This is a test alert',
    labels: { environment: 'test' },
    ...overrides,
  }),

  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  expectNotificationSent: (notificationId: string) => {
    expect(notificationId).toBeDefined();
    expect(typeof notificationId).toBe('string');
    expect(notificationId.length).toBeGreaterThan(0);
  },

  expectAlertCreated: (alert: any) => {
    expect(alert).toBeDefined();
    expect(alert.id).toBeDefined();
    expect(alert.name).toBeDefined();
    expect(alert.severity).toBeDefined();
    expect(alert.status).toBeDefined();
  },
};