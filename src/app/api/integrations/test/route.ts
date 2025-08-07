import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
 try {
 const { provider } = await request.json();

 if (!provider) {
 return NextResponse.json(
 { error: 'Provider configuration is required' },
 { status: 400 }
 );
 }

 // Test connection based on provider type
 const result = await testProviderConnection(provider);
 
 return NextResponse.json(result);
 } catch (error) {
 console.error('Provider test error:', error);
 return NextResponse.json(
 { 
 success: false, 
 error: error instanceof Error ? error.message : 'Connection test failed' 
 },
 { status: 500 }
 );
 }
}

async function testProviderConnection(provider: any): Promise<{ success: boolean; error?: string; details?: any }> {
 switch (provider.type) {
 case 'github':
 return testGitHubConnection(provider.config);
 
 case 'gitlab':
 return testGitLabConnection(provider.config);
 
 case 'kubernetes':
 return testKubernetesConnection(provider.config);
 
 case 'aws':
 return testAWSConnection(provider.config);
 
 case 'gcp':
 return testGCPConnection(provider.config);
 
 default:
 return { success: false, error: 'Unknown provider type' };
 }
}

async function testGitHubConnection(config: any): Promise<{ success: boolean; error?: string; details?: any }> {
 try {
 if (!config.token) {
 return { success: false, error: 'GitHub token is required' };
 }

 const apiUrl = config.apiBaseUrl || 'https://api.github.com';
 const response = await fetch(`${apiUrl}/user`, {
 headers: {
 'Authorization': `token ${config.token}`,
 'Accept': 'application/vnd.github.v3+json',
 },
 });

 if (!response.ok) {
 if (response.status === 401) {
 return { success: false, error: 'Invalid GitHub token' };
 }
 return { success: false, error: `GitHub API error: ${response.status}` };
 }

 const user = await response.json();
 return { 
 success: true, 
 details: { 
 user: user.login,
 scopes: response.headers.get('x-oauth-scopes'),
 } 
 };
 } catch (error) {
 return { 
 success: false, 
 error: `Failed to connect to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}` 
 };
 }
}

async function testGitLabConnection(config: any): Promise<{ success: boolean; error?: string; details?: any }> {
 try {
 if (!config.token) {
 return { success: false, error: 'GitLab token is required' };
 }

 const apiUrl = config.apiBaseUrl || 'https://gitlab.com/api/v4';
 const response = await fetch(`${apiUrl}/user`, {
 headers: {
 'PRIVATE-TOKEN': config.token,
 },
 });

 if (!response.ok) {
 if (response.status === 401) {
 return { success: false, error: 'Invalid GitLab token' };
 }
 return { success: false, error: `GitLab API error: ${response.status}` };
 }

 const user = await response.json();
 return { 
 success: true, 
 details: { 
 user: user.username,
 isAdmin: user.is_admin,
 } 
 };
 } catch (error) {
 return { 
 success: false, 
 error: `Failed to connect to GitLab: ${error instanceof Error ? error.message : 'Unknown error'}` 
 };
 }
}

async function testKubernetesConnection(config: any): Promise<{ success: boolean; error?: string; details?: any }> {
 try {
 if (!config.clusters || config.clusters.length === 0) {
 return { success: false, error: 'No Kubernetes clusters configured' };
 }

 const results = [];
 for (const cluster of config.clusters) {
 if (!cluster.url) {
 results.push({ cluster: cluster.name, success: false, error: 'Missing API server URL' });
 continue;
 }

 // In a real implementation, this would:
 // 1. Load appropriate auth credentials
 // 2. Make actual K8s API calls
 // 3. Verify cluster connectivity

 // Mock successful connection for demo
 results.push({ 
 cluster: cluster.name, 
 success: true,
 version: 'v1.28.0',
 nodes: 3,
 });
 }

 const allSuccessful = results.every(r => r.success);
 return { 
 success: allSuccessful, 
 details: { clusters: results },
 error: allSuccessful ? undefined : 'Some clusters failed to connect',
 };
 } catch (error) {
 return { 
 success: false, 
 error: `Failed to connect to Kubernetes: ${error instanceof Error ? error.message : 'Unknown error'}` 
 };
 }
}

async function testAWSConnection(config: any): Promise<{ success: boolean; error?: string; details?: any }> {
 try {
 if (!config.accounts || config.accounts.length === 0) {
 return { success: false, error: 'No AWS accounts configured' };
 }

 // In a real implementation, this would:
 // 1. Use AWS SDK to assume roles
 // 2. Verify permissions
 // 3. List accessible resources

 const results = config.accounts.map((account: any) => ({
 accountId: account.accountId,
 success: true,
 region: account.region || 'us-east-1',
 accessible: true,
 }));

 return { 
 success: true, 
 details: { accounts: results },
 };
 } catch (error) {
 return { 
 success: false, 
 error: `Failed to connect to AWS: ${error instanceof Error ? error.message : 'Unknown error'}` 
 };
 }
}

async function testGCPConnection(config: any): Promise<{ success: boolean; error?: string; details?: any }> {
 try {
 if (!config.projects || config.projects.length === 0) {
 return { success: false, error: 'No GCP projects configured' };
 }

 // In a real implementation, this would:
 // 1. Parse service account key JSON
 // 2. Use GCP client libraries
 // 3. Verify project access

 const results = config.projects.map((project: any) => {
 try {
 const keyData = JSON.parse(project.keyFile);
 return {
 projectId: project.projectId,
 success: true,
 serviceAccount: keyData.client_email,
 };
 } catch {
 return {
 projectId: project.projectId,
 success: false,
 error: 'Invalid service account key',
 };
 }
 });

 const allSuccessful = results.every((r: any) => r.success);
 return { 
 success: allSuccessful, 
 details: { projects: results },
 error: allSuccessful ? undefined : 'Some projects failed validation',
 };
 } catch (error) {
 return { 
 success: false, 
 error: `Failed to connect to GCP: ${error instanceof Error ? error.message : 'Unknown error'}` 
 };
 }
}