/**
 * Custom Plugin Builder
 * Allows users to create custom Backstage plugins with no-code configuration
 */

import { PluginConfigSchema, PluginConfigSection, PluginConfigField } from './plugin-configs';

export interface CustomPluginTemplate {
 id: string;
 name: string;
 description: string;
 category: string;
 baseTemplate: 'frontend' | 'backend' | 'fullstack' | 'extension';
 scaffoldingData: {
 packageName: string;
 displayName: string;
 description: string;
 owner: string;
 type: string;
 };
 configSchema: PluginConfigSchema;
 codeTemplate: {
 frontend?: string;
 backend?: string;
 config?: Record<string, any>;
 };
}

export interface CustomPluginBuildResult {
 success: boolean;
 pluginId: string;
 packageName: string;
 files?: Array<{
 path: string;
 content: string;
 }>;
 installInstructions?: string[];
 error?: string;
}

export class CustomPluginBuilder {
 private templates: Map<string, CustomPluginTemplate> = new Map();

 constructor() {
 this.initializeBuiltInTemplates();
 }

 /**
 * Initialize built-in plugin templates
 */
 private initializeBuiltInTemplates(): void {
 // API Integration Plugin Template
 this.templates.set('api-integration', {
 id: 'api-integration',
 name: 'API Integration Plugin',
 description: 'Create a plugin that integrates with external APIs',
 category: 'integration',
 baseTemplate: 'frontend',
 scaffoldingData: {
 packageName: '@backstage/plugin-custom-api',
 displayName: 'Custom API Integration',
 description: 'Custom plugin for API integration',
 owner: 'platform-team',
 type: 'service'
 },
 configSchema: {
 pluginId: 'custom-api',
 pluginName: 'Custom API Integration',
 version: '1.0.0',
 description: 'Custom plugin for external API integration',
 documentationUrl: 'https://backstage.io/docs/plugins/',
 sections: [{
 title: 'API Configuration',
 description: 'Configure the external API connection',
 fields: [
 {
 name: 'apiUrl',
 label: 'API Base URL',
 type: 'url',
 required: true,
 description: 'Base URL of the external API'
 },
 {
 name: 'apiKey',
 label: 'API Key',
 type: 'password',
 required: true,
 description: 'API key for authentication',
 sensitive: true
 },
 {
 name: 'timeout',
 label: 'Request Timeout (ms)',
 type: 'number',
 required: false,
 description: 'Request timeout in milliseconds',
 defaultValue: 5000,
 validation: { min: 1000, max: 30000 }
 }
 ]
 }],
 environmentVariables: ['CUSTOM_API_KEY'],
 requiredIntegrations: []
 },
 codeTemplate: {
 frontend: `// Custom API Integration Plugin - Frontend
import React from 'react';
import { InfoCard, Header, Page, Content } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

export const CustomApiPage = () => {
 const config = useApi(configApiRef);
 const apiUrl = config.getString('customApi.apiUrl');
 
 return (
 <Page themeId="tool">
 <Header title="Custom API Integration" />
 <Content>
 <InfoCard title="API Status">
 <p>Connected to: {apiUrl}</p>
 </InfoCard>
 </Content>
 </Page>
 );
};`,
 config: {
 customApi: {
 apiUrl: '${API_URL}',
 apiKey: '${API_KEY}',
 timeout: 5000
 }
 }
 }
 });

 // Dashboard Widget Plugin Template
 this.templates.set('dashboard-widget', {
 id: 'dashboard-widget',
 name: 'Dashboard Widget Plugin',
 description: 'Create a custom dashboard widget',
 category: 'visualization',
 baseTemplate: 'frontend',
 scaffoldingData: {
 packageName: '@backstage/plugin-custom-widget',
 displayName: 'Custom Dashboard Widget',
 description: 'Custom dashboard widget plugin',
 owner: 'platform-team',
 type: 'website'
 },
 configSchema: {
 pluginId: 'custom-widget',
 pluginName: 'Custom Dashboard Widget',
 version: '1.0.0',
 description: 'Custom dashboard widget for displaying metrics',
 documentationUrl: 'https://backstage.io/docs/plugins/',
 sections: [{
 title: 'Widget Configuration',
 description: 'Configure the dashboard widget',
 fields: [
 {
 name: 'title',
 label: 'Widget Title',
 type: 'text',
 required: true,
 description: 'Title displayed on the widget'
 },
 {
 name: 'refreshInterval',
 label: 'Refresh Interval (seconds)',
 type: 'number',
 required: false,
 description: 'How often to refresh widget data',
 defaultValue: 30,
 validation: { min: 5, max: 300 }
 },
 {
 name: 'showChart',
 label: 'Show Chart',
 type: 'boolean',
 required: false,
 description: 'Whether to display data as a chart',
 defaultValue: true
 }
 ]
 }],
 environmentVariables: [],
 requiredIntegrations: []
 },
 codeTemplate: {
 frontend: `// Custom Dashboard Widget - Frontend
import React, { useState, useEffect } from 'react';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

export const CustomWidget = () => {
 const config = useApi(configApiRef);
 const [data, setData] = useState(null);
 
 const title = config.getString('customWidget.title');
 const refreshInterval = config.getNumber('customWidget.refreshInterval') * 1000;
 
 useEffect(() => {
 const fetchData = () => {
 // Fetch widget data here
 setData({ value: Math.random() * 100 });
 };
 
 fetchData();
 const interval = setInterval(fetchData, refreshInterval);
 
 return () => clearInterval(interval);
 }, [refreshInterval]);
 
 return (
 <InfoCard title={title}>
 <div>
 <h3>Current Value: {data?.value?.toFixed(2)}</h3>
 </div>
 </InfoCard>
 );
};`,
 config: {
 customWidget: {
 title: '${WIDGET_TITLE}',
 refreshInterval: 30,
 showChart: true
 }
 }
 }
 });

 // Backend Service Plugin Template
 this.templates.set('backend-service', {
 id: 'backend-service',
 name: 'Backend Service Plugin',
 description: 'Create a custom backend service plugin',
 category: 'backend',
 baseTemplate: 'backend',
 scaffoldingData: {
 packageName: '@backstage/plugin-custom-backend',
 displayName: 'Custom Backend Service',
 description: 'Custom backend service plugin',
 owner: 'platform-team',
 type: 'service'
 },
 configSchema: {
 pluginId: 'custom-backend',
 pluginName: 'Custom Backend Service',
 version: '1.0.0',
 description: 'Custom backend service for processing data',
 documentationUrl: 'https://backstage.io/docs/plugins/',
 sections: [{
 title: 'Service Configuration',
 description: 'Configure the backend service',
 fields: [
 {
 name: 'port',
 label: 'Service Port',
 type: 'number',
 required: false,
 description: 'Port for the backend service',
 defaultValue: 7000,
 validation: { min: 3000, max: 9999 }
 },
 {
 name: 'enableCaching',
 label: 'Enable Caching',
 type: 'boolean',
 required: false,
 description: 'Enable response caching',
 defaultValue: true
 },
 {
 name: 'logLevel',
 label: 'Log Level',
 type: 'select',
 required: false,
 description: 'Logging level for the service',
 options: [
 { value: 'debug', label: 'Debug' },
 { value: 'info', label: 'Info' },
 { value: 'warn', label: 'Warning' },
 { value: 'error', label: 'Error' }
 ],
 defaultValue: 'info'
 }
 ]
 }],
 environmentVariables: ['CUSTOM_BACKEND_PORT'],
 requiredIntegrations: []
 },
 codeTemplate: {
 backend: `// Custom Backend Service - Backend
import { Router } from 'express';
import { Logger } from 'winston';

export interface CustomBackendOptions {
 logger: Logger;
 port?: number;
 enableCaching?: boolean;
 logLevel?: string;
}

export function createRouter(options: CustomBackendOptions): Router {
 const { logger, port = 7000, enableCaching = true, logLevel = 'info' } = options;
 
 const router = Router();
 
 router.get('/health', (req, res) => {
 res.json({ status: 'ok', port, caching: enableCaching });
 });
 
 router.get('/data', (req, res) => {
 logger.log(logLevel, 'Data requested');
 res.json({ 
 data: 'Custom backend response',
 timestamp: new Date().toISOString()
 });
 });
 
 return router;
}`,
 config: {
 customBackend: {
 port: 7000,
 enableCaching: true,
 logLevel: 'info'
 }
 }
 }
 });
 }

