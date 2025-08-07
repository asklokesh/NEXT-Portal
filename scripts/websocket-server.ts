#!/usr/bin/env tsx
/**
 * Standalone WebSocket server for real-time updates
 * Run this alongside the Next.js application
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import { WebSocketManager } from '../src/lib/websocket/WebSocketManager';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const PORT = process.env.WS_PORT || 4403;
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400';

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server
const io = new Server(httpServer, {
 cors: {
 origin: CORS_ORIGIN,
 credentials: true,
 },
 path: '/socket.io', // Using standard path for Socket.IO
});

// Initialize WebSocket manager
const wsManager = new WebSocketManager(io);

// Handle connections
io.on('connection', async (socket) => {
 console.log(`[WebSocket] New connection: ${socket.id} from ${socket.handshake.address}`);

 // Handle authentication
 const token = socket.handshake.auth.token;
 if (token) {
 try {
 // In production, verify the JWT token here
 const user = {
 id: 'user-123',
 email: 'user@example.com',
 name: 'Test User',
 role: 'DEVELOPER',
 teams: [{ id: 'team-1', name: 'Platform Team' }],
 };

 socket.data.user = user;
 socket.join(`user:${user.id}`);
 
 // Join team rooms
 user.teams.forEach((team) => {
 socket.join(`team:${team.id}`);
 });

 socket.emit('authenticated', { user });
 console.log(`[WebSocket] User ${user.email} authenticated`);
 } catch (error) {
 console.error('[WebSocket] Authentication error:', error);
 socket.emit('error', { message: 'Authentication failed' });
 socket.disconnect();
 }
 } else {
 // Allow anonymous connections for public data
 socket.data.anonymous = true;
 console.log(`[WebSocket] Anonymous connection allowed`);
 }

 // Handle ping/pong
 socket.on('ping', () => {
 socket.emit('pong', { timestamp: new Date().toISOString() });
 });

 // Handle entity subscriptions
 socket.on('subscribe_entity', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.join(`entity:${entityRef}`);
 console.log(`[WebSocket] ${socket.id} subscribed to entity:${entityRef}`);
 }
 });

 socket.on('unsubscribe_entity', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.leave(`entity:${entityRef}`);
 console.log(`[WebSocket] ${socket.id} unsubscribed from entity:${entityRef}`);
 }
 });

 // Handle metrics subscriptions
 socket.on('subscribe_metrics', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.join(`metrics:${entityRef}`);
 wsManager.subscribeToMetrics(socket.id, entityRef);
 console.log(`[WebSocket] ${socket.id} subscribed to metrics:${entityRef}`);
 }
 });

 socket.on('unsubscribe_metrics', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.leave(`metrics:${entityRef}`);
 wsManager.unsubscribeFromMetrics(socket.id, entityRef);
 }
 });

 // Handle catalog subscriptions
 socket.on('subscribe_catalog', () => {
 socket.join('catalog:updates');
 console.log(`[WebSocket] ${socket.id} subscribed to catalog updates`);
 });

 socket.on('unsubscribe_catalog', () => {
 socket.leave('catalog:updates');
 });

 // Handle custom messages
 socket.on('message', (data) => {
 console.log(`[WebSocket] Message from ${socket.id}:`, data);
 
 // Echo back for testing
 socket.emit('message', {
 type: 'echo',
 data: data,
 timestamp: new Date().toISOString(),
 });
 });

 // Handle disconnection
 socket.on('disconnect', (reason) => {
 console.log(`[WebSocket] ${socket.id} disconnected: ${reason}`);
 wsManager.handleDisconnect(socket.id);
 });
});

// Start periodic tasks
wsManager.startPeriodicTasks();

// Handle process termination
process.on('SIGINT', () => {
 console.log('[WebSocket] Shutting down server...');
 wsManager.stopPeriodicTasks();
 io.close(() => {
 console.log('[WebSocket] Server closed');
 process.exit(0);
 });
});

process.on('SIGTERM', () => {
 console.log('[WebSocket] Shutting down server...');
 wsManager.stopPeriodicTasks();
 io.close(() => {
 console.log('[WebSocket] Server closed');
 process.exit(0);
 });
});

// Start the server
httpServer.listen(PORT, () => {
 console.log(`[WebSocket] Server running on port ${PORT}`);
 console.log(`[WebSocket] CORS origin: ${CORS_ORIGIN}`);
 console.log(`[WebSocket] Socket.IO path: /socket.io`);
 console.log('[WebSocket] Press Ctrl+C to stop');
});

// Export for testing
export { io, wsManager };