import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // 1. Total Services
        const total = await prisma.service.count();

        // 2. Count by Type (Kind)
        const byType = await prisma.service.groupBy({
            by: ['type'],
            _count: {
                type: true
            }
        });

        const byKind = byType.reduce((acc, curr) => {
            acc[curr.type] = curr._count.type;
            return acc;
        }, {} as Record<string, number>);

        // 3. Count by Lifecycle
        const byLifecycleGroup = await prisma.service.groupBy({
            by: ['lifecycle'],
            _count: {
                lifecycle: true
            }
        });

        const byLifecycle = byLifecycleGroup.reduce((acc, curr) => {
            acc[curr.lifecycle] = curr._count.lifecycle;
            return acc;
        }, {} as Record<string, number>);

        // 4. Calculate Health Score
        // Simplified health score based on basic metadata
        const allServices = await prisma.service.findMany({
            take: 100 // limit sample size for perf
        });

        let healthPoints = 0;
        const maxPoints = Math.max(1, allServices.length * 3);

        allServices.forEach(svc => {
            if (svc.description) healthPoints++;
            if (svc.ownerId) healthPoints++;
            if (svc.tags && svc.tags.length > 0) healthPoints++;
        });

        const healthScore = Math.round((healthPoints / maxPoints) * 100);
        const complianceScore = 95; // Mock/Placeholder

        return NextResponse.json({
            total,
            byKind,
            byLifecycle,
            healthScore,
            complianceScore
        });

    } catch (error) {
        console.error('Catalog stats error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch catalog statistics' },
            { status: 500 }
        );
    }
}