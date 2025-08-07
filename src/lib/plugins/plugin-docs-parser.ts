/**
 * Plugin Documentation Parser
 * Automatically parses plugin documentation to generate configuration forms
 */

import { PluginConfigField, PluginConfigSection, PluginConfigSchema } from './plugin-configs';

export interface ParsedPluginDocs {
 pluginId: string;
 pluginName: string;
 version: string;
 description: string;
 documentationUrl: string;
 configSections: PluginConfigSection[];
 environmentVariables: string[];
 requiredIntegrations: string[];
}

export class PluginDocsParser {
 private readonly commonFieldPatterns = [
 // URL patterns
 { pattern: /(?:base|server|controller|endpoint)[-_]?url/i, type: 'url' as const },
 { pattern: /(?:api|webhook)[-_]?url/i, type: 'url' as const },
 
 // Auth patterns
 { pattern: /(?:token|key|secret|password|pwd)/i, type: 'password' as const },
 { pattern: /(?:username|user|email)/i, type: 'text' as const },
 
 // Boolean patterns
 { pattern: /(?:enable|disable|skip|ignore|allow)/i, type: 'boolean' as const },
 { pattern: /(?:ssl|tls)[-_]?(?:verify|check)/i, type: 'boolean' as const },
 
 // Number patterns
 { pattern: /(?:port|timeout|interval|limit|max|min|count)/i, type: 'number' as const },
 
 // Select patterns for common choices
 { pattern: /(?:region|zone|environment|env)/i, type: 'select' as const },
 { pattern: /(?:auth|authentication)[-_]?(?:type|method)/i, type: 'select' as const },
 ];

 /**
 * Parse plugin documentation from various sources
 */
 async parsePluginDocumentation(
 pluginName: string,
 version: string,
 sources: {
 readme?: string;
 packageJson?: any;
 backstageConfig?: any;
 npmData?: any;
 }
 ): Promise<ParsedPluginDocs | null> {
 try {
 const pluginId = this.extractPluginId(pluginName);
 
 // Extract basic information
 const description = this.extractDescription(sources);
 const documentationUrl = this.extractDocumentationUrl(sources);
 
 // Parse configuration sections
 const configSections = await this.parseConfigurationSections(sources);
 
 // Extract environment variables
 const environmentVariables = this.extractEnvironmentVariables(sources);
 
 // Extract required integrations
 const requiredIntegrations = this.extractRequiredIntegrations(sources);

 return {
 pluginId,
 pluginName: this.formatPluginName(pluginName),
 version,
 description,
 documentationUrl,
 configSections,
 environmentVariables,
 requiredIntegrations
 };
 } catch (error) {
 console.error('Failed to parse plugin documentation:', error);
 return null;
 }
 }

 /**
 * Generate configuration schema from parsed documentation
 */
 generateConfigSchema(parsedDocs: ParsedPluginDocs): PluginConfigSchema {
 return {
 pluginId: parsedDocs.pluginId,
 pluginName: parsedDocs.pluginName,
 version: parsedDocs.version,
 description: parsedDocs.description,
 documentationUrl: parsedDocs.documentationUrl,
 sections: parsedDocs.configSections,
 environmentVariables: parsedDocs.environmentVariables,
 requiredIntegrations: parsedDocs.requiredIntegrations
 };
 }

 /**
 * Parse README.md content for configuration information
 */
 private parseReadmeConfig(readme: string): PluginConfigSection[] {
 const sections: PluginConfigSection[] = [];
 
 // Look for configuration sections
 const configSectionRegex = /#{1,3}\s*(?:Configuration|Config|Setup|Installation)\s*\n([\s\S]*?)(?=\n#{1,3}|\n\n\n|$)/gi;
 const matches = readme.matchAll(configSectionRegex);
 
 for (const match of matches) {
 const sectionContent = match[1];
 const fields = this.extractFieldsFromText(sectionContent);
 
 if (fields.length > 0) {
 sections.push({
 title: 'Configuration',
 description: 'Plugin configuration settings',
 fields
 });
 }
 }

 // Look for environment variables section
 const envSectionRegex = /#{1,3}\s*(?:Environment|Environment Variables|Env)\s*\n([\s\S]*?)(?=\n#{1,3}|\n\n\n|$)/gi;
 const envMatches = readme.matchAll(envSectionRegex);
 
 for (const match of envMatches) {
 const envContent = match[1];
 const envFields = this.extractEnvironmentFields(envContent);
 
 if (envFields.length > 0) {
 sections.push({
 title: 'Environment Variables',
 description: 'Required environment variables',
 fields: envFields
 });
 }
 }

 return sections;
 }

