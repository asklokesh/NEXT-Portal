import { NextRequest, NextResponse } from 'next/server';
import yaml from 'js-yaml';
import { Octokit } from '@octokit/rest';

interface CatalogEntity {
 apiVersion?: string;
 kind: string;
 metadata: {
 name: string;
 namespace?: string;
 description?: string;
 [key: string]: any;
 };
 spec?: Record<string, any>;
}

async function fetchGitHubFile(url: string, branch?: string): Promise<string> {
 // Parse GitHub URL
 const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(blob|tree|raw)\/([^\/]+)\/(.+)/);
 if (!match) {
 throw new Error('Invalid GitHub URL format');
 }

 const [, owner, repo, , defaultBranch, path] = match;
 const actualBranch = branch || defaultBranch;

 const octokit = new Octokit({
 auth: process.env.GITHUB_TOKEN
 });

 try {
 const { data } = await octokit.repos.getContent({
 owner,
 repo,
 path: path.replace(/^\//, ''),
 ref: actualBranch
 });

 if ('content' in data) {
 return Buffer.from(data.content, 'base64').toString();
 } else {
 throw new Error('File content not found');
 }
 } catch (error: any) {
 throw new Error(`Failed to fetch file from GitHub: ${error.message}`);
 }
}

async function fetchGitLabFile(url: string, branch?: string): Promise<string> {
 // Parse GitLab URL
 const match = url.match(/gitlab\.com\/(.+?)\/-\/(blob|tree|raw)\/([^\/]+)\/(.+)/);
 if (!match) {
 throw new Error('Invalid GitLab URL format');
 }

 const [, projectPath, , defaultBranch, filePath] = match;
 const actualBranch = branch || defaultBranch;

 const projectId = encodeURIComponent(projectPath);
 const encodedPath = encodeURIComponent(filePath);
 const apiUrl = `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodedPath}/raw?ref=${actualBranch}`;

 const response = await fetch(apiUrl, {
 headers: process.env.GITLAB_TOKEN ? {
 'PRIVATE-TOKEN': process.env.GITLAB_TOKEN
 } : {}
 });

 if (!response.ok) {
 throw new Error(`Failed to fetch file from GitLab: ${response.statusText}`);
 }

 return response.text();
}

async function fetchRawUrl(url: string): Promise<string> {
 const response = await fetch(url);
 if (!response.ok) {
 throw new Error(`Failed to fetch file: ${response.statusText}`);
 }
 return response.text();
}

async function scanRepository(url: string, branch?: string, subPath?: string, catalogFile?: string): Promise<CatalogEntity[]> {
 const entities: CatalogEntity[] = [];
 const errors: string[] = [];

 // Parse repository URL
 const isGitHub = url.includes('github.com');
 const isGitLab = url.includes('gitlab.com');

 if (isGitHub) {
 const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
 if (!match) {
 throw new Error('Invalid GitHub repository URL');
 }

 const [, owner, repo] = match;
 const octokit = new Octokit({
 auth: process.env.GITHUB_TOKEN
 });

 try {
 // Get repository tree
 const { data: ref } = await octokit.git.getRef({
 owner,
 repo,
 ref: `heads/${branch || 'main'}`
 });

 const { data: tree } = await octokit.git.getTree({
 owner,
 repo,
 tree_sha: ref.object.sha,
 recursive: 'true'
 });

 // Find catalog files
 const catalogFiles = tree.tree.filter(item => {
 if (item.type !== 'blob') return false;
 
 const path = item.path || '';
 if (subPath && !path.startsWith(subPath)) return false;
 
 const filename = path.split('/').pop() || '';
 return filename === (catalogFile || 'catalog-info.yaml') ||
 filename === 'catalog-info.yml' ||
 filename.endsWith('.catalog.yaml') ||
 filename.endsWith('.catalog.yml');
 });

 // Fetch and parse each catalog file
 for (const file of catalogFiles) {
 try {
 const { data } = await octokit.repos.getContent({
 owner,
 repo,
 path: file.path || '',
 ref: branch || 'main'
 });

 if ('content' in data) {
 const content = Buffer.from(data.content, 'base64').toString();
 const parsed = yaml.loadAll(content) as CatalogEntity[];
 
 for (const entity of parsed) {
 if (entity && entity.kind && entity.metadata) {
 entities.push(entity);
 }
 }
 }
 } catch (error: any) {
 errors.push(`Failed to parse ${file.path}: ${error.message}`);
 }
 }
 } catch (error: any) {
 throw new Error(`Failed to scan GitHub repository: ${error.message}`);
 }
 } else if (isGitLab) {
 // Similar implementation for GitLab
 throw new Error('GitLab repository scanning not yet implemented');
 } else {
 throw new Error('Unsupported repository provider');
 }

 return entities;
}

export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const { url, type, branch, subPath, catalogFile, dryRun } = body;

 let entities: CatalogEntity[] = [];
 const warnings: string[] = [];
 const errors: string[] = [];

 if (type === 'single-file') {
 // Fetch and parse single file
 try {
 let content: string;
 
 if (url.includes('github.com')) {
 content = await fetchGitHubFile(url, branch);
 } else if (url.includes('gitlab.com')) {
 content = await fetchGitLabFile(url, branch);
 } else {
 content = await fetchRawUrl(url);
 }

 // Parse YAML content
 const parsed = yaml.loadAll(content) as CatalogEntity[];
 
 for (const entity of parsed) {
 if (entity && entity.kind && entity.metadata) {
 // Validate entity structure
 if (!entity.metadata.name) {
 errors.push('Entity missing required metadata.name field');
 continue;
 }
 
 // Set default namespace if not provided
 if (!entity.metadata.namespace) {
 entity.metadata.namespace = 'default';
 }
 
 entities.push(entity);
 } else {
 errors.push('Invalid entity structure found in file');
 }
 }
 } catch (error: any) {
 return NextResponse.json(
 { error: `Failed to import file: ${error.message}` },
 { status: 400 }
 );
 }
 } else if (type === 'repository') {
 // Scan repository for catalog files
 try {
 entities = await scanRepository(url, branch, subPath, catalogFile);
 } catch (error: any) {
 return NextResponse.json(
 { error: `Failed to scan repository: ${error.message}` },
 { status: 400 }
 );
 }
 }

 // If not a dry run, import entities to Backstage catalog
 if (!dryRun && entities.length > 0) {
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 
 for (const entity of entities) {
 try {
 const response = await fetch(`${backstageUrl}/api/catalog/entities`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(entity)
 });

 if (!response.ok) {
 const error = await response.text();
 errors.push(`Failed to import ${entity.metadata.name}: ${error}`);
 }
 } catch (error: any) {
 errors.push(`Failed to import ${entity.metadata.name}: ${error.message}`);
 }
 }
 }

 return NextResponse.json({
 entities,
 warnings,
 errors,
 dryRun
 });
 } catch (error) {
 console.error('Import URL error:', error);
 return NextResponse.json(
 { error: 'Failed to import from URL' },
 { status: 500 }
 );
 }
}

export async function GET() {
 return NextResponse.json({ message: 'Import URL endpoint' });
}