 /**
 * Get all available plugin templates
 */
 getAvailableTemplates(): CustomPluginTemplate[] {
 return Array.from(this.templates.values());
 }

 /**
 * Get a specific plugin template
 */
 getTemplate(templateId: string): CustomPluginTemplate | null {
 return this.templates.get(templateId) || null;
 }

 /**
 * Create a custom plugin from template
 */
 async buildCustomPlugin(
 templateId: string,
 customization: {
 pluginName: string;
 pluginId: string;
 description: string;
 owner: string;
 configuration: Record<string, any>;
 }
 ): Promise<CustomPluginBuildResult> {
 try {
 const template = this.templates.get(templateId);
 if (!template) {
 return {
 success: false,
 pluginId: customization.pluginId,
 packageName: '',
 error: 'Template not found'
 };
 }

 // Generate package name
 const packageName = `@backstage/plugin-${customization.pluginId}`;

 // Generate plugin files
 const files = await this.generatePluginFiles(template, customization);

 // Generate install instructions
 const installInstructions = this.generateInstallInstructions(packageName, customization);

 return {
 success: true,
 pluginId: customization.pluginId,
 packageName,
 files,
 installInstructions
 };
 } catch (error) {
 return {
 success: false,
 pluginId: customization.pluginId,
 packageName: '',
 error: error instanceof Error ? error.message : 'Unknown error'
 };
 }
 }

