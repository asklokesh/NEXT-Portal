import { PrismaClient } from '@prisma/client';

// Prevent PrismaClient instantiation in browser environment
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
    if (typeof window !== 'undefined') {
        throw new Error('PrismaClient cannot be used in the browser');
    }
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
