
import { Integration, IntegrationProvider, ServiceType, Lifecycle } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { IProviderAdapter, IntegrationResult } from '../types';

export class GitHubProvider implements IProviderAdapter {
    provider = IntegrationProvider.GITHUB;

    async validateCredentials(credentials: string): Promise<boolean> {
        // Mock validation
        return credentials.length > 5;
    }

    async sync(integration: Integration): Promise<IntegrationResult> {
        // In a real app, we would fetch from GitHub API using octokit
        const mockRepos = [
            { name: 'payment-service', description: 'Core payment processing', language: 'TypeScript' },
            { name: 'auth-service', description: 'User authentication OIDC', language: 'Go' },
            { name: 'frontend-portal', description: 'Main developer portal', language: 'React' },
        ];

        let syncedCount = 0;

        for (const repo of mockRepos) {
            // Upsert Service in Catalog
            const serviceName = repo.name.toLowerCase();

            // Check if already synced
            const existingSync = await prisma.catalogSync.findFirst({
                where: { integrationId: integration.id, entityRef: `github.com/org/${repo.name}` }
            });

            if (!existingSync) {
                // Create Service
                const service = await prisma.service.create({
                    data: {
                        name: serviceName,
                        displayName: repo.name,
                        description: repo.description,
                        type: ServiceType.BACKEND,
                        lifecycle: Lifecycle.PRODUCTION,
                        ownerId: 'user-default', // Fallback owner
                        teamId: 'team-platform', // Fallback team
                        gitRepo: `https://github.com/org/${repo.name}`,
                        gitBranch: 'main',
                        tags: ['imported', 'github', repo.language.toLowerCase()],
                        isActive: true
                    }
                });

                // Record Sync
                await prisma.catalogSync.create({
                    data: {
                        integrationId: integration.id,
                        serviceId: service.id,
                        entityRef: `github.com/org/${repo.name}`,
                        syncstatus: 'SUCCESS'
                    }
                });
                syncedCount++;
            }
        }

        return {
            success: true,
            entitiesSynced: syncedCount,
            message: `Successfully synced ${syncedCount} repositories from GitHub.`
        };
    }
}