 /**
 * Extract configuration fields from text content
 */
 private extractFieldsFromText(text: string): PluginConfigField[] {
 const fields: PluginConfigField[] = [];
 
 // Look for configuration patterns in text
 const patterns = [
 // YAML-style config examples
 /(\w+):\s*(.+?)(?:\n|$)/g,
 // Property-style configs
 /(\w+)\s*=\s*(.+?)(?:\n|$)/g,
 // JSON-style configs
 /"(\w+)":\s*"(.+?)"/g,
 ];

 for (const pattern of patterns) {
 const matches = text.matchAll(pattern);
 for (const match of matches) {
 const fieldName = match[1];
 const example = match[2];
 
 if (this.isValidFieldName(fieldName)) {
 const field = this.createFieldFromPattern(fieldName, example);
 if (field && !fields.some(f => f.name === field.name)) {
 fields.push(field);
 }
 }
 }
 }

 return fields;
 }

 /**
 * Create field configuration from pattern analysis
 */ 
 private createFieldFromPattern(fieldName: string, example: string): PluginConfigField | null {
 const lowerName = fieldName.toLowerCase();
 
 // Determine field type based on patterns
 let fieldType: PluginConfigField['type'] = 'text';
 let options: { value: string; label: string }[] | undefined;
 let validation: PluginConfigField['validation'] | undefined;
 let sensitive = false;
 let required = true;

 // Check against common patterns
 for (const { pattern, type } of this.commonFieldPatterns) {
 if (pattern.test(lowerName)) {
 fieldType = type;
 if (type === 'password') {
 sensitive = true;
 }
 break;
 }
 }

 // Special handling for specific field types
 if (lowerName.includes('region')) {
 options = this.getRegionOptions(fieldName);
 } else if (lowerName.includes('auth') && lowerName.includes('type')) {
 options = this.getAuthTypeOptions();
 } else if (fieldType === 'number') {
 validation = this.getNumberValidation(lowerName);
 }

 // Infer from example value
 if (example) {
 if (/^\d+$/.test(example.trim())) {
 fieldType = 'number';
 } else if (/^https?:\/\//.test(example.trim())) {
 fieldType = 'url';
 } else if (/^(true|false)$/i.test(example.trim())) {
 fieldType = 'boolean';
 }
 }

 return {
 name: fieldName,
 label: this.formatFieldLabel(fieldName),
 type: fieldType,
 required,
 description: this.generateFieldDescription(fieldName, example),
 placeholder: this.generatePlaceholder(fieldName, example),
 options,
 validation,
 sensitive
 };
 }

 /**
 * Extract environment variables from documentation
 */
 private extractEnvironmentVariables(sources: any): string[] {
 const envVars: string[] = [];
 
 if (sources.readme) {
 // Look for environment variable patterns
 const envPatterns = [
 /\$\{([A-Z_]+)\}/g,
 /process\.env\.([A-Z_]+)/g,
 /([A-Z_]+)=.+/g
 ];

 for (const pattern of envPatterns) {
 const matches = sources.readme.matchAll(pattern);
 for (const match of matches) {
 const envVar = match[1];
 if (envVar && !envVars.includes(envVar)) {
 envVars.push(envVar);
 }
 }
 }
 }

 return envVars;
 }

 /**
 * Extract required integrations from documentation
 */
 private extractRequiredIntegrations(sources: any): string[] {
 const integrations: string[] = [];
 
 if (sources.readme) {
 const integrationPatterns = [
 /integration[s]?\s*:\s*\[([^\]]+)\]/gi,
 /requires?\s*([a-z]+)\s*integration/gi,
 /@backstage\/integration-([a-z]+)/gi
 ];

 for (const pattern of integrationPatterns) {
 const matches = sources.readme.matchAll(pattern);
 for (const match of matches) {
 const integration = match[1];
 if (integration && !integrations.includes(integration)) {
 integrations.push(integration);
 }
 }
 }
 }

 return integrations;
 }

 /**
 * Parse configuration sections from all sources
 */
 private async parseConfigurationSections(sources: any): Promise<PluginConfigSection[]> {
 const sections: PluginConfigSection[] = [];

 // Parse from README
 if (sources.readme) {
 sections.push(...this.parseReadmeConfig(sources.readme));
 }

 // Parse from package.json backstage config
 if (sources.packageJson?.backstage?.config) {
 sections.push(...this.parsePackageJsonConfig(sources.packageJson.backstage.config));
 }

 // Parse from Backstage configuration schema
 if (sources.backstageConfig) {
 sections.push(...this.parseBackstageConfigSchema(sources.backstageConfig));
 }

 return sections;
 }

 /**
 * Parse configuration from package.json
 */
 private parsePackageJsonConfig(config: any): PluginConfigSection[] {
 const sections: PluginConfigSection[] = [];
 
 if (config.schema) {
 const fields = this.parseJsonSchema(config.schema);
 if (fields.length > 0) {
 sections.push({
 title: 'Plugin Configuration',
 description: 'Configuration options for this plugin',
 fields
 });
 }
 }

 return sections;
 }

 /**
 * Parse JSON schema to extract fields
 */
 private parseJsonSchema(schema: any): PluginConfigField[] {
 const fields: PluginConfigField[] = [];
 
 if (schema.properties) {
 for (const [key, prop] of Object.entries(schema.properties)) {
 const field = this.createFieldFromJsonSchema(key, prop as any);
 if (field) {
 fields.push(field);
 }
 }
 }

 return fields;
 }

 /**
 * Create field from JSON schema property
 */
 private createFieldFromJsonSchema(key: string, prop: any): PluginConfigField | null {
 let type: PluginConfigField['type'] = 'text';
 
 switch (prop.type) {
 case 'string':
 type = prop.format === 'uri' ? 'url' : 'text';
 break;
 case 'number':
 case 'integer':
 type = 'number';
 break;
 case 'boolean':
 type = 'boolean';
 break;
 case 'array':
 type = 'textarea';
 break;
 case 'object':
 type = 'json';
 break;
 }

 return {
 name: key,
 label: this.formatFieldLabel(key),
 type,
 required: prop.required || false,
 description: prop.description || this.generateFieldDescription(key),
 placeholder: prop.example || this.generatePlaceholder(key),
 validation: this.createValidationFromSchema(prop)
 };
 }

 /**
 * Create validation rules from JSON schema
 */
 private createValidationFromSchema(prop: any): PluginConfigField['validation'] | undefined {
 const validation: any = {};
 
 if (prop.pattern) {
 validation.pattern = prop.pattern;
 }
 if (prop.minimum !== undefined) {
 validation.min = prop.minimum;
 }
 if (prop.maximum !== undefined) {
 validation.max = prop.maximum;
 }

 return Object.keys(validation).length > 0 ? validation : undefined;
 }

 // Helper methods
 private extractPluginId(pluginName: string): string {
 return pluginName
 .replace('@backstage/plugin-', '')
 .replace('@roadiehq/backstage-plugin-', '')
 .replace('backstage-plugin-', '')
 .replace(/-/g, '-');
 }

 private formatPluginName(pluginName: string): string {
 return this.extractPluginId(pluginName)
 .split('-')
 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
 .join(' ');
 }

 private extractDescription(sources: any): string {
 return sources.packageJson?.description || 
 sources.npmData?.description || 
 'Plugin configuration';
 }

 private extractDocumentationUrl(sources: any): string {
 return sources.packageJson?.homepage ||
 sources.npmData?.homepage ||
 sources.packageJson?.repository?.url ||
 'https://backstage.io/docs/plugins/';
 }

 private formatFieldLabel(fieldName: string): string {
 return fieldName
 .replace(/([A-Z])/g, ' $1')
 .replace(/[-_]/g, ' ')
 .trim()
 .split(' ')
 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
 .join(' ');
 }

 private generateFieldDescription(fieldName: string, example?: string): string {
 const name = fieldName.toLowerCase();
 
 if (name.includes('url')) return 'URL endpoint for the service';
 if (name.includes('token') || name.includes('key')) return 'Authentication token or API key';
 if (name.includes('username')) return 'Username for authentication';
 if (name.includes('password')) return 'Password for authentication';
 if (name.includes('timeout')) return 'Timeout duration in seconds';
 if (name.includes('region')) return 'Geographic region for the service';
 
 return `Configuration value for ${this.formatFieldLabel(fieldName)}`;
 }

 private generatePlaceholder(fieldName: string, example?: string): string {
 if (example) return example;
 
 const name = fieldName.toLowerCase();
 
 if (name.includes('url')) return 'https://api.example.com';
 if (name.includes('token')) return 'your-api-token';
 if (name.includes('username')) return 'your-username';
 if (name.includes('region')) return 'us-east-1';
 if (name.includes('port')) return '8080';
 
 return '';
 }

 private isValidFieldName(name: string): boolean {
 return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name) && name.length < 50;
 }

 private getRegionOptions(fieldName: string): { value: string; label: string }[] {
 if (fieldName.toLowerCase().includes('aws')) {
 return [
 { value: 'us-east-1', label: 'US East (N. Virginia)' },
 { value: 'us-west-2', label: 'US West (Oregon)' },
 { value: 'eu-west-1', label: 'Europe (Ireland)' }
 ];
 }
 
 return [
 { value: 'us-central', label: 'US Central' },
 { value: 'us-east', label: 'US East' },
 { value: 'us-west', label: 'US West' },
 { value: 'europe', label: 'Europe' },
 { value: 'asia', label: 'Asia' }
 ];
 }

 private getAuthTypeOptions(): { value: string; label: string }[] {
 return [
 { value: 'token', label: 'API Token' },
 { value: 'basic', label: 'Basic Auth' },
 { value: 'oauth', label: 'OAuth' },
 { value: 'saml', label: 'SAML' },
 { value: 'oidc', label: 'OpenID Connect' }
 ];
 }

 private getNumberValidation(fieldName: string): { min?: number; max?: number } {
 if (fieldName.includes('port')) {
 return { min: 1, max: 65535 };
 }
 if (fieldName.includes('timeout')) {
 return { min: 1, max: 3600 };
 }
 return {};
 }

 private extractEnvironmentFields(envContent: string): PluginConfigField[] {
 const fields: PluginConfigField[] = [];
 const envVarPattern = /([A-Z_]+)(?:\s*-\s*(.+?))?(?:\n|$)/g;
 
 const matches = envContent.matchAll(envVarPattern);
 for (const match of matches) {
 const envVar = match[1];
 const description = match[2] || `Environment variable: ${envVar}`;
 
 fields.push({
 name: envVar.toLowerCase(),
 label: this.formatFieldLabel(envVar),
 type: envVar.includes('PASSWORD') || envVar.includes('SECRET') || envVar.includes('TOKEN') ? 'password' : 'text',
 required: true,
 description,
 sensitive: envVar.includes('PASSWORD') || envVar.includes('SECRET') || envVar.includes('TOKEN')
 });
 }

 return fields;
 }

 private parseBackstageConfigSchema(backstageConfig: any): PluginConfigSection[] {
 // This would parse Backstage-specific configuration schemas
 // Implementation depends on the specific schema format
 return [];
 }
}

// Export singleton instance
export const pluginDocsParser = new PluginDocsParser();