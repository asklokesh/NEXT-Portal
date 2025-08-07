/**
 * WebSocket Connections Integration Tests
 * Tests real-time communication, connection handling, and message broadcasting
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { io, Socket } from 'socket.io-client';
import { Server } from 'http';
import { WebSocketServer } from '@/lib/websocket/WebSocketService';

describe('WebSocket Connections', () => {
  let server: Server;
  let wsServer: WebSocketServer;
  let clientSocket: Socket;
  let adminSocket: Socket;
  const serverUrl = 'http://localhost:4001';

  beforeAll(async () => {
    // Start WebSocket server
    wsServer = new WebSocketServer();
    server = await wsServer.start(4001);
  });

  afterAll(async () => {
    // Close all connections and server
    if (clientSocket) clientSocket.close();
    if (adminSocket) adminSocket.close();
    if (wsServer) await wsServer.stop();
    if (server) server.close();
  });

  beforeEach(() => {
    // Setup fresh client connections for each test
    clientSocket = io(serverUrl, {
      auth: {
        token: 'test-client-token',
        userId: 'user-123',
        role: 'developer',
      },
      transports: ['websocket'],
    });

    adminSocket = io(serverUrl, {
      auth: {
        token: 'test-admin-token',
        userId: 'admin-456',
        role: 'admin',
      },
      transports: ['websocket'],
    });
  });

  afterEach(() => {
    // Cleanup connections after each test
    if (clientSocket.connected) clientSocket.disconnect();
    if (adminSocket.connected) adminSocket.disconnect();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', (done) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(clientSocket.id).toBeDefined();
        done();
      });
    });

    it('should authenticate connection', (done) => {
      clientSocket.on('authenticated', (data) => {
        expect(data.success).toBe(true);
        expect(data.userId).toBe('user-123');
        expect(data.role).toBe('developer');
        done();
      });

      clientSocket.emit('authenticate', {
        token: 'test-client-token',
      });
    });

    it('should reject invalid authentication', (done) => {
      const invalidSocket = io(serverUrl, {
        auth: {
          token: 'invalid-token',
        },
        transports: ['websocket'],
      });

      invalidSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidSocket.close();
        done();
      });
    });

    it('should handle reconnection', (done) => {
      let disconnectCount = 0;
      let reconnectCount = 0;

      clientSocket.on('disconnect', () => {
        disconnectCount++;
      });

      clientSocket.on('connect', () => {
        reconnectCount++;
        if (reconnectCount === 2) {
          expect(disconnectCount).toBe(1);
          expect(clientSocket.connected).toBe(true);
          done();
        }
      });

      // Force disconnect and reconnect
      setTimeout(() => {
        clientSocket.disconnect();
        setTimeout(() => {
          clientSocket.connect();
        }, 100);
      }, 100);
    });

    it('should handle multiple concurrent connections', async () => {
      const connections = [];
      const connectionPromises = [];

      for (let i = 0; i < 10; i++) {
        const socket = io(serverUrl, {
          auth: {
            token: `test-token-${i}`,
            userId: `user-${i}`,
          },
          transports: ['websocket'],
        });

        connections.push(socket);
        
        connectionPromises.push(
          new Promise((resolve) => {
            socket.on('connect', () => {
              resolve(true);
            });
          })
        );
      }

      const results = await Promise.all(connectionPromises);
      expect(results.every(r => r === true)).toBe(true);

      // Cleanup
      connections.forEach(socket => socket.close());
    });
  });

  describe('Real-time Messaging', () => {
    it('should broadcast messages to all connected clients', (done) => {
      let messagesReceived = 0;
      const expectedMessage = { type: 'notification', content: 'Test broadcast' };

      clientSocket.on('broadcast', (data) => {
        expect(data).toEqual(expectedMessage);
        messagesReceived++;
        if (messagesReceived === 1) done();
      });

      adminSocket.on('broadcast', (data) => {
        expect(data).toEqual(expectedMessage);
        messagesReceived++;
        if (messagesReceived === 1) done();
      });

      // Wait for connections to establish
      setTimeout(() => {
        wsServer.broadcast(expectedMessage);
      }, 100);
    });

    it('should send targeted messages to specific users', (done) => {
      const targetMessage = { type: 'direct', content: 'Private message' };

      clientSocket.on('direct-message', (data) => {
        expect(data).toEqual(targetMessage);
        done();
      });

      adminSocket.on('direct-message', () => {
        // Admin should not receive this message
        throw new Error('Admin should not receive targeted message');
      });

      setTimeout(() => {
        wsServer.sendToUser('user-123', 'direct-message', targetMessage);
      }, 100);
    });

    it('should handle room-based messaging', (done) => {
      const roomMessage = { type: 'room', content: 'Team message' };
      
      clientSocket.emit('join-room', 'team-platform');
      adminSocket.emit('join-room', 'team-admin');

      clientSocket.on('room-message', (data) => {
        expect(data).toEqual(roomMessage);
        expect(data.room).toBe('team-platform');
        done();
      });

      adminSocket.on('room-message', () => {
        throw new Error('Admin should not receive platform team message');
      });

      setTimeout(() => {
        wsServer.sendToRoom('team-platform', 'room-message', roomMessage);
      }, 100);
    });

    it('should handle request-response pattern', (done) => {
      clientSocket.emit('catalog:fetch', { 
        filter: { kind: 'Component' } 
      }, (response: any) => {
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(Array.isArray(response.data.entities)).toBe(true);
        done();
      });
    });
  });

  describe('Event Subscriptions', () => {
    it('should subscribe to catalog updates', (done) => {
      clientSocket.emit('subscribe', { 
        channel: 'catalog',
        filter: { kind: 'Component' }
      });

      clientSocket.on('catalog:update', (data) => {
        expect(data.entity).toBeDefined();
        expect(data.action).toMatch(/created|updated|deleted/);
        done();
      });

      // Simulate catalog update
      setTimeout(() => {
        wsServer.publishEvent('catalog:update', {
          entity: { kind: 'Component', metadata: { name: 'test-service' } },
          action: 'created',
        });
      }, 100);
    });

    it('should subscribe to deployment events', (done) => {
      clientSocket.emit('subscribe', {
        channel: 'deployments',
        serviceId: 'service-123',
      });

      clientSocket.on('deployment:status', (data) => {
        expect(data.serviceId).toBe('service-123');
        expect(data.status).toBeDefined();
        expect(data.environment).toBeDefined();
        done();
      });

      setTimeout(() => {
        wsServer.publishEvent('deployment:status', {
          serviceId: 'service-123',
          status: 'in_progress',
          environment: 'production',
          progress: 45,
        });
      }, 100);
    });

    it('should handle multiple subscriptions', (done) => {
      let eventsReceived = 0;
      const expectedEvents = 2;

      clientSocket.emit('subscribe', { channel: 'metrics' });
      clientSocket.emit('subscribe', { channel: 'alerts' });

      clientSocket.on('metrics:update', () => {
        eventsReceived++;
        if (eventsReceived === expectedEvents) done();
      });

      clientSocket.on('alerts:new', () => {
        eventsReceived++;
        if (eventsReceived === expectedEvents) done();
      });

      setTimeout(() => {
        wsServer.publishEvent('metrics:update', { cpu: 45, memory: 67 });
        wsServer.publishEvent('alerts:new', { severity: 'warning', message: 'High CPU' });
      }, 100);
    });

    it('should unsubscribe from events', (done) => {
      let eventCount = 0;

      clientSocket.emit('subscribe', { channel: 'notifications' });

      clientSocket.on('notification:new', () => {
        eventCount++;
      });

      // Send first event (should be received)
      setTimeout(() => {
        wsServer.publishEvent('notification:new', { message: 'First' });
      }, 100);

      // Unsubscribe
      setTimeout(() => {
        clientSocket.emit('unsubscribe', { channel: 'notifications' });
      }, 200);

      // Send second event (should not be received)
      setTimeout(() => {
        wsServer.publishEvent('notification:new', { message: 'Second' });
      }, 300);

      // Check results
      setTimeout(() => {
        expect(eventCount).toBe(1);
        done();
      }, 400);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid message format', (done) => {
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Invalid message format');
        done();
      });

      clientSocket.emit('invalid-event', 'not-an-object');
    });

    it('should handle rate limiting', async () => {
      const promises = [];
      
      // Send many messages quickly
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise((resolve) => {
            clientSocket.emit('test-event', { index: i }, (response: any) => {
              resolve(response);
            });
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter((r: any) => r?.error === 'Rate limit exceeded');
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should handle connection timeout', (done) => {
      const timeoutSocket = io(serverUrl, {
        auth: { token: 'test-token' },
        timeout: 100, // Very short timeout
        transports: ['websocket'],
      });

      timeoutSocket.on('connect_error', (error) => {
        expect(error.type).toBe('TransportError');
        timeoutSocket.close();
        done();
      });
    });

    it('should recover from server restart', async () => {
      // Initial connection
      await new Promise((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const initialId = clientSocket.id;

      // Simulate server restart
      await wsServer.restart();

      // Wait for reconnection
      await new Promise((resolve) => {
        clientSocket.on('reconnect', resolve);
      });

      expect(clientSocket.connected).toBe(true);
      expect(clientSocket.id).not.toBe(initialId);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high message throughput', async () => {
      const messageCount = 1000;
      let receivedCount = 0;

      return new Promise((resolve) => {
        clientSocket.on('performance-test', () => {
          receivedCount++;
          if (receivedCount === messageCount) {
            expect(receivedCount).toBe(messageCount);
            resolve(true);
          }
        });

        // Send messages rapidly
        for (let i = 0; i < messageCount; i++) {
          wsServer.publishEvent('performance-test', { index: i });
        }
      });
    });

    it('should maintain low latency', async () => {
      const latencies: number[] = [];
      const testCount = 100;

      for (let i = 0; i < testCount; i++) {
        const start = Date.now();
        
        await new Promise((resolve) => {
          clientSocket.emit('ping', { timestamp: start }, (response: any) => {
            const latency = Date.now() - start;
            latencies.push(latency);
            resolve(response);
          });
        });
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      expect(avgLatency).toBeLessThan(50); // Average under 50ms
      expect(maxLatency).toBeLessThan(200); // Max under 200ms
    });

    it('should handle message ordering', (done) => {
      const messages: number[] = [];
      const expectedOrder = [1, 2, 3, 4, 5];

      clientSocket.on('ordered-message', (data) => {
        messages.push(data.order);
        
        if (messages.length === expectedOrder.length) {
          expect(messages).toEqual(expectedOrder);
          done();
        }
      });

      // Send messages in order
      expectedOrder.forEach(order => {
        wsServer.publishEvent('ordered-message', { order });
      });
    });
  });

  describe('Security', () => {
    it('should prevent unauthorized access to admin events', (done) => {
      clientSocket.on('admin:event', () => {
        throw new Error('Non-admin should not receive admin events');
      });

      adminSocket.on('admin:event', (data) => {
        expect(data.restricted).toBe(true);
        done();
      });

      setTimeout(() => {
        wsServer.publishAdminEvent('admin:event', { restricted: true });
      }, 100);
    });

    it('should sanitize user input', (done) => {
      const maliciousInput = '<script>alert("XSS")</script>';
      
      clientSocket.emit('message:send', {
        content: maliciousInput,
      }, (response: any) => {
        expect(response.sanitized).toBe(true);
        expect(response.content).not.toContain('<script>');
        done();
      });
    });

    it('should validate message size limits', (done) => {
      const largeMessage = 'x'.repeat(1024 * 1024); // 1MB message
      
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Message too large');
        done();
      });

      clientSocket.emit('large-message', { data: largeMessage });
    });
  });
});