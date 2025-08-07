import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
 try {
 const { organization, includeArchived, includePrivate, includeForks } = await request.json();
 
 const octokit = new Octokit({
 auth: process.env.GITHUB_TOKEN,
 });
 
 // Fetch organization repositories
 const repositories = [];
 let page = 1;
 let hasMore = true;
 
 while (hasMore && page <= 10) { // Limit to 10 pages for safety
 try {
 const { data } = await octokit.repos.listForOrg({
 org: organization,
 per_page: 100,
 page,
 type: 'all',
 });
 
 for (const repo of data) {
 // Apply filters
 if (!includeArchived && repo.archived) continue;
 if (!includePrivate && repo.private) continue;
 if (!includeForks && repo.fork) continue;
 
 repositories.push({
 id: repo.id,
 name: repo.name,
 full_name: repo.full_name,
 description: repo.description,
 topics: repo.topics || [],
 language: repo.language,
 stargazers_count: repo.stargazers_count,
 forks_count: repo.forks_count,
 updated_at: repo.updated_at,
 default_branch: repo.default_branch,
 visibility: repo.visibility,
 archived: repo.archived,
 });
 }
 
 hasMore = data.length === 100;
 page++;
 } catch (error: any) {
 if (error.status === 404) {
 return NextResponse.json(
 { error: 'Organization not found' },
 { status: 404 }
 );
 }
 throw error;
 }
 }
 
 return NextResponse.json({
 repositories,
 total: repositories.length,
 });
 } catch (error: any) {
 console.error('GitHub scan error:', error);
 return NextResponse.json(
 { error: error.message || 'Failed to scan GitHub organization' },
 { status: 500 }
 );
 }
}