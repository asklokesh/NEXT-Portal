/**
 * Search Indexing API Endpoint
 * 
 * Provides indexing functionality for managing search indices:
 * - Manual reindexing of catalog entities
 * - Index health and status monitoring
 * - Indexing job management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSearchIndexingPipeline } from '@/lib/search/indexing';
import { getElasticsearchClient } from '@/lib/search/elasticsearch';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const client = getElasticsearchClient();

    switch (action) {
      case 'health':
        const isHealthy = await client.isHealthy();
        const clusterInfo = await client.getClusterInfo();
        
        return NextResponse.json({
          success: true,
          data: {
            healthy: isHealthy,
            cluster: clusterInfo
          }
        });

      case 'status':
        const pipeline = getSearchIndexingPipeline();
        const activeJobs = pipeline.getActiveJobs();
        
        return NextResponse.json({
          success: true,
          data: {
            activeJobs,
            totalJobs: activeJobs.length,
            runningJobs: activeJobs.filter(job => job.status === 'running').length,
            completedJobs: activeJobs.filter(job => job.status === 'completed').length,
            failedJobs: activeJobs.filter(job => job.status === 'failed').length
          }
        });

      case 'job':
        const jobId = searchParams.get('jobId');
        if (!jobId) {
          return NextResponse.json(
            { success: false, error: 'Job ID is required' },
            { status: 400 }
          );
        }

        const jobStatus = pipeline.getJobStatus(jobId);
        if (!jobStatus) {
          return NextResponse.json(
            { success: false, error: 'Job not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: jobStatus
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Search index API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Index operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, entities, documents, templates } = body;

    const pipeline = getSearchIndexingPipeline();

    switch (action) {
      case 'reindex-catalog':
        if (!entities || !Array.isArray(entities)) {
          return NextResponse.json(
            { success: false, error: 'Entities array is required' },
            { status: 400 }
          );
        }

        const catalogResult = await pipeline.indexCatalogEntities(entities);
        
        return NextResponse.json({
          success: catalogResult.success,
          data: {
            result: catalogResult,
            message: `Indexed ${catalogResult.successCount} entities`
          }
        });

      case 'index-docs':
        if (!documents || !Array.isArray(documents)) {
          return NextResponse.json(
            { success: false, error: 'Documents array is required' },
            { status: 400 }
          );
        }

        const docsResult = await pipeline.indexDocuments(documents);
        
        return NextResponse.json({
          success: docsResult.success,
          data: {
            result: docsResult,
            message: `Indexed ${docsResult.successCount} documents`
          }
        });

      case 'index-templates':
        if (!templates || !Array.isArray(templates)) {
          return NextResponse.json(
            { success: false, error: 'Templates array is required' },
            { status: 400 }
          );
        }

        const templatesResult = await pipeline.indexTemplates(templates);
        
        return NextResponse.json({
          success: templatesResult.success,
          data: {
            result: templatesResult,
            message: `Indexed ${templatesResult.successCount} templates`
          }
        });

      case 'full-reindex':
        if (!entities || !Array.isArray(entities)) {
          return NextResponse.json(
            { success: false, error: 'Entities array is required' },
            { status: 400 }
          );
        }

        const fullResult = await pipeline.fullReindex(entities);
        
        return NextResponse.json({
          success: fullResult.success,
          data: {
            result: fullResult,
            message: `Full reindex completed: ${fullResult.successCount} entities`
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Search index API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Index operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');

    if (!entityId) {
      return NextResponse.json(
        { success: false, error: 'Entity ID is required' },
        { status: 400 }
      );
    }

    const pipeline = getSearchIndexingPipeline();
    const success = await pipeline.deleteEntity(entityId);

    return NextResponse.json({
      success,
      data: {
        entityId,
        message: success ? 'Entity deleted from search index' : 'Failed to delete entity'
      }
    });

  } catch (error) {
    console.error('Search index delete API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Delete operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}