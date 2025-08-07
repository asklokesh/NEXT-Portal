import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
 try {
 const { integration, config } = await request.json();

 if (!integration || !config) {
 return NextResponse.json(
 { success: false, error: 'Integration and config are required' },
 { status: 400 }
 );
 }

 switch (integration) {
 case 'github': {
 if (!config.token) {
 return NextResponse.json(
 { success: false, error: 'GitHub token is required' },
 { status: 400 }
 );
 }

 try {
 const octokit = new Octokit({ auth: config.token });
 
 // Test by getting authenticated user
 const { data } = await octokit.users.getAuthenticated();
 
 return NextResponse.json({
 success: true,
 message: `Successfully connected to GitHub as ${data.login}`,
 });
 } catch (error) {
 return NextResponse.json(
 { success: false, error: 'Invalid GitHub token or insufficient permissions' },
 { status: 400 }
 );
 }
 }

 case 'gitlab': {
 if (!config.token) {
 return NextResponse.json(
 { success: false, error: 'GitLab token is required' },
 { status: 400 }
 );
 }

 const gitlabUrl = config.url || 'https://gitlab.com';
 
 try {
 const response = await fetch(`${gitlabUrl}/api/v4/user`, {
 headers: {
 'PRIVATE-TOKEN': config.token,
 },
 });

 if (!response.ok) {
 throw new Error('Invalid token');
 }

 const user = await response.json();
 
 return NextResponse.json({
 success: true,
 message: `Successfully connected to GitLab as ${user.username}`,
 });
 } catch (error) {
 return NextResponse.json(
 { success: false, error: 'Invalid GitLab token or URL' },
 { status: 400 }
 );
 }
 }

 case 'aws': {
 if (!config.accessKeyId || !config.secretAccessKey) {
 return NextResponse.json(
 { success: false, error: 'AWS credentials are required' },
 { status: 400 }
 );
 }

 // In a real implementation, you would test AWS credentials
 // For now, we'll do a basic validation
 if (config.accessKeyId.length < 16 || config.secretAccessKey.length < 32) {
 return NextResponse.json(
 { success: false, error: 'Invalid AWS credentials format' },
 { status: 400 }
 );
 }

 return NextResponse.json({
 success: true,
 message: 'AWS credentials format validated (actual connection test pending)',
 });
 }

 case 'kubernetes': {
 if (!config.config) {
 return NextResponse.json(
 { success: false, error: 'Kubeconfig is required' },
 { status: 400 }
 );
 }

 try {
 // Basic YAML validation
 const lines = config.config.split('\n');
 const hasApiVersion = lines.some(line => line.includes('apiVersion:'));
 const hasKind = lines.some(line => line.includes('kind: Config'));
 
 if (!hasApiVersion || !hasKind) {
 throw new Error('Invalid kubeconfig format');
 }

 return NextResponse.json({
 success: true,
 message: 'Kubeconfig format validated',
 });
 } catch (error) {
 return NextResponse.json(
 { success: false, error: 'Invalid kubeconfig format' },
 { status: 400 }
 );
 }
 }

 default:
 return NextResponse.json(
 { success: false, error: `Unknown integration: ${integration}` },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Integration test error:', error);
 
 return NextResponse.json(
 { success: false, error: 'Failed to test integration' },
 { status: 500 }
 );
 }
}