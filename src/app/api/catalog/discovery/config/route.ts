import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface DiscoveryConfig {
 providers: Array<{
 id: string;
 enabled: boolean;
 config: Record<string, any>;
 }>;
 rules: Array<{
 type: 'include' | 'exclude';
 pattern: string;
 providers?: string[];
 }>;
 schedule?: {
 enabled: boolean;
 interval: string;
 };
}

// Store discovery configuration in app-config
async function saveDiscoveryConfig(config: DiscoveryConfig) {
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 
 // Save to Backstage configuration
 const catalogDiscoveryConfig = {
 catalog: {
 locations: [],
 providers: {}
 }
 };

 // Convert our config to Backstage format
 for (const provider of config.providers) {
 if (!provider.enabled) continue;

 switch (provider.id) {
 case 'github':
 catalogDiscoveryConfig.catalog.providers.github = {
 ...provider.config,
 organization: provider.config.org,
 catalogPath: provider.config.catalogFile || '/catalog-info.yaml',
 filters: {
 allowedTopics: provider.config.topics,
 excludeArchived: !provider.config.includeArchived
 },
 schedule: config.schedule?.enabled ? {
 frequency: { minutes: parseInt(config.schedule.interval) || 60 },
 timeout: { minutes: 3 }
 } : undefined
 };
 break;

 case 'kubernetes':
 catalogDiscoveryConfig.catalog.providers.kubernetes = {
 clusters: [{
 name: provider.config.cluster || 'default',
 authProvider: 'serviceAccount',
 skipTLSVerify: false,
 customResources: provider.config.resources || ['services', 'deployments']
 }],
 serviceLocatorMethod: {
 type: 'multiTenant'
 },
 clusterLocatorMethods: [{
 type: 'config',
 clusters: [{
 name: provider.config.cluster || 'default',
 url: provider.config.endpoint,
 authProvider: 'serviceAccount'
 }]
 }]
 };
 break;

 case 'aws':
 catalogDiscoveryConfig.catalog.locations.push({
 type: 'aws-cloud-accounts',
 target: 'all',
 rules: config.rules.map(rule => ({
 allow: rule.type === 'include' ? [rule.pattern] : undefined,
 deny: rule.type === 'exclude' ? [rule.pattern] : undefined
 }))
 });
 break;

 case 'gcp':
 catalogDiscoveryConfig.catalog.locations.push({
 type: 'gcp-projects',
 target: provider.config.projectId || 'all',
 rules: config.rules.map(rule => ({
 allow: rule.type === 'include' ? [rule.pattern] : undefined,
 deny: rule.type === 'exclude' ? [rule.pattern] : undefined
 }))
 });
 break;
 }
 }

 // Send configuration to Backstage
 try {
 const response = await fetch(`${backstageUrl}/api/config`, {
 method: 'PATCH',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(catalogDiscoveryConfig)
 });

 if (!response.ok) {
 throw new Error(`Backstage API returned ${response.status}`);
 }
 } catch (error) {
 // If Backstage config API is not available, save to local config file
 const configPath = path.join(process.cwd(), 'discovery-config.yaml');
 await fs.writeFile(configPath, yaml.dump(config), 'utf-8');
 }

 return config;
}

// Load discovery configuration
async function loadDiscoveryConfig(): Promise<DiscoveryConfig | null> {
 try {
 // Try to load from local config file first
 const configPath = path.join(process.cwd(), 'discovery-config.yaml');
 const configContent = await fs.readFile(configPath, 'utf-8');
 return yaml.load(configContent) as DiscoveryConfig;
 } catch (error) {
 // Return default empty config
 return null;
 }
}

export async function POST(request: NextRequest) {
 try {
 const { providers, rules, schedule } = await request.json();

 // Validate provider configurations
 for (const provider of providers) {
 if (!provider.id || !provider.config) {
 return NextResponse.json(
 { error: `Invalid provider configuration: ${provider.id}` },
 { status: 400 }
 );
 }

 // Validate specific provider requirements
 switch (provider.id) {
 case 'github':
 if (!provider.config.org && provider.config.type === 'org') {
 return NextResponse.json(
 { error: 'GitHub organization name is required' },
 { status: 400 }
 );
 }
 break;
 case 'kubernetes':
 if (!provider.config.context && !provider.config.kubeconfig) {
 return NextResponse.json(
 { error: 'Kubernetes context or kubeconfig is required' },
 { status: 400 }
 );
 }
 break;
 case 'aws':
 if (!provider.config.region) {
 return NextResponse.json(
 { error: 'AWS region is required' },
 { status: 400 }
 );
 }
 break;
 case 'gcp':
 if (!provider.config.projectId) {
 return NextResponse.json(
 { error: 'GCP project ID is required' },
 { status: 400 }
 );
 }
 break;
 case 'database':
 if (!provider.config.type || !provider.config.host || !provider.config.database) {
 return NextResponse.json(
 { error: 'Database type, host, and name are required' },
 { status: 400 }
 );
 }
 break;
 }
 }

 const config: DiscoveryConfig = {
 providers,
 rules: rules || [],
 schedule
 };

 await saveDiscoveryConfig(config);

 return NextResponse.json({
 success: true,
 message: 'Discovery configuration saved successfully',
 config
 });
 } catch (error) {
 console.error('Discovery config error:', error);
 return NextResponse.json(
 { error: 'Failed to save discovery configuration' },
 { status: 500 }
 );
 }
}

export async function GET() {
 try {
 const config = await loadDiscoveryConfig();
 
 if (!config) {
 return NextResponse.json({
 providers: [],
 rules: [],
 schedule: {
 enabled: false,
 interval: '60'
 },
 lastUpdated: null
 });
 }

 return NextResponse.json({
 ...config,
 lastUpdated: new Date().toISOString()
 });
 } catch (error) {
 console.error('Failed to load discovery config:', error);
 return NextResponse.json({
 providers: [],
 rules: [],
 schedule: {
 enabled: false,
 interval: '60'
 },
 lastUpdated: null
 });
 }
}