 /**
 * Generate plugin files from template
 */
 private async generatePluginFiles(
 template: CustomPluginTemplate,
 customization: {
 pluginName: string;
 pluginId: string;
 description: string;
 owner: string;
 configuration: Record<string, any>;
 }
 ): Promise<Array<{ path: string; content: string }>> {
 const files: Array<{ path: string; content: string }> = [];

 // Generate package.json
 files.push({
 path: 'package.json',
 content: JSON.stringify({
 name: `@backstage/plugin-${customization.pluginId}`,
 version: '1.0.0',
 description: customization.description,
 main: 'src/index.ts',
 types: 'src/index.ts',
 license: 'Apache-2.0',
 publishConfig: {
 access: 'public',
 main: 'dist/index.esm.js',
 types: 'dist/index.d.ts'
 },
 backstage: {
 role: template.baseTemplate === 'backend' ? 'backend-plugin' : 'web-library'
 },
 dependencies: this.generateDependencies(template.baseTemplate),
 devDependencies: this.generateDevDependencies(),
 files: ['dist'],
 scripts: {
 build: 'backstage-cli package build',
 lint: 'backstage-cli package lint',
 test: 'backstage-cli package test',
 clean: 'backstage-cli package clean'
 }
 }, null, 2)
 });

 // Generate README.md
 files.push({
 path: 'README.md',
 content: this.generateReadme(customization)
 });

 // Generate main plugin files
 if (template.codeTemplate.frontend) {
 files.push({
 path: 'src/components/CustomComponent.tsx',
 content: this.processTemplate(template.codeTemplate.frontend, customization)
 });

 files.push({
 path: 'src/plugin.ts',
 content: this.generatePluginDefinition(customization, 'frontend')
 });
 }

 if (template.codeTemplate.backend) {
 files.push({
 path: 'src/service/router.ts',
 content: this.processTemplate(template.codeTemplate.backend, customization)
 });

 files.push({
 path: 'src/plugin.ts',
 content: this.generatePluginDefinition(customization, 'backend')
 });
 }

 // Generate index file
 files.push({
 path: 'src/index.ts',
 content: this.generateIndexFile(template.baseTemplate, customization)
 });

 // Generate configuration schema
 files.push({
 path: 'src/config.ts',
 content: this.generateConfigSchema(template.configSchema, customization)
 });

 return files;
 }

 /**
 * Process template with variable substitution
 */
 private processTemplate(
 template: string,
 customization: {
 pluginName: string;
 pluginId: string;
 description: string;
 owner: string;
 configuration: Record<string, any>;
 }
 ): string {
 let processed = template;

 // Replace template variables
 processed = processed.replace(/\$\{PLUGIN_NAME\}/g, customization.pluginName);
 processed = processed.replace(/\$\{PLUGIN_ID\}/g, customization.pluginId);
 processed = processed.replace(/\$\{DESCRIPTION\}/g, customization.description);
 processed = processed.replace(/\$\{OWNER\}/g, customization.owner);

 // Replace configuration variables
 Object.entries(customization.configuration).forEach(([key, value]) => {
 const placeholder = `\$\{${key.toUpperCase()}\}`;
 processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
 });

 return processed;
 }

