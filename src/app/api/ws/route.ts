import { NextRequest } from 'next/server';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'url';
import { WebSocketManager } from '@/lib/websocket/WebSocketManager';
import { getCurrentUser } from '@/lib/auth/protect';

// Store WebSocket manager instance
let wsManager: WebSocketManager | null = null;

export async function GET(request: NextRequest) {
 // Next.js doesn't support native WebSocket upgrade in App Router
 // Return instructions for setting up a separate WebSocket server
 return new Response(JSON.stringify({
 message: 'WebSocket endpoint',
 instructions: 'WebSocket connections should be handled by a separate server process. See /scripts/websocket-server.ts'
 }), {
 status: 200,
 headers: {
 'Content-Type': 'application/json',
 },
 });
}

// WebSocket initialization for standalone server
export function initializeWebSocketServer(server: any) {
 if (wsManager) {
 return wsManager;
 }

 const io = new Server(server, {
 cors: {
 origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400',
 credentials: true,
 },
 path: '/ws',
 });

 wsManager = new WebSocketManager(io);

 io.on('connection', async (socket) => {
 console.log('New WebSocket connection:', socket.id);

 // Authenticate the connection
 const token = socket.handshake.auth.token;
 if (token) {
 try {
 // Verify JWT token or session
 const user = await authenticateWebSocket(token);
 if (user) {
 socket.data.user = user;
 socket.join(`user:${user.id}`);
 
 // Join team rooms
 if (user.teams) {
 user.teams.forEach((team: any) => {
 socket.join(`team:${team.id}`);
 });
 }

 socket.emit('authenticated', { user });
 } else {
 socket.emit('error', { message: 'Authentication failed' });
 socket.disconnect();
 }
 } catch (error) {
 console.error('WebSocket authentication error:', error);
 socket.emit('error', { message: 'Authentication error' });
 socket.disconnect();
 }
 } else {
 // Allow anonymous connections for public data
 socket.data.anonymous = true;
 }

 // Handle ping/pong for connection health
 socket.on('ping', () => {
 socket.emit('pong', { timestamp: new Date().toISOString() });
 });

 // Handle entity subscriptions
 socket.on('subscribe_entity', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.join(`entity:${entityRef}`);
 console.log(`Socket ${socket.id} subscribed to entity:${entityRef}`);
 }
 });

 socket.on('unsubscribe_entity', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.leave(`entity:${entityRef}`);
 console.log(`Socket ${socket.id} unsubscribed from entity:${entityRef}`);
 }
 });

 // Handle metrics subscriptions
 socket.on('subscribe_metrics', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.join(`metrics:${entityRef}`);
 wsManager?.subscribeToMetrics(socket.id, entityRef);
 }
 });

 socket.on('unsubscribe_metrics', (data) => {
 const { entityRef } = data;
 if (entityRef) {
 socket.leave(`metrics:${entityRef}`);
 wsManager?.unsubscribeFromMetrics(socket.id, entityRef);
 }
 });

 // Handle catalog subscriptions
 socket.on('subscribe_catalog', () => {
 socket.join('catalog:updates');
 console.log(`Socket ${socket.id} subscribed to catalog updates`);
 });

 socket.on('unsubscribe_catalog', () => {
 socket.leave('catalog:updates');
 });

 // Handle disconnection
 socket.on('disconnect', () => {
 console.log('WebSocket disconnected:', socket.id);
 wsManager?.handleDisconnect(socket.id);
 });
 });

 // Start periodic tasks
 wsManager.startPeriodicTasks();

 return wsManager;
}

async function authenticateWebSocket(token: string): Promise<any> {
 // This would be implemented based on your auth system
 // For now, mock implementation
 try {
 // Verify JWT or session token
 // Return user object if valid
 return {
 id: 'user-123',
 email: 'user@example.com',
 name: 'Test User',
 role: 'DEVELOPER',
 teams: [{ id: 'team-1', name: 'Platform Team' }],
 };
 } catch (error) {
 return null;
 }
}