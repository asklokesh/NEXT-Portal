/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from '@prisma/client';

/**
 * Database Connection Pool Configuration for Production
 * 
 * These settings optimize PostgreSQL connection pooling for production workloads.
 * Add these parameters to your DATABASE_URL in production:
 * 
 * postgresql://user:pass@host:port/db?connection_limit=25&pool_timeout=10&connect_timeout=10&statement_timeout=30000
 */

export const poolConfig = {
 // Maximum number of connections in the pool
 connection_limit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 25,
 
 // Time to wait for a connection from the pool (ms)
 pool_timeout: process.env.DB_POOL_TIMEOUT ? parseInt(process.env.DB_POOL_TIMEOUT) : 10,
 
 // Time to wait for initial connection (seconds)
 connect_timeout: process.env.DB_CONNECT_TIMEOUT ? parseInt(process.env.DB_CONNECT_TIMEOUT) : 10,
 
 // Statement timeout to prevent long-running queries (ms)
 statement_timeout: process.env.DB_STATEMENT_TIMEOUT ? parseInt(process.env.DB_STATEMENT_TIMEOUT) : 30000,
 
 // Idle in transaction session timeout (ms)
 idle_in_transaction_session_timeout: 60000,
 
 // Query timeout for Prisma
 query_timeout: 30000,
};

/**
 * Production Prisma Client Configuration
 */
export const createPrismaClient = () => {
 return new PrismaClient({
 log: [
 { level: 'query', emit: 'event' },
 { level: 'error', emit: 'stdout' },
 { level: 'warn', emit: 'stdout' },
 ],
 errorFormat: 'minimal',
 });
};

/**
 * Connection Pool Monitoring
 */
export class PoolMonitor {
 private metrics = {
 activeConnections: 0,
 idleConnections: 0,
 waitingRequests: 0,
 totalRequests: 0,
 failedRequests: 0,
 };

 updateMetrics(event: any) {
 // Update metrics based on Prisma events
 if (event.type === 'query') {
 this.metrics.totalRequests++;
 }
 }

 getMetrics() {
 return { ...this.metrics };
 }

 reset() {
 this.metrics = {
 activeConnections: 0,
 idleConnections: 0,
 waitingRequests: 0,
 totalRequests: 0,
 failedRequests: 0,
 };
 }
}

export const poolMonitor = new PoolMonitor();