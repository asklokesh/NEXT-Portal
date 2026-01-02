import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { IntegrationProvider, IntegrationStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { provider, name, credentials, config } = body;

        // Validate inputs
        if (!provider || !name) {
            return NextResponse.json(
                { error: 'Provider and Name are required' },
                { status: 400 }
            );
        }

        // Encrypt credentials (Simulated for this MVP)
        // In production, use a dedicated vault or encryption helper
        // const encryptedCreds = encrypt(credentials);
        const encryptedCreds = JSON.stringify(credentials);


        const integration = await prisma.integration.create({
            data: {
                tenantId: 'default-tenant', // Should come from context/auth
                provider: provider as IntegrationProvider,
                name,
                credentials: encryptedCreds,
                config: config || {},
                status: IntegrationStatus.syncing,
                lastSyncAt: null,
            },
        });

        // Trigger async sync (fire and forget for this MVP, or await if fast)
        // For demo purposes, we await it to show immediate results in UI
        try {
            const { integrationManager } = await import('@/services/integrations/IntegrationManager');
            await integrationManager.syncIntegration(integration.id);
        } catch (syncErr) {
            console.error('Initial sync failed:', syncErr);
        }

        return NextResponse.json(integration);
    } catch (error) {
        console.error('Error creating integration:', error);
        return NextResponse.json(
            { error: 'Failed to create integration' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const integrations = await prisma.integration.findMany({
            where: {
                tenantId: 'default-tenant',
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                _count: {
                    select: { catalogSyncs: true },
                },
            },
        });

        return NextResponse.json(integrations);
    } catch (error) {
        console.error('Error loading integrations:', error);
        return NextResponse.json(
            { error: 'Failed to load integrations' },
            { status: 500 }
        );
    }
}
