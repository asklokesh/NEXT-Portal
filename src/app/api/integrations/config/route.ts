import { NextRequest, NextResponse } from 'next/server';
import * as yaml from 'js-yaml';

// Mock storage for configuration (in production, use database)
let storedConfig: any = null;

export async function GET() {
 try {
 // Return stored config or default
 const config = storedConfig || {
 providers: [],
 locations: [],
 processors: [
 { id: 'github', type: 'github', enabled: true, config: {} },
 { id: 'kubernetes', type: 'kubernetes', enabled: true, config: {} },
 { id: 'techdocs', type: 'techdocs', enabled: true, config: {} },
 { id: 'ownership', type: 'ownership', enabled: true, config: {} },
 ],
 schedule: {
 frequency: 30,
 timeout: 60,
 },
 };

 return NextResponse.json(config);
 } catch (error) {
 console.error('Failed to get integration config:', error);
 return NextResponse.json(
 { error: 'Failed to retrieve configuration' },
 { status: 500 }
 );
 }
}

export async function POST(request: NextRequest) {
 try {
 const config = await request.json();
 
 // Validate configuration
 if (!config.providers || !config.locations || !config.schedule) {
 return NextResponse.json(
 { error: 'Invalid configuration format' },
 { status: 400 }
 );
 }

 // Store configuration
 storedConfig = config;

 // Generate Backstage app-config sections
 const backstageConfig = generateBackstageConfig(config);

 // In production, this would:
 // 1. Store in database
 // 2. Update actual app-config.yaml
 // 3. Trigger Backstage reload
 console.log('Generated Backstage config:', backstageConfig);

 return NextResponse.json({ 
 success: true,
 message: 'Configuration saved successfully',
 backstageConfig 
 });
 } catch (error) {
 console.error('Failed to save integration config:', error);
 return NextResponse.json(
 { error: 'Failed to save configuration' },
 { status: 500 }
 );
 }
}

function generateBackstageConfig(config: any) {
 const backstageConfig: any = {
 integrations: {},
 catalog: {
 rules: [],
 locations: [],
 processors: {},
 },
 };

 // Process providers
 config.providers.forEach((provider: any) => {
 if (!provider.enabled) return;

 switch (provider.type) {
 case 'github':
 if (!backstageConfig.integrations.github) {
 backstageConfig.integrations.github = [];
 }
 backstageConfig.integrations.github.push({
 host: provider.config.host || 'github.com',
 token: provider.config.token,
 apiBaseUrl: provider.config.apiBaseUrl,
 enterprise: provider.config.enterprise,
 });
 break;

 case 'gitlab':
 if (!backstageConfig.integrations.gitlab) {
 backstageConfig.integrations.gitlab = [];
 }
 backstageConfig.integrations.gitlab.push({
 host: provider.config.host || 'gitlab.com',
 token: provider.config.token,
 apiBaseUrl: provider.config.apiBaseUrl,
 });
 break;

 case 'kubernetes':
 backstageConfig.kubernetes = {
 serviceLocatorMethod: {
 type: 'multiTenant',
 },
 clusterLocatorMethods: [
 {
 type: 'config',
 clusters: provider.config.clusters || [],
 },
 ],
 };
 break;

 case 'aws':
 backstageConfig.aws = {
 accounts: provider.config.accounts || [],
 };
 break;

 case 'gcp':
 backstageConfig.gcp = {
 projects: provider.config.projects || [],
 };
 break;
 }
 });

 // Process locations
 config.locations.forEach((location: any) => {
 if (!location.enabled) return;

 switch (location.type) {
 case 'url':
 backstageConfig.catalog.locations.push({
 type: 'url',
 target: location.target,
 });
 break;

 case 'github-discovery':
 backstageConfig.catalog.locations.push({
 type: 'github-discovery',
 target: `https://github.com/${location.target}`,
 rules: [
 {
 allow: location.filters?.filters?.[0]?.include || '.*',
 exclude: location.filters?.filters?.[0]?.exclude,
 },
 ],
 });
 break;

 case 'gitlab-discovery':
 backstageConfig.catalog.locations.push({
 type: 'gitlab-discovery',
 target: location.target,
 });
 break;

 case 'kubernetes-discovery':
 if (!backstageConfig.kubernetes) {
 backstageConfig.kubernetes = {};
 }
 backstageConfig.kubernetes.customResources = [{
 group: 'backstage.io',
 apiVersion: 'v1alpha1',
 namespaces: location.filters?.namespaces?.map((n: any) => n.pattern) || ['*'],
 labelSelector: location.filters?.labelSelector,
 }];
 break;

 case 'aws-discovery':
 if (!backstageConfig.aws) {
 backstageConfig.aws = {};
 }
 backstageConfig.aws.discovery = {
 accounts: location.filters?.accounts || [],
 regions: location.filters?.regions || [],
 resourceTypes: location.filters?.resourceTypes || [],
 };
 break;
 }
 });

 // Process schedule
 backstageConfig.catalog.processingInterval = {
 frequency: { minutes: config.schedule.frequency },
 timeout: { seconds: config.schedule.timeout },
 };

 // Process processors
 const enabledProcessors = config.processors
 .filter((p: any) => p.enabled)
 .map((p: any) => p.type);
 
 backstageConfig.catalog.processors = enabledProcessors;

 return backstageConfig;
}