 /**
 * Generate plugin definition
 */
 private generatePluginDefinition(
 customization: { pluginName: string; pluginId: string },
 type: 'frontend' | 'backend'
 ): string {
 if (type === 'frontend') {
 return `import { createPlugin, createComponentExtension } from '@backstage/core-plugin-api';

export const ${customization.pluginId}Plugin = createPlugin({
 id: '${customization.pluginId}',
 routes: {
 root: ${customization.pluginId}RouteRef,
 },
});

export const ${customization.pluginId}Page = ${customization.pluginId}Plugin.provide(
 createComponentExtension({
 name: '${customization.pluginName}Page',
 component: {
 lazy: () => import('./components/CustomComponent').then(m => m.CustomComponent),
 },
 })
);`;
 } else {
 return `import { createBackendPlugin } from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

export const ${customization.pluginId}Plugin = createBackendPlugin({
 pluginId: '${customization.pluginId}',
 register(env) {
 env.registerInit({
 deps: {
 logger: coreServices.logger,
 httpRouter: coreServices.httpRouter,
 },
 async init({ logger, httpRouter }) {
 httpRouter.use(await createRouter({ logger }));
 },
 });
 },
});`;
 }
 }

 /**
 * Generate dependencies based on template type
 */
 private generateDependencies(baseTemplate: string): Record<string, string> {
 const commonDeps = {
 '@backstage/core-plugin-api': '^1.41.0',
 '@backstage/core-components': '^1.41.0'
 };

 if (baseTemplate === 'backend') {
 return {
 ...commonDeps,
 '@backstage/backend-plugin-api': '^1.41.0',
 '@backstage/backend-common': '^1.41.0',
 'express': '^4.17.1',
 'winston': '^3.2.1'
 };
 }

 return {
 ...commonDeps,
 'react': '^18.0.0',
 'react-dom': '^18.0.0'
 };
 }

 /**
 * Generate development dependencies
 */
 private generateDevDependencies(): Record<string, string> {
 return {
 '@backstage/cli': '^1.41.0',
 '@backstage/dev-utils': '^1.41.0',
 '@types/react': '^18.0.0',
 'typescript': '~5.2.0'
 };
 }

 /**
 * Generate README content
 */
 private generateReadme(customization: {
 pluginName: string;
 pluginId: string;
 description: string;
 owner: string;
 }): string {
 return `# ${customization.pluginName}

${customization.description}

## Installation

\`\`\`bash
# Install the plugin
yarn add @backstage/plugin-${customization.pluginId}
\`\`\`

## Configuration

Add the plugin to your \`app-config.yaml\`:

\`\`\`yaml
${customization.pluginId}:
 # Plugin configuration goes here
\`\`\`

## Usage

Import and use the plugin in your Backstage app:

\`\`\`typescript
import { ${customization.pluginId}Page } from '@backstage/plugin-${customization.pluginId}';

// Add to your App.tsx routes
<Route path="/${customization.pluginId}" element={<${customization.pluginId}Page />} />
\`\`\`

## Development

This plugin was generated using the SaaS IDP Custom Plugin Builder.

Owner: ${customization.owner}
`;
 }

 /**
 * Generate configuration schema
 */
 private generateConfigSchema(
 schema: PluginConfigSchema,
 customization: { pluginId: string }
 ): string {
 return `export const configSchema = ${JSON.stringify({
 ...schema,
 pluginId: customization.pluginId
 }, null, 2)};`;
 }

 /**
 * Generate index file
 */
 private generateIndexFile(
 baseTemplate: string,
 customization: { pluginId: string }
 ): string {
 if (baseTemplate === 'backend') {
 return `export { ${customization.pluginId}Plugin as default } from './plugin';`;
 }

 return `export { ${customization.pluginId}Plugin, ${customization.pluginId}Page } from './plugin';`;
 }

 /**
 * Generate installation instructions
 */
 private generateInstallInstructions(
 packageName: string,
 customization: { pluginId: string; pluginName: string }
 ): string[] {
 return [
 `Install the plugin package: yarn add ${packageName}`,
 `Add configuration to app-config.yaml for ${customization.pluginId}`,
 `Import and register the plugin in your Backstage app`,
 `Add route to App.tsx: <Route path="/${customization.pluginId}" element={<${customization.pluginName}Page />} />`,
 'Restart your Backstage application',
 `Visit /${customization.pluginId} to see your custom plugin`
 ];
 }

 /**
 * Add a custom template
 */
 addCustomTemplate(template: CustomPluginTemplate): void {
 this.templates.set(template.id, template);
 }

 /**
 * Remove a template
 */
 removeTemplate(templateId: string): boolean {
 return this.templates.delete(templateId);
 }

 /**
 * Get templates by category
 */
 getTemplatesByCategory(category: string): CustomPluginTemplate[] {
 return Array.from(this.templates.values()).filter(
 template => template.category === category
 );
 }
}

// Export singleton instance
export const customPluginBuilder = new CustomPluginBuilder();