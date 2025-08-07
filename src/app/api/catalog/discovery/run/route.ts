import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import yaml from 'js-yaml';

interface DiscoveryResult {
  provider: string;
  entities: Array<{
    apiVersion?: string;
    kind: string;
    metadata: {
      name: string;
      namespace?: string;
      title?: string;
      description?: string;
      annotations?: Record<string, string>;
      tags?: string[];
      links?: Array<{ url: string; title: string; icon?: string }>;
    };
    spec?: Record<string, any>;
  }>;
  errors: string[];
  warnings: string[];
}

// Helper function to determine component type based on repository info
function determineComponentType(repo: any): string {
  const name = repo.name.toLowerCase();
  const description = (repo.description || '').toLowerCase();
  const topics = repo.topics || [];
  
  // Check topics first
  if (topics.includes('library')) return 'library';
  if (topics.includes('service')) return 'service';
  if (topics.includes('website')) return 'website';
  if (topics.includes('tool')) return 'tool';
  if (topics.includes('documentation')) return 'documentation';
  
  // Check name patterns
  if (name.includes('-api') || name.includes('-service')) return 'service';
  if (name.includes('-lib') || name.includes('library')) return 'library';
  if (name.includes('-ui') || name.includes('-frontend') || name.includes('-web')) return 'website';
  if (name.includes('-docs') || name.includes('documentation')) return 'documentation';
  if (name.includes('-tool') || name.includes('-cli')) return 'tool';
  
  // Check language
  if (repo.language === 'JavaScript' || repo.language === 'TypeScript') {
    if (repo.has_pages) return 'website';
    return 'service';
  }
  
  // Default based on language
  return repo.language ? 'service' : 'documentation';
}

async function discoverGitHubEntities(config: any): Promise<DiscoveryResult> {
  const entities = [];
  const errors = [];
  const warnings = [];

  try {
    const token = config.token || process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GitHub token is required for discovery');
    }

    const octokit = new Octokit({ auth: token });

    const orgName = config.organization || config.org;
    console.log(`Starting GitHub discovery for organization: ${orgName}`);
    
    if (!orgName) {
      throw new Error('GitHub organization is required');
    }

    // Fetch organization details
    try {
      const { data: org } = await octokit.orgs.get({ org: orgName });
      
      entities.push({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Group',
        metadata: {
          name: orgName.toLowerCase(),
          namespace: 'github',
          title: org.name || orgName,
          description: org.description || `GitHub organization ${orgName}`,
          annotations: {
            'github.com/org-name': orgName,
            'github.com/org-url': org.html_url,
            'backstage.io/managed-by-location': 'github-discovery'
          }
        },
        spec: {
          type: 'organization',
          profile: {
            displayName: org.name || orgName,
            email: org.email || '',
            picture: org.avatar_url || ''
          },
          children: []
        }
      });
      
      console.log(`Successfully fetched organization: ${orgName}`);
    } catch (error: any) {
      console.error(`Failed to fetch org ${orgName}:`, error.message);
      errors.push(`Failed to fetch org ${orgName}: ${error.message}`);
    }

    // Fetch repositories
    try {
      console.log(`Fetching repositories for org: ${orgName}`);
      
      // Fetch all pages of repositories
      let allRepos = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const { data: repos } = await octokit.repos.listForOrg({
          org: orgName,
          per_page: 100,
          page,
          type: 'all'
        });
        
        allRepos = allRepos.concat(repos);
        hasMore = repos.length === 100;
        page++;
        
        if (page > 10) { // Safety limit
          warnings.push('Repository pagination limit reached. Some repositories may not be discovered.');
          break;
        }
      }

      console.log(`Found ${allRepos.length} repositories`);
      
      for (const repo of allRepos) {
        // Skip archived repos if configured
        if (repo.archived && !config.includeArchived) {
          console.log(`Skipping archived repo: ${repo.name}`);
          continue;
        }

        // Apply topic filter if provided
        if (config.topics?.length > 0) {
          const hasMatchingTopic = config.topics.some((topic: string) => 
            repo.topics?.includes(topic)
          );
          if (!hasMatchingTopic) {
            console.log(`Skipping repo ${repo.name} - no matching topics`);
            continue;
          }
        }

        // Try to fetch catalog-info.yaml from the repo
        let catalogInfo = null;
        const catalogPath = config.catalogPath || 'catalog-info.yaml';
        
        try {
          const { data: fileContent } = await octokit.repos.getContent({
            owner: orgName,
            repo: repo.name,
            path: catalogPath
          });

          if ('content' in fileContent) {
            const content = Buffer.from(fileContent.content, 'base64').toString();
            catalogInfo = yaml.load(content);
            console.log(`Found ${catalogPath} in ${repo.name}`);
          }
        } catch (error) {
          // No catalog-info.yaml found, create basic entity
          console.log(`No ${catalogPath} found in ${repo.name}, creating default entity`);
        }

        if (catalogInfo && catalogInfo.kind && catalogInfo.metadata) {
          // Use existing catalog-info.yaml, ensure it has apiVersion
          entities.push({
            apiVersion: catalogInfo.apiVersion || 'backstage.io/v1alpha1',
            ...catalogInfo,
            metadata: {
              ...catalogInfo.metadata,
              namespace: catalogInfo.metadata.namespace || 'default',
              annotations: {
                ...catalogInfo.metadata.annotations,
                'github.com/project-slug': `${orgName}/${repo.name}`,
                'github.com/repo-url': repo.html_url,
                'backstage.io/managed-by-location': `url:${repo.html_url}/blob/${repo.default_branch}/${catalogPath}`
              }
            }
          });
        } else {
          // Create entity from repository metadata
          const entityName = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          
          entities.push({
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: entityName,
              namespace: 'default',
              title: repo.name,
              description: repo.description || `Repository ${repo.name}`,
              annotations: {
                'github.com/project-slug': `${orgName}/${repo.name}`,
                'github.com/repo-url': repo.html_url,
                'backstage.io/managed-by-location': `url:${repo.html_url}`,
                'backstage.io/source-location': `url:${repo.html_url}/tree/${repo.default_branch || 'main'}`,
                'backstage.io/view-url': repo.homepage || repo.html_url
              },
              tags: repo.topics || [],
              links: [
                {
                  url: repo.html_url,
                  title: 'Repository',
                  icon: 'github'
                },
                ...(repo.homepage ? [{
                  url: repo.homepage,
                  title: 'Website',
                  icon: 'web'
                }] : [])
              ]
            },
            spec: {
              type: determineComponentType(repo),
              lifecycle: repo.archived ? 'deprecated' : 'production',
              owner: orgName.toLowerCase()
            }
          });
        }
      }

      console.log(`Successfully processed ${entities.length - 1} repositories`);
    } catch (error: any) {
      console.error(`Failed to fetch repositories:`, error.message);
      errors.push(`Failed to fetch repositories: ${error.message}`);
    }

    // Fetch teams if requested
    if (config.includeTeams) {
      try {
        console.log(`Fetching teams for org: ${orgName}`);
        const { data: teams } = await octokit.teams.list({
          org: orgName,
          per_page: 100
        });

        for (const team of teams) {
          entities.push({
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Group',
            metadata: {
              name: team.slug.toLowerCase(),
              namespace: 'github',
              title: team.name,
              description: team.description || `GitHub team ${team.name}`,
              annotations: {
                'github.com/team-slug': `${orgName}/${team.slug}`,
                'github.com/team-url': team.html_url,
                'backstage.io/managed-by-location': 'github-discovery'
              }
            },
            spec: {
              type: 'team',
              parent: orgName.toLowerCase(),
              profile: {
                displayName: team.name,
                picture: ''
              },
              members: []
            }
          });
        }
        
        console.log(`Successfully fetched ${teams.length} teams`);
      } catch (error: any) {
        console.error(`Failed to fetch teams:`, error.message);
        errors.push(`Failed to fetch teams: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error(`GitHub discovery failed:`, error.message);
    errors.push(`GitHub discovery failed: ${error.message}`);
  }

  console.log(`GitHub discovery completed: ${entities.length} entities found`);
  return {
    provider: 'github',
    entities,
    errors,
    warnings
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Discovery request received:', body);
    
    // Extract providers from the request
    const providers = body.providers || [];
    const rules = body.rules || [];
    const dryRun = body.dryRun || false;
    
    if (!providers || providers.length === 0) {
      return NextResponse.json({
        error: 'No providers configured',
        entitiesFound: 0
      }, { status: 400 });
    }

    // Process each provider
    const results = [];
    for (const provider of providers) {
      if (!provider.enabled && provider.id !== 'github') {
        continue;
      }

      console.log(`Processing provider: ${provider.id}`);
      
      let result: DiscoveryResult;
      
      switch (provider.id) {
        case 'github':
          // Ensure config has required fields
          const githubConfig = {
            ...provider.config,
            organization: provider.config?.organization || provider.config?.org,
            token: provider.config?.token || process.env.GITHUB_TOKEN,
            includeArchived: provider.config?.includeArchived || false,
            includeTeams: provider.config?.includeTeams || false,
            topics: provider.config?.topics || [],
            catalogPath: provider.config?.catalogPath || 'catalog-info.yaml'
          };
          
          result = await discoverGitHubEntities(githubConfig);
          break;
          
        default:
          result = {
            provider: provider.id,
            entities: [],
            errors: [`Provider ${provider.id} not implemented yet`],
            warnings: []
          };
      }
      
      results.push(result);
    }

    // Apply rules to filter entities
    let allEntities = results.flatMap(r => r.entities);
    
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        
        if (rule.type === 'include' && rule.pattern) {
          allEntities = allEntities.filter(entity => 
            entity.metadata.name.includes(rule.pattern) ||
            entity.kind.toLowerCase().includes(rule.pattern.toLowerCase())
          );
        } else if (rule.type === 'exclude' && rule.pattern) {
          allEntities = allEntities.filter(entity => 
            !entity.metadata.name.includes(rule.pattern) &&
            !entity.kind.toLowerCase().includes(rule.pattern.toLowerCase())
          );
        }
      }
    }

    console.log(`Total entities after filtering: ${allEntities.length}`);

    // If not a dry run, save entities to the catalog
    let importedCount = 0;
    let importErrors = [];

    if (!dryRun && allEntities.length > 0) {
      try {
        console.log('Saving entities to catalog...');
        
        // Call the catalog entities API to save them
        const catalogUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        const response = await fetch(`${catalogUrl}/api/catalog/entities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(allEntities)
        });

        if (response.ok) {
          const result = await response.json();
          importedCount = result.entities?.length || 0;
          importErrors = result.errors || [];
          console.log(`Successfully imported ${importedCount} entities`);
        } else {
          const errorText = await response.text();
          console.error('Failed to save entities:', errorText);
          importErrors.push(`Failed to save entities: ${response.statusText}`);
        }
      } catch (error: any) {
        console.error('Error saving entities:', error);
        importErrors.push(`Error saving entities: ${error.message}`);
      }
    }

    const allErrors = results.flatMap(r => r.errors).concat(importErrors);
    const allWarnings = results.flatMap(r => r.warnings);

    return NextResponse.json({
      entitiesFound: dryRun ? allEntities.length : importedCount,
      results,
      summary: {
        totalDiscovered: allEntities.length,
        totalImported: importedCount,
        totalErrors: allErrors.length,
        totalWarnings: allWarnings.length,
        dryRun
      },
      errors: allErrors,
      warnings: allWarnings,
      message: dryRun 
        ? `Dry run completed. Found ${allEntities.length} entities.`
        : `Discovery completed. Imported ${importedCount} of ${allEntities.length} entities.`
    });
    
  } catch (error: any) {
    console.error('Discovery error:', error);
    return NextResponse.json({
      error: 'Discovery failed',
      details: error.message,
      entitiesFound: 0
    }, { status: 500 });
  }
}