
import { Integration, IntegrationProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { IProviderAdapter, IntegrationResult } from './types';
import { GitHubProvider } from './providers/GitHubProvider';
import { KubernetesProvider } from './providers/KubernetesProvider';

class IntegrationManager {
    private providers: Map<IntegrationProvider, IProviderAdapter>;

    constructor() {
        this.providers = new Map();
        this.registerProvider(new GitHubProvider());
        this.registerProvider(new KubernetesProvider());
        // Add other providers here (Jira, K8s, etc.)
    }

    private registerProvider(adapter: IProviderAdapter) {
        this.providers.set(adapter.provider, adapter);
    }

    async syncIntegration(integrationId: string): Promise<IntegrationResult> {
        const integration = await prisma.integration.findUnique({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error('Integration not found');
        }

        const adapter = this.providers.get(integration.provider);
        if (!adapter) {
            return { success: false, entitiesSynced: 0, message: `No adapter for provider ${integration.provider}` };
        }

        // Log Start
        await prisma.integrationEvent.create({
            data: {
                integrationId: integration.id,
                type: 'SYNC_STARTED',
                message: 'Manual sync triggered'
            }
        });

        try {
            const result = await adapter.sync(integration);

            // Log Success
            await prisma.integrationEvent.create({
                data: {
                    integrationId: integration.id,
                    type: 'SYNC_COMPLETED',
                    message: result.message,
                    metadata: { count: result.entitiesSynced }
                }
            });

            // Update Integration Status
            await prisma.integration.update({
                where: { id: integration.id },
                data: { lastSyncAt: new Date(), status: 'connected' }
            });

            return result;

        } catch (error: any) {
            // Log Error
            await prisma.integrationEvent.create({
                data: {
                    integrationId: integration.id,
                    type: 'ERROR',
                    message: error.message
                }
            });

            await prisma.integration.update({
                where: { id: integration.id },
                data: { status: 'error', error: error.message }
            });

            throw error;
        }
    }
}

export const integrationManager = new IntegrationManager();
