import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface ProviderConfig {
 provider: string;
 enabled: boolean;
}

export async function POST(request: NextRequest) {
 try {
 const { provider, enabled } = await request.json() as ProviderConfig;
 
 // Load current provider status
 const configPath = path.join(process.cwd(), 'catalog-providers.json');
 let status = {
 enabled: [] as string[],
 configurations: {} as Record<string, any>,
 lastSync: {} as Record<string, string>,
 };
 
 try {
 const data = await fs.readFile(configPath, 'utf-8');
 status = JSON.parse(data);
 } catch (error) {
 // File doesn't exist, use default
 }
 
 // Update enabled providers
 if (enabled) {
 if (!status.enabled.includes(provider)) {
 status.enabled.push(provider);
 }
 } else {
 status.enabled = status.enabled.filter(p => p !== provider);
 }
 
 // Save updated status
 await fs.writeFile(configPath, JSON.stringify(status, null, 2));
 
 // Update Backstage configuration (if available)
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 
 try {
 // Generate Backstage catalog configuration
 const catalogConfig = generateCatalogConfig(provider, enabled);
 
 // In production, this would update the app-config.yaml or use Backstage's config API
 // For now, we'll save it as a reference
 const backstageConfigPath = path.join(process.cwd(), 'backstage-catalog-config.yaml');
 await fs.writeFile(backstageConfigPath, yaml.dump(catalogConfig));
 
 // Try to reload Backstage catalog if API is available
 await fetch(`${backstageUrl}/api/catalog/refresh`, {
 method: 'POST',
 });
 } catch (error) {
 console.log('Could not update Backstage configuration:', error);
 }
 
 return NextResponse.json({
 success: true,
 provider,
 enabled,
 message: `${provider} discovery ${enabled ? 'enabled' : 'disabled'}`,
 });
 } catch (error) {
 console.error('Failed to toggle provider:', error);
 return NextResponse.json(
 { error: 'Failed to toggle provider' },
 { status: 500 }
 );
 }
}

function generateCatalogConfig(provider: string, enabled: boolean) {
 const config: any = {
 catalog: {
 providers: {},
 },
 };
 
 if (!enabled) return config;
 
 switch (provider) {
 case 'github':
 config.catalog.providers.github = {
 organization: process.env.GITHUB_ORG || 'my-org',
 catalogPath: '/catalog-info.yaml',
 filters: {
 allowedTopics: ['backstage'],
 excludeArchived: true,
 },
 schedule: {
 frequency: { minutes: 30 },
 timeout: { minutes: 15 },
 },
 };
 break;
 
 case 'kubernetes':
 config.catalog.providers.kubernetes = {
 serviceLocatorMethod: { type: 'multiTenant' },
 clusterLocatorMethods: [
 {
 type: 'config',
 clusters: [
 {
 name: 'production',
 url: process.env.K8S_CLUSTER_URL || 'https://kubernetes.default.svc',
 authProvider: 'serviceAccount',
 },
 ],
 },
 ],
 };
 break;
 
 case 'aws':
 config.catalog.providers.awsS3 = {
 buckets: ['my-catalog-bucket'],
 region: process.env.AWS_REGION || 'us-east-1',
 schedule: {
 frequency: { minutes: 60 },
 timeout: { minutes: 5 },
 },
 };
 break;
 
 case 'gitlab':
 config.catalog.providers.gitlab = {
 host: process.env.GITLAB_HOST || 'gitlab.com',
 apiBaseUrl: process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4',
 proxyPath: '/gitlab/api',
 schedule: {
 frequency: { minutes: 30 },
 timeout: { minutes: 10 },
 },
 };
 break;
 }
 
 return config;
}