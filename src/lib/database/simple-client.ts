/**
 * Simple Database Client for Testing
 * This is a simplified version that works with basic Prisma operations
 */

import { PrismaClient } from '@prisma/client';

// Global instance for Next.js hot reload
let globalPrisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  globalPrisma = new PrismaClient({
    log: ['error'],
  });
} else {
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  globalPrisma = (global as any).prisma;
}

class SimpleDatabaseClient {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = globalPrisma;
  }

  async findUnique<T extends keyof PrismaClient>(
    model: T,
    args: any
  ): Promise<any> {
    const modelDelegate = this.prisma[model] as any;
    return await modelDelegate.findUnique(args);
  }

  async findMany<T extends keyof PrismaClient>(
    model: T,
    args?: any
  ): Promise<any> {
    const modelDelegate = this.prisma[model] as any;
    return await modelDelegate.findMany(args || {});
  }

  async create<T extends keyof PrismaClient>(
    model: T,
    args: any
  ): Promise<any> {
    const modelDelegate = this.prisma[model] as any;
    return await modelDelegate.create(args);
  }

  async update<T extends keyof PrismaClient>(
    model: T,
    args: any
  ): Promise<any> {
    const modelDelegate = this.prisma[model] as any;
    return await modelDelegate.update(args);
  }

  async count<T extends keyof PrismaClient>(
    model: T,
    args?: any
  ): Promise<number> {
    const modelDelegate = this.prisma[model] as any;
    return await modelDelegate.count(args || {});
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Get the raw Prisma client for direct access
  getPrisma(): PrismaClient {
    return this.prisma;
  }

  getMetrics() {
    return {
      totalConnections: 1,
      activeConnections: 1,
      idleConnections: 0,
      waitingConnections: 0,
      totalQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      connectionErrors: 0,
      lastHealthCheck: new Date(),
      isHealthy: true
    };
  }

  getCircuitBreakerState() {
    return {
      state: 'CLOSED',
      failures: 0,
      nextAttempt: 0
    };
  }
}

// Export singleton instance
export const db = new SimpleDatabaseClient();
export { SimpleDatabaseClient };