import { NextRequest, NextResponse } from 'next/server';
import { CatalogGraphEngine } from '@/lib/catalog-graph/engine';
import { GraphMetricsEngine } from '@/lib/catalog-graph/metrics';
import type { DependencyGraph } from '@/lib/catalog-graph/types';

const graphEngine = new CatalogGraphEngine();
const metricsEngine = new GraphMetricsEngine();

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisType = searchParams.get('type') || 'full';
    
    const body = await request.json();
    const { graph, nodeId } = body;

    if (!graph) {
      return NextResponse.json(
        { error: 'Graph data is required' },
        { status: 400 }
      );
    }

    const dependencyGraph = graph as DependencyGraph;

    switch (analysisType) {
      case 'impact':
        if (!nodeId) {
          return NextResponse.json(
            { error: 'nodeId is required for impact analysis' },
            { status: 400 }
          );
        }
        
        const impactAnalysis = await graphEngine.analyzeImpact(dependencyGraph, nodeId);
        return NextResponse.json({ 
          type: 'impact',
          nodeId,
          analysis: impactAnalysis,
          timestamp: new Date().toISOString(),
        });

      case 'metrics':
        const metrics = metricsEngine.calculateMetrics(dependencyGraph);
        return NextResponse.json({
          type: 'metrics',
          metrics,
          timestamp: new Date().toISOString(),
        });

      case 'analytics':
        const analytics = await graphEngine.analyzeGraph(dependencyGraph);
        return NextResponse.json({
          type: 'analytics',
          analytics,
          timestamp: new Date().toISOString(),
        });

      case 'centrality':
        const centralityMetrics = metricsEngine.calculateMetrics(dependencyGraph);
        const centralityRankings = {
          betweenness: metricsEngine.getTopNodesByMetric(centralityMetrics, 'betweennessCentrality', 10),
          closeness: metricsEngine.getTopNodesByMetric(centralityMetrics, 'closenessCentrality', 10),
          eigenvector: metricsEngine.getTopNodesByMetric(centralityMetrics, 'eigenvectorCentrality', 10),
          pageRank: metricsEngine.getTopNodesByMetric(centralityMetrics, 'pageRank', 10),
        };

        return NextResponse.json({
          type: 'centrality',
          rankings: centralityRankings,
          distributions: {
            betweenness: metricsEngine.getMetricDistribution(centralityMetrics, 'betweennessCentrality'),
            closeness: metricsEngine.getMetricDistribution(centralityMetrics, 'closenessCentrality'),
            eigenvector: metricsEngine.getMetricDistribution(centralityMetrics, 'eigenvectorCentrality'),
            pageRank: metricsEngine.getMetricDistribution(centralityMetrics, 'pageRank'),
          },
          timestamp: new Date().toISOString(),
        });

      case 'critical-path':
        const criticalPathAnalysis = await graphEngine.analyzeGraph(dependencyGraph);
        const criticalPaths = criticalPathAnalysis.criticalPaths;
        const criticalNodes = criticalPathAnalysis.mostCritical;
        
        return NextResponse.json({
          type: 'critical-path',
          criticalPaths,
          criticalNodes,
          pathAnalysis: criticalPaths.map(path => ({
            path,
            length: path.length,
            riskScore: this.calculatePathRisk(path, dependencyGraph),
            affectedSystems: this.getAffectedSystems(path, dependencyGraph),
          })),
          timestamp: new Date().toISOString(),
        });

      case 'dependency-depth':
        const depthAnalysis = this.analyzeDependencyDepth(dependencyGraph);
        return NextResponse.json({
          type: 'dependency-depth',
          analysis: depthAnalysis,
          timestamp: new Date().toISOString(),
        });

      case 'cluster':
        const clusterAnalysis = await graphEngine.analyzeGraph(dependencyGraph);
        const clusters = clusterAnalysis.clusters;
        
        return NextResponse.json({
          type: 'cluster',
          clusters,
          clusterMetrics: {
            totalClusters: clusters.length,
            avgClusterSize: clusters.length > 0 ? 
              clusters.reduce((sum, c) => sum + c.nodes.length, 0) / clusters.length : 0,
            largestCluster: Math.max(0, ...clusters.map(c => c.nodes.length)),
            smallestCluster: Math.min(Infinity, ...clusters.map(c => c.nodes.length)) || 0,
          },
          timestamp: new Date().toISOString(),
        });

      case 'full':
      default:
        const fullMetrics = metricsEngine.calculateMetrics(dependencyGraph);
        const fullAnalytics = await graphEngine.analyzeGraph(dependencyGraph);
        
        return NextResponse.json({
          type: 'full',
          metrics: fullMetrics,
          analytics: fullAnalytics,
          summary: {
            graphSize: {
              nodes: dependencyGraph.nodes.length,
              edges: dependencyGraph.edges.length,
              density: fullMetrics.globalMetrics.density,
            },
            connectivity: {
              components: fullMetrics.globalMetrics.components,
              stronglyConnectedComponents: fullMetrics.globalMetrics.stronglyConnectedComponents,
              averagePathLength: fullMetrics.globalMetrics.averagePathLength,
              diameter: fullMetrics.globalMetrics.diameter,
            },
            health: {
              orphanNodes: fullAnalytics.orphanNodes.length,
              circularDependencies: fullAnalytics.circularDependencies.length,
              criticalPaths: fullAnalytics.criticalPaths.length,
            },
            centrality: {
              mostConnected: fullAnalytics.mostConnected.slice(0, 3),
              mostCritical: fullAnalytics.mostCritical.slice(0, 3),
              mostUnstable: fullAnalytics.mostUnstable.slice(0, 3),
            },
          },
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error(`Error performing ${analysisType} analysis:`, error);
    return NextResponse.json(
      { error: `Failed to perform ${analysisType} analysis` },
      { status: 500 }
    );
  }
}

// Helper method to calculate path risk
function calculatePathRisk(path: string[], graph: DependencyGraph): number {
  let riskScore = 0;
  
  path.forEach(nodeId => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      // Higher risk for unhealthy nodes
      riskScore += (100 - node.health) * 0.1;
      
      // Higher risk for critical nodes
      if (node.isOnCriticalPath) {
        riskScore += 10;
      }
      
      // Higher risk for complex nodes
      riskScore += node.complexityScore * 0.05;
    }
  });
  
  // Longer paths are riskier
  riskScore += path.length * 2;
  
  return Math.min(100, riskScore);
}

// Helper method to get affected systems
function getAffectedSystems(path: string[], graph: DependencyGraph): string[] {
  const systems = new Set<string>();
  
  path.forEach(nodeId => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node && node.entity.spec?.system) {
      systems.add(node.entity.spec.system);
    }
  });
  
  return Array.from(systems);
}

// Helper method to analyze dependency depth
function analyzeDependencyDepth(graph: DependencyGraph): any {
  const depthMap = new Map<string, number>();
  const visited = new Set<string>();
  
  // Calculate depth for each node using DFS
  const calculateDepth = (nodeId: string, currentDepth = 0): number => {
    if (visited.has(nodeId)) {
      return depthMap.get(nodeId) || 0;
    }
    
    visited.add(nodeId);
    const node = graph.nodes.find(n => n.id === nodeId);
    
    if (!node || node.dependencies.length === 0) {
      depthMap.set(nodeId, currentDepth);
      return currentDepth;
    }
    
    const maxChildDepth = Math.max(
      ...node.dependencies.map(depId => calculateDepth(depId, currentDepth + 1))
    );
    
    depthMap.set(nodeId, maxChildDepth);
    return maxChildDepth;
  };
  
  // Calculate depths for all nodes
  graph.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      calculateDepth(node.id);
    }
  });
  
  // Analyze depth distribution
  const depths = Array.from(depthMap.values());
  const maxDepth = Math.max(...depths);
  const avgDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length;
  
  // Group nodes by depth
  const nodesByDepth = new Map<number, string[]>();
  depthMap.forEach((depth, nodeId) => {
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth)!.push(nodeId);
  });
  
  return {
    maxDepth,
    avgDepth,
    depthDistribution: Object.fromEntries(nodesByDepth),
    deepestNodes: Array.from(depthMap.entries())
      .filter(([_, depth]) => depth === maxDepth)
      .map(([nodeId]) => nodeId),
    shallowNodes: Array.from(depthMap.entries())
      .filter(([_, depth]) => depth === 0)
      .map(([nodeId]) => nodeId),
  };
}