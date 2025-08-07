import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
 try {
 const { url } = await request.json();

 // Validate URL format
 let urlObj: URL;
 try {
 urlObj = new URL(url);
 } catch (error) {
 return NextResponse.json(
 { error: 'Invalid URL', message: 'Please enter a valid URL' },
 { status: 400 }
 );
 }
 
 // Check if it's a supported Git provider
 const supportedHosts = ['github.com', 'gitlab.com', 'bitbucket.org'];
 const isSupported = supportedHosts.some(host => urlObj.hostname.includes(host));
 
 if (!isSupported && !url.endsWith('.yaml') && !url.endsWith('.yml')) {
 return NextResponse.json(
 { 
 error: 'Unsupported URL', 
 message: 'Please use a URL from GitHub, GitLab, Bitbucket, or a direct YAML file URL' 
 },
 { status: 400 }
 );
 }

 // Actually validate the URL is accessible
 if (urlObj.hostname.includes('github.com')) {
 // Validate GitHub URL
 const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
 if (!match) {
 return NextResponse.json(
 { error: 'Invalid GitHub URL', message: 'URL must point to a GitHub repository or file' },
 { status: 400 }
 );
 }

 const [, owner, repo] = match;
 const octokit = new Octokit({
 auth: process.env.GITHUB_TOKEN
 });

 try {
 // Check if repository exists and is accessible
 await octokit.repos.get({ owner, repo });
 
 // If it's a file URL, check if the file exists
 const fileMatch = url.match(/github\.com\/[^\/]+\/[^\/]+\/(blob|raw)\/[^\/]+\/(.+)/);
 if (fileMatch) {
 const [, , filePath] = fileMatch;
 await octokit.repos.getContent({
 owner,
 repo,
 path: filePath
 });
 }

 return NextResponse.json({ 
 valid: true,
 type: fileMatch ? 'file' : 'repository'
 });
 } catch (error: any) {
 if (error.status === 404) {
 return NextResponse.json(
 { error: 'Not found', message: 'Repository or file not found or not accessible' },
 { status: 404 }
 );
 } else if (error.status === 401) {
 return NextResponse.json(
 { error: 'Authentication required', message: 'GitHub token required for private repositories' },
 { status: 401 }
 );
 } else {
 throw error;
 }
 }
 } else if (urlObj.hostname.includes('gitlab.com')) {
 // Validate GitLab URL
 const match = url.match(/gitlab\.com\/(.+?)(\/-\/(blob|tree|raw)\/(.+))?$/);
 if (!match) {
 return NextResponse.json(
 { error: 'Invalid GitLab URL', message: 'URL must point to a GitLab repository or file' },
 { status: 400 }
 );
 }

 // Basic validation - try to fetch
 const response = await fetch(url, {
 method: 'HEAD',
 headers: process.env.GITLAB_TOKEN ? {
 'PRIVATE-TOKEN': process.env.GITLAB_TOKEN
 } : {}
 });

 if (response.ok) {
 return NextResponse.json({ 
 valid: true,
 type: match[2] ? 'file' : 'repository'
 });
 } else if (response.status === 404) {
 return NextResponse.json(
 { error: 'Not found', message: 'Repository or file not found or not accessible' },
 { status: 404 }
 );
 } else if (response.status === 401) {
 return NextResponse.json(
 { error: 'Authentication required', message: 'GitLab token required for private repositories' },
 { status: 401 }
 );
 }
 } else {
 // For direct URLs, just check if accessible
 try {
 const response = await fetch(url, { method: 'HEAD' });
 
 if (response.ok) {
 // Check content type for YAML files
 const contentType = response.headers.get('content-type');
 if (!contentType?.includes('yaml') && !contentType?.includes('yml') && 
 !contentType?.includes('text') && !url.endsWith('.yaml') && !url.endsWith('.yml')) {
 return NextResponse.json(
 { error: 'Invalid file type', message: 'URL must point to a YAML file' },
 { status: 400 }
 );
 }
 
 return NextResponse.json({ 
 valid: true,
 type: 'file'
 });
 } else {
 return NextResponse.json(
 { error: 'URL not accessible', message: `Failed to access URL: ${response.statusText}` },
 { status: response.status }
 );
 }
 } catch (error: any) {
 return NextResponse.json(
 { error: 'Network error', message: `Failed to validate URL: ${error.message}` },
 { status: 500 }
 );
 }
 }

 return NextResponse.json({ valid: true });
 } catch (error) {
 console.error('Validate URL error:', error);
 return NextResponse.json(
 { error: 'Failed to validate URL' },
 { status: 500 }
 );
 }
}