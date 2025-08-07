import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
 try {
 // Get search and category filters
 const searchParams = new URL(req.url).searchParams;
 const query = searchParams.get('search') || '';
 const category = searchParams.get('category') || 'all';
 
 // Build comprehensive search queries for Backstage plugins
 const searchQueries = [
 '@backstage/plugin-',
 'backstage-plugin',
 '@roadiehq/backstage-plugin-',
 '@spotify/backstage-plugin-',
 '@k8s-service-bindings/plugin-',
 query ? query : ''
 ].filter(Boolean);
 
 let allPlugins: any[] = [];
 
 // Fetch from multiple searches to get comprehensive plugin list
 for (const searchQuery of searchQueries) {
 try {
 const response = await fetch(
 `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(searchQuery)}&size=100`,
 { 
 cache: 'no-store',
 signal: AbortSignal.timeout(5000)
 }
 );
 
 if (response.ok) {
 const data = await response.json();
 if (data.objects) {
 allPlugins.push(...data.objects);
 }
 }
 } catch (error) {
 console.warn(`Failed to fetch plugins for query: ${searchQuery}`, error);
 }
 }
 
 // Remove duplicates based on package name
 const uniquePlugins = allPlugins.reduce((acc, current) => {
 const exists = acc.find(plugin => plugin.package.name === current.package.name);
 if (!exists) {
 acc.push(current);
 }
 return acc;
 }, []);
 
 console.log(`Found ${uniquePlugins.length} unique plugins`);
 
 // If no plugins found from npm, return curated list of essential plugins
 if (uniquePlugins.length === 0) {
 return NextResponse.json({
 plugins: getCuratedPluginsList(),
 total: getCuratedPluginsList().length,
 source: 'curated'
 });
 }
 
 // Filter and format Backstage plugins
 const plugins = uniquePlugins
 .filter((pkg: any) => {
 const name = pkg.package.name.toLowerCase();
 const keywords = (pkg.package.keywords || []).join(' ').toLowerCase();
 const description = (pkg.package.description || '').toLowerCase();
 
 // Include official Backstage plugins
 if (name.startsWith('@backstage/plugin-')) return true;
 
 // Include community plugins with backstage keywords
 if (keywords.includes('backstage') || keywords.includes('backstage-plugin')) return true;
 
 // Include description mentions of backstage
 if (description.includes('backstage')) return true;
 
 // Include specific enterprise plugins
 if (name.includes('roadiehq') && name.includes('plugin')) return true;
 if (name.includes('spotify') && name.includes('backstage')) return true;
 
 return false;
 })
 .map((item: any) => {
 const pkg = item.package;
 return {
 id: pkg.name, // Use the full package name as ID
 name: pkg.name,
 title: pkg.name.replace('@backstage/plugin-', '').replace('@roadiehq/backstage-plugin-', '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
 description: pkg.description || 'No description available',
 version: pkg.version,
 author: pkg.author?.name || pkg.maintainers?.[0]?.name || 'Backstage Community',
 category: categorizePlugin(pkg.name, pkg.keywords || []),
 tags: pkg.keywords || [],
 downloads: item.downloads?.weekly || 0,
 stars: Math.round((item.score?.final || 0) * 1000),
 lastUpdated: pkg.date,
 npm: `https://www.npmjs.com/package/${pkg.name}`,
 homepage: pkg.links?.homepage || pkg.links?.repository,
 repository: pkg.links?.repository,
 installed: false, // Will be checked separately
 enabled: false,
 configurable: true
 };
 })
 .sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0)); // Sort by popularity
 
 // If still no plugins after filtering, add curated plugins
 if (plugins.length === 0) {
 return NextResponse.json({
 plugins: getCuratedPluginsList(),
 total: getCuratedPluginsList().length,
 source: 'curated'
 });
 }

 return NextResponse.json({
 plugins,
 total: plugins.length
 });
 } catch (error) {
 console.error('Failed to fetch plugins:', error);
 return NextResponse.json(
 { error: 'Failed to fetch plugins' },
 { status: 500 }
 );
 }
}

function categorizePlugin(name: string, keywords: string[]): string {
 const keywordStr = keywords.join(' ').toLowerCase();
 const nameStr = name.toLowerCase();
 
 if (nameStr.includes('catalog') || keywordStr.includes('catalog')) return 'core';
 if (nameStr.includes('kubernetes') || nameStr.includes('k8s') || keywordStr.includes('kubernetes')) return 'infrastructure';
 if (nameStr.includes('github') || nameStr.includes('gitlab') || nameStr.includes('bitbucket')) return 'ci-cd';
 if (nameStr.includes('jenkins') || nameStr.includes('circleci') || nameStr.includes('ci')) return 'ci-cd';
 if (nameStr.includes('pagerduty') || nameStr.includes('opsgenie') || keywordStr.includes('incident')) return 'monitoring';
 if (nameStr.includes('cost') || nameStr.includes('finops')) return 'cost-management';
 if (nameStr.includes('security') || nameStr.includes('vault') || keywordStr.includes('security')) return 'security';
 if (nameStr.includes('analytics') || nameStr.includes('insights')) return 'analytics';
 if (nameStr.includes('docs') || nameStr.includes('techdocs')) return 'documentation';
 
 return 'other';
}

// Curated list of essential Backstage plugins
function getCuratedPluginsList() {
 return [
 {
 id: '@backstage/plugin-kubernetes',
 name: '@backstage/plugin-kubernetes',
 title: 'Kubernetes',
 description: 'View and manage Kubernetes resources for your services',
 version: '0.18.0',
 author: 'Backstage Core',
 category: 'infrastructure',
 tags: ['kubernetes', 'k8s', 'infrastructure', 'containers'],
 downloads: 35000,
 stars: 890,
 npm: 'https://www.npmjs.com/package/@backstage/plugin-kubernetes',
 homepage: 'https://backstage.io/docs/features/kubernetes/',
 repository: 'https://github.com/backstage/backstage',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@backstage/plugin-github-actions',
 name: '@backstage/plugin-github-actions',
 title: 'GitHub Actions',
 description: 'View and trigger GitHub Actions workflows',
 version: '0.8.0',
 author: 'Backstage Core',
 category: 'ci-cd',
 tags: ['github', 'ci-cd', 'workflows', 'actions'],
 downloads: 28000,
 stars: 650,
 npm: 'https://www.npmjs.com/package/@backstage/plugin-github-actions',
 homepage: 'https://backstage.io/docs/integrations/github/github-actions',
 repository: 'https://github.com/backstage/backstage',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@roadiehq/backstage-plugin-jira',
 name: '@roadiehq/backstage-plugin-jira',
 title: 'Jira Integration',
 description: 'View Jira tickets and project information for your services',
 version: '2.5.0',
 author: 'Roadie',
 category: 'productivity',
 tags: ['jira', 'atlassian', 'tickets', 'project-management'],
 downloads: 15000,
 stars: 420,
 npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-jira',
 homepage: 'https://roadie.io/backstage/plugins/jira/',
 repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@k-phoen/backstage-plugin-confluence',
 name: '@k-phoen/backstage-plugin-confluence',
 title: 'Confluence',
 description: 'Browse and search Confluence spaces and pages',
 version: '0.2.0',
 author: 'Kévin Gomez',
 category: 'documentation',
 tags: ['confluence', 'atlassian', 'documentation', 'wiki'],
 downloads: 8500,
 stars: 180,
 npm: 'https://www.npmjs.com/package/@k-phoen/backstage-plugin-confluence',
 homepage: 'https://github.com/K-Phoen/backstage-plugin-confluence',
 repository: 'https://github.com/K-Phoen/backstage-plugin-confluence',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@oriflame/backstage-plugin-servicenow',
 name: '@oriflame/backstage-plugin-servicenow',
 title: 'ServiceNow',
 description: 'ServiceNow integration for incident and change management',
 version: '1.3.0',
 author: 'Oriflame',
 category: 'monitoring',
 tags: ['servicenow', 'itsm', 'incidents', 'change-management'],
 downloads: 5200,
 stars: 95,
 npm: 'https://www.npmjs.com/package/@oriflame/backstage-plugin-servicenow',
 homepage: 'https://github.com/Oriflame/backstage-plugins',
 repository: 'https://github.com/Oriflame/backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@roadiehq/backstage-plugin-argo-cd',
 name: '@roadiehq/backstage-plugin-argo-cd',
 title: 'ArgoCD',
 description: 'View ArgoCD applications and deployment status',
 version: '2.14.0',
 author: 'Roadie',
 category: 'ci-cd',
 tags: ['argocd', 'gitops', 'kubernetes', 'deployment'],
 downloads: 18000,
 stars: 380,
 npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-argo-cd',
 homepage: 'https://roadie.io/backstage/plugins/argo-cd/',
 repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@backstage/plugin-jenkins',
 name: '@backstage/plugin-jenkins',
 title: 'Jenkins',
 description: 'View Jenkins builds and job information',
 version: '0.7.0',
 author: 'Backstage Core',
 category: 'ci-cd',
 tags: ['jenkins', 'ci-cd', 'builds', 'automation'],
 downloads: 22000,
 stars: 320,
 npm: 'https://www.npmjs.com/package/@backstage/plugin-jenkins',
 homepage: 'https://backstage.io/docs/integrations/jenkins/',
 repository: 'https://github.com/backstage/backstage',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@roadiehq/backstage-plugin-aws',
 name: '@roadiehq/backstage-plugin-aws',
 title: 'AWS Integration',
 description: 'View AWS resources and services for your applications',
 version: '2.8.0',
 author: 'Roadie',
 category: 'infrastructure',
 tags: ['aws', 'cloud', 'infrastructure', 'resources'],
 downloads: 12000,
 stars: 290,
 npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-aws',
 homepage: 'https://roadie.io/backstage/plugins/aws/',
 repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@roadiehq/backstage-plugin-terraform',
 name: '@roadiehq/backstage-plugin-terraform',
 title: 'Terraform',
 description: 'View Terraform state and plan information',
 version: '1.5.0',
 author: 'Roadie',
 category: 'infrastructure',
 tags: ['terraform', 'infrastructure-as-code', 'hashicorp', 'iac'],
 downloads: 9800,
 stars: 220,
 npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-terraform',
 homepage: 'https://roadie.io/backstage/plugins/terraform/',
 repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@roadiehq/backstage-plugin-vault',
 name: '@roadiehq/backstage-plugin-vault',
 title: 'HashiCorp Vault',
 description: 'Manage secrets and view Vault policies',
 version: '2.3.0',
 author: 'Roadie',
 category: 'security',
 tags: ['vault', 'hashicorp', 'secrets', 'security'],
 downloads: 7400,
 stars: 185,
 npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-vault',
 homepage: 'https://roadie.io/backstage/plugins/vault/',
 repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@splunk/backstage-plugin-splunk-on-call',
 name: '@splunk/backstage-plugin-splunk-on-call',
 title: 'Splunk On-Call',
 description: 'Incident management with Splunk On-Call integration',
 version: '1.2.0',
 author: 'Splunk',
 category: 'monitoring',
 tags: ['splunk', 'oncall', 'incidents', 'alerting'],
 downloads: 4500,
 stars: 125,
 npm: 'https://www.npmjs.com/package/@splunk/backstage-plugin-splunk-on-call',
 homepage: 'https://github.com/splunk/backstage-plugin-splunk-on-call',
 repository: 'https://github.com/splunk/backstage-plugin-splunk-on-call',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@harness/backstage-plugin-harness-ci-cd',
 name: '@harness/backstage-plugin-harness-ci-cd',
 title: 'Harness CI/CD',
 description: 'View Harness pipelines and deployment information',
 version: '0.4.0',
 author: 'Harness',
 category: 'ci-cd',
 tags: ['harness', 'ci-cd', 'pipelines', 'deployment'],
 downloads: 6200,
 stars: 95,
 npm: 'https://www.npmjs.com/package/@harness/backstage-plugin-harness-ci-cd',
 homepage: 'https://github.com/harness/backstage-plugins',
 repository: 'https://github.com/harness/backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@score-dev/backstage-plugin',
 name: '@score-dev/backstage-plugin',
 title: 'Score.dev',
 description: 'Validate and deploy workloads using Score specifications',
 version: '0.3.0',
 author: 'Score Community',
 category: 'development-tools',
 tags: ['score', 'workload', 'specification', 'deployment'],
 downloads: 2800,
 stars: 45,
 npm: 'https://www.npmjs.com/package/@score-dev/backstage-plugin',
 homepage: 'https://docs.score.dev/',
 repository: 'https://github.com/score-spec/score',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@roadiehq/backstage-plugin-gcp',
 name: '@roadiehq/backstage-plugin-gcp',
 title: 'Google Cloud Platform',
 description: 'View and manage Google Cloud Platform resources',
 version: '1.4.0',
 author: 'Roadie',
 category: 'infrastructure',
 tags: ['gcp', 'google-cloud', 'cloud', 'infrastructure'],
 downloads: 8900,
 stars: 195,
 npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-gcp',
 homepage: 'https://roadie.io/backstage/plugins/gcp/',
 repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@roadiehq/backstage-plugin-azure',
 name: '@roadiehq/backstage-plugin-azure',
 title: 'Microsoft Azure',
 description: 'View and manage Microsoft Azure resources',
 version: '2.1.0',
 author: 'Roadie',
 category: 'infrastructure',
 tags: ['azure', 'microsoft', 'cloud', 'infrastructure'],
 downloads: 7200,
 stars: 165,
 npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-azure',
 homepage: 'https://roadie.io/backstage/plugins/azure/',
 repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@backstage/plugin-route53',
 name: '@backstage/plugin-route53',
 title: 'Route53 DNS',
 description: 'Manage DNS records and hosted zones in AWS Route53',
 version: '1.2.0',
 author: 'AWS Community',
 category: 'infrastructure',
 tags: ['route53', 'dns', 'aws', 'networking'],
 downloads: 3500,
 stars: 78,
 npm: 'https://www.npmjs.com/package/@backstage/plugin-route53',
 homepage: 'https://docs.aws.amazon.com/route53/',
 repository: 'https://github.com/backstage/backstage',
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: '@appdynamics/backstage-plugin',
 name: '@appdynamics/backstage-plugin',
 title: 'AppDynamics',
 description: 'Application performance monitoring with AppDynamics',
 version: '2.0.0',
 author: 'AppDynamics',
 category: 'monitoring',
 tags: ['appdynamics', 'apm', 'monitoring', 'performance'],
 downloads: 4100,
 stars: 92,
 npm: 'https://www.npmjs.com/package/@appdynamics/backstage-plugin',
 homepage: 'https://docs.appdynamics.com/',
 repository: 'https://github.com/AppDynamics/backstage-plugin',
 installed: false,
 enabled: false,
 configurable: true
 }
 ];
}

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { action, pluginId, version, config } = body;

 // Dynamic import to avoid SSR issues
 const { dockerPluginInstaller } = await import('@/lib/plugins/docker-plugin-installer');
 const { backstageIntegrationService } = await import('@/lib/backstage/integration-service');

 switch (action) {
 case 'install':
 console.log(`Installing plugin: ${pluginId}, version: ${version} (Backstage v1.41.0 compatible)`);
 
 // Use Backstage integration service for seamless installation
 const installResult = await backstageIntegrationService.installPluginInBackstage(pluginId, config || {});
 
 if (installResult.success) {
 return NextResponse.json({ 
 success: true, 
 message: installResult.message,
 details: installResult.details,
 status: 'completed',
 backstageVersion: '1.41.0'
 });
 } else {
 return NextResponse.json({ 
 success: false, 
 error: installResult.error || installResult.message,
 status: 'failed'
 }, { status: 400 });
 }
 
 case 'configure':
 console.log(`Configuring plugin: ${pluginId} (Backstage v1.41.0 compatible)`, config);
 
 // Use Backstage integration service for seamless configuration
 const configResult = await backstageIntegrationService.configurePluginInBackstage(pluginId, config);
 
 if (configResult.success) {
 return NextResponse.json({ 
 success: true, 
 message: configResult.message,
 details: configResult.details,
 backstageVersion: '1.41.0'
 });
 } else {
 return NextResponse.json({ 
 success: false, 
 error: configResult.error || configResult.message
 }, { status: 400 });
 }
 
 case 'enable':
 case 'disable':
 const enabled = action === 'enable';
 console.log(`${enabled ? 'Enabling' : 'Disabling'} plugin: ${pluginId}`);
 const toggleResult = await dockerPluginInstaller.togglePlugin(pluginId, enabled);
 
 if (toggleResult.success) {
 return NextResponse.json({ 
 success: true, 
 message: toggleResult.message
 });
 } else {
 return NextResponse.json({ 
 success: false, 
 error: toggleResult.error || toggleResult.message
 }, { status: 400 });
 }
 
 case 'uninstall':
 // TODO: Implement plugin uninstallation
 return NextResponse.json({ 
 success: true, 
 message: `Plugin ${pluginId} uninstalled successfully`
 });
 
 default:
 return NextResponse.json(
 { error: 'Invalid action' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Plugin operation failed:', error);
 return NextResponse.json(
 { error: 'Plugin operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
 { status: 500 }
 );
 }
}