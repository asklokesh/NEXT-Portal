import type { DependencyGraph, GraphExportOptions, GraphAnalytics } from './types';

export interface ExportResult {
  data: string | Blob;
  filename: string;
  mimeType: string;
  size: number;
}

export class GraphExportEngine {
  /**
   * Export graph in specified format
   */
  async exportGraph(
    graph: DependencyGraph, 
    options: GraphExportOptions,
    canvas?: HTMLCanvasElement,
    analytics?: GraphAnalytics
  ): Promise<ExportResult> {
    switch (options.format) {
      case 'png':
        return this.exportAsPNG(graph, options, canvas);
      case 'svg':
        return this.exportAsSVG(graph, options);
      case 'json':
        return this.exportAsJSON(graph, options, analytics);
      case 'csv':
        return this.exportAsCSV(graph, options);
      case 'graphml':
        return this.exportAsGraphML(graph, options);
      case 'gexf':
        return this.exportAsGEXF(graph, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export as PNG image
   */
  private async exportAsPNG(
    graph: DependencyGraph,
    options: GraphExportOptions,
    canvas?: HTMLCanvasElement
  ): Promise<ExportResult> {
    if (!canvas) {
      throw new Error('Canvas element required for PNG export');
    }

    const { width = 1920, height = 1080 } = options.resolution || {};
    const quality = options.quality || 'high';
    
    // Create a new canvas with desired resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d')!;

    // Scale the original canvas to fit the export resolution
    ctx.drawImage(canvas, 0, 0, width, height);

    // Add metadata overlay if requested
    if (options.includeMetadata) {
      await this.addMetadataOverlay(ctx, graph, width, height);
    }

    return new Promise((resolve) => {
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error('Failed to create PNG blob');
          }
          
          resolve({
            data: blob,
            filename: `dependency-graph-${new Date().toISOString().split('T')[0]}.png`,
            mimeType: 'image/png',
            size: blob.size,
          });
        },
        'image/png',
        quality === 'high' ? 1.0 : quality === 'medium' ? 0.8 : 0.6
      );
    });
  }

  /**
   * Export as SVG
   */
  private async exportAsSVG(
    graph: DependencyGraph,
    options: GraphExportOptions
  ): Promise<ExportResult> {
    const { width = 1200, height = 800 } = options.resolution || {};
    
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .node-label { font-family: Arial, sans-serif; font-size: 12px; text-anchor: middle; }
      .edge-label { font-family: Arial, sans-serif; font-size: 10px; text-anchor: middle; }
      .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; }
      .metadata { font-family: Arial, sans-serif; font-size: 10px; }
    </style>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>`;

    // Add title if metadata is included
    if (options.includeMetadata) {
      svg += `
  <text x="${width / 2}" y="30" class="title" text-anchor="middle">
    Dependency Graph - ${graph.metadata.totalNodes} nodes, ${graph.metadata.totalEdges} edges
  </text>`;
    }

    // Draw edges
    svg += '\n  <!-- Edges -->';
    graph.edges.forEach(edge => {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode && sourceNode.x !== undefined && sourceNode.y !== undefined && 
          targetNode.x !== undefined && targetNode.y !== undefined) {
        const strokeWidth = edge.width || 2;
        const strokeColor = edge.color || '#94A3B8';
        
        svg += `
  <line x1="${sourceNode.x}" y1="${sourceNode.y}" x2="${targetNode.x}" y2="${targetNode.y}" 
        stroke="${strokeColor}" stroke-width="${strokeWidth}" marker-end="url(#arrowhead)" opacity="0.7"/>`;
        
        if (edge.label && options.includeMetadata) {
          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;
          svg += `
  <text x="${midX}" y="${midY}" class="edge-label" fill="#666">${edge.label}</text>`;
        }
      }
    });

    // Draw nodes
    svg += '\n  <!-- Nodes -->';
    graph.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const radius = node.size / 2 || 10;
        const color = node.color || '#3B82F6';
        
        // Node circle
        svg += `
  <circle cx="${node.x}" cy="${node.y}" r="${radius}" fill="${color}" 
          stroke="#ffffff" stroke-width="2" opacity="0.9"/>`;
        
        // Node label
        svg += `
  <text x="${node.x}" y="${node.y + radius + 15}" class="node-label">${node.name}</text>`;
        
        // Additional metadata if requested
        if (options.includeMetadata) {
          svg += `
  <text x="${node.x}" y="${node.y + radius + 28}" class="metadata" fill="#666">
    ${node.type} | Health: ${Math.round(node.health)}%
  </text>`;
        }
      }
    });

    // Add metadata panel if requested
    if (options.includeMetadata) {
      svg += this.createSVGMetadataPanel(graph, width, height);
    }

    svg += '\n</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    
    return {
      data: blob,
      filename: `dependency-graph-${new Date().toISOString().split('T')[0]}.svg`,
      mimeType: 'image/svg+xml',
      size: blob.size,
    };
  }

  /**
   * Export as JSON
   */
  private async exportAsJSON(
    graph: DependencyGraph,
    options: GraphExportOptions,
    analytics?: GraphAnalytics
  ): Promise<ExportResult> {
    let exportData: any = {
      graph: {
        nodes: graph.nodes.map(node => ({
          id: node.id,
          name: node.name,
          type: node.type,
          owner: node.owner,
          lifecycle: node.lifecycle,
          health: node.health,
          dependencies: node.dependencies,
          dependents: node.dependents,
          ...(options.includeMetadata && {
            description: node.description,
            tags: node.tags,
            impactScore: node.impactScore,
            criticalityScore: node.criticalityScore,
            complexityScore: node.complexityScore,
            stabilityScore: node.stabilityScore,
            isOnCriticalPath: node.isOnCriticalPath,
            position: node.x !== undefined && node.y !== undefined ? { x: node.x, y: node.y } : undefined,
          }),
        })),
        edges: graph.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          strength: edge.strength,
          ...(options.includeMetadata && {
            healthScore: edge.healthScore,
            latency: edge.latency,
            errorRate: edge.errorRate,
            throughput: edge.throughput,
            animated: edge.animated,
            bidirectional: edge.bidirectional,
          }),
        })),
      },
      metadata: {
        ...graph.metadata,
        exportedAt: new Date().toISOString(),
        exportOptions: options,
      },
    };

    if (options.includeMetadata && analytics) {
      exportData.analytics = {
        totalNodes: analytics.totalNodes,
        totalEdges: analytics.totalEdges,
        density: analytics.density,
        avgDegree: analytics.avgDegree,
        orphanNodes: analytics.orphanNodes,
        circularDependencies: analytics.circularDependencies,
        criticalPaths: analytics.criticalPaths,
        clusters: analytics.clusters,
        overallHealth: analytics.overallHealth,
        healthByTeam: analytics.healthByTeam,
        healthBySystem: analytics.healthBySystem,
        riskFactors: analytics.riskFactors,
        mostConnected: analytics.mostConnected,
        mostCritical: analytics.mostCritical,
        mostUnstable: analytics.mostUnstable,
      };
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    return {
      data: blob,
      filename: `dependency-graph-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
      size: blob.size,
    };
  }

  /**
   * Export as CSV (nodes and edges in separate sections)
   */
  private async exportAsCSV(
    graph: DependencyGraph,
    options: GraphExportOptions
  ): Promise<ExportResult> {
    let csv = '';

    // Nodes section
    csv += 'NODES\n';
    csv += 'ID,Name,Type,Owner,Lifecycle,Health,Dependencies Count,Dependents Count';
    
    if (options.includeMetadata) {
      csv += ',Description,Tags,Impact Score,Criticality Score,Complexity Score,Stability Score,Critical Path,Position X,Position Y';
    }
    csv += '\n';

    graph.nodes.forEach(node => {
      const basicInfo = [
        this.escapeCSV(node.id),
        this.escapeCSV(node.name),
        this.escapeCSV(node.type),
        this.escapeCSV(node.owner),
        this.escapeCSV(node.lifecycle),
        node.health.toFixed(1),
        node.dependencies.length,
        node.dependents.length,
      ];

      let row = basicInfo.join(',');

      if (options.includeMetadata) {
        const metadataInfo = [
          this.escapeCSV(node.description || ''),
          this.escapeCSV(node.tags.join('; ')),
          node.impactScore.toFixed(1),
          node.criticalityScore.toFixed(1),
          node.complexityScore.toFixed(1),
          node.stabilityScore.toFixed(1),
          node.isOnCriticalPath ? 'Yes' : 'No',
          node.x?.toFixed(1) || '',
          node.y?.toFixed(1) || '',
        ];
        row += ',' + metadataInfo.join(',');
      }

      csv += row + '\n';
    });

    // Edges section
    csv += '\nEDGES\n';
    csv += 'ID,Source,Target,Type,Strength';
    
    if (options.includeMetadata) {
      csv += ',Health Score,Latency,Error Rate,Throughput,Animated,Bidirectional';
    }
    csv += '\n';

    graph.edges.forEach(edge => {
      const basicInfo = [
        this.escapeCSV(edge.id),
        this.escapeCSV(edge.source),
        this.escapeCSV(edge.target),
        this.escapeCSV(edge.type),
        edge.strength.toFixed(2),
      ];

      let row = basicInfo.join(',');

      if (options.includeMetadata) {
        const metadataInfo = [
          edge.healthScore.toFixed(1),
          edge.latency?.toFixed(1) || '',
          edge.errorRate?.toFixed(3) || '',
          edge.throughput?.toFixed(1) || '',
          edge.animated ? 'Yes' : 'No',
          edge.bidirectional ? 'Yes' : 'No',
        ];
        row += ',' + metadataInfo.join(',');
      }

      csv += row + '\n';
    });

    // Metadata section
    if (options.includeMetadata) {
      csv += '\nMETADATA\n';
      csv += 'Property,Value\n';
      csv += `Total Nodes,${graph.metadata.totalNodes}\n`;
      csv += `Total Edges,${graph.metadata.totalEdges}\n`;
      csv += `Generated At,${graph.metadata.generatedAt.toISOString()}\n`;
      csv += `Version,${graph.metadata.version}\n`;
      csv += `Source,${graph.metadata.source}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });

    return {
      data: blob,
      filename: `dependency-graph-${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv',
      size: blob.size,
    };
  }

  /**
   * Export as GraphML (XML format for graph data)
   */
  private async exportAsGraphML(
    graph: DependencyGraph,
    options: GraphExportOptions
  ): Promise<ExportResult> {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">`;

    // Define attributes
    xml += `
  <!-- Node attributes -->
  <key id="n_name" for="node" attr.name="name" attr.type="string"/>
  <key id="n_type" for="node" attr.name="type" attr.type="string"/>
  <key id="n_owner" for="node" attr.name="owner" attr.type="string"/>
  <key id="n_lifecycle" for="node" attr.name="lifecycle" attr.type="string"/>
  <key id="n_health" for="node" attr.name="health" attr.type="double"/>`;

    if (options.includeMetadata) {
      xml += `
  <key id="n_impact" for="node" attr.name="impact_score" attr.type="double"/>
  <key id="n_criticality" for="node" attr.name="criticality_score" attr.type="double"/>
  <key id="n_complexity" for="node" attr.name="complexity_score" attr.type="double"/>
  <key id="n_stability" for="node" attr.name="stability_score" attr.type="double"/>
  <key id="n_critical_path" for="node" attr.name="critical_path" attr.type="boolean"/>
  <key id="n_x" for="node" attr.name="x" attr.type="double"/>
  <key id="n_y" for="node" attr.name="y" attr.type="double"/>`;
    }

    xml += `
  <!-- Edge attributes -->
  <key id="e_type" for="edge" attr.name="type" attr.type="string"/>
  <key id="e_strength" for="edge" attr.name="strength" attr.type="double"/>`;

    if (options.includeMetadata) {
      xml += `
  <key id="e_health" for="edge" attr.name="health_score" attr.type="double"/>
  <key id="e_latency" for="edge" attr.name="latency" attr.type="double"/>
  <key id="e_error_rate" for="edge" attr.name="error_rate" attr.type="double"/>`;
    }

    xml += `
  <graph id="dependency_graph" edgedefault="directed">`;

    // Add nodes
    graph.nodes.forEach(node => {
      xml += `
    <node id="${this.escapeXML(node.id)}">
      <data key="n_name">${this.escapeXML(node.name)}</data>
      <data key="n_type">${this.escapeXML(node.type)}</data>
      <data key="n_owner">${this.escapeXML(node.owner)}</data>
      <data key="n_lifecycle">${this.escapeXML(node.lifecycle)}</data>
      <data key="n_health">${node.health}</data>`;

      if (options.includeMetadata) {
        xml += `
      <data key="n_impact">${node.impactScore}</data>
      <data key="n_criticality">${node.criticalityScore}</data>
      <data key="n_complexity">${node.complexityScore}</data>
      <data key="n_stability">${node.stabilityScore}</data>
      <data key="n_critical_path">${node.isOnCriticalPath}</data>`;
        
        if (node.x !== undefined && node.y !== undefined) {
          xml += `
      <data key="n_x">${node.x}</data>
      <data key="n_y">${node.y}</data>`;
        }
      }

      xml += `
    </node>`;
    });

    // Add edges
    graph.edges.forEach(edge => {
      xml += `
    <edge source="${this.escapeXML(edge.source)}" target="${this.escapeXML(edge.target)}">
      <data key="e_type">${this.escapeXML(edge.type)}</data>
      <data key="e_strength">${edge.strength}</data>`;

      if (options.includeMetadata) {
        xml += `
      <data key="e_health">${edge.healthScore}</data>`;
        if (edge.latency !== undefined) {
          xml += `
      <data key="e_latency">${edge.latency}</data>`;
        }
        if (edge.errorRate !== undefined) {
          xml += `
      <data key="e_error_rate">${edge.errorRate}</data>`;
        }
      }

      xml += `
    </edge>`;
    });

    xml += `
  </graph>
</graphml>`;

    const blob = new Blob([xml], { type: 'application/xml' });

    return {
      data: blob,
      filename: `dependency-graph-${new Date().toISOString().split('T')[0]}.graphml`,
      mimeType: 'application/xml',
      size: blob.size,
    };
  }

  /**
   * Export as GEXF (Graph Exchange XML Format)
   */
  private async exportAsGEXF(
    graph: DependencyGraph,
    options: GraphExportOptions
  ): Promise<ExportResult> {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <meta lastmodifieddate="${new Date().toISOString()}">
    <creator>Backstage Catalog Graph</creator>
    <description>Service dependency graph exported from Backstage catalog</description>
  </meta>
  <graph mode="static" defaultedgetype="directed">`;

    // Define attributes
    xml += `
    <attributes class="node">
      <attribute id="0" title="type" type="string"/>
      <attribute id="1" title="owner" type="string"/>
      <attribute id="2" title="lifecycle" type="string"/>
      <attribute id="3" title="health" type="double"/>`;

    if (options.includeMetadata) {
      xml += `
      <attribute id="4" title="impact_score" type="double"/>
      <attribute id="5" title="criticality_score" type="double"/>
      <attribute id="6" title="critical_path" type="boolean"/>`;
    }

    xml += `
    </attributes>
    <attributes class="edge">
      <attribute id="0" title="type" type="string"/>
      <attribute id="1" title="strength" type="double"/>`;

    if (options.includeMetadata) {
      xml += `
      <attribute id="2" title="health_score" type="double"/>`;
    }

    xml += `
    </attributes>`;

    // Add nodes
    xml += `
    <nodes>`;

    graph.nodes.forEach(node => {
      xml += `
      <node id="${this.escapeXML(node.id)}" label="${this.escapeXML(node.name)}">`;

      if (node.x !== undefined && node.y !== undefined && options.includeMetadata) {
        xml += `
        <viz:position x="${node.x}" y="${node.y}" z="0.0" xmlns:viz="http://www.gexf.net/1.1draft/viz"/>`;
      }

      const size = node.size || 20;
      const color = this.hexToRgb(node.color) || { r: 59, g: 130, b: 246 };
      
      xml += `
        <viz:size value="${size}" xmlns:viz="http://www.gexf.net/1.1draft/viz"/>
        <viz:color r="${color.r}" g="${color.g}" b="${color.b}" xmlns:viz="http://www.gexf.net/1.1draft/viz"/>
        <attvalues>
          <attvalue for="0" value="${this.escapeXML(node.type)}"/>
          <attvalue for="1" value="${this.escapeXML(node.owner)}"/>
          <attvalue for="2" value="${this.escapeXML(node.lifecycle)}"/>
          <attvalue for="3" value="${node.health}"/>`;

      if (options.includeMetadata) {
        xml += `
          <attvalue for="4" value="${node.impactScore}"/>
          <attvalue for="5" value="${node.criticalityScore}"/>
          <attvalue for="6" value="${node.isOnCriticalPath}"/>`;
      }

      xml += `
        </attvalues>
      </node>`;
    });

    xml += `
    </nodes>`;

    // Add edges
    xml += `
    <edges>`;

    graph.edges.forEach((edge, index) => {
      xml += `
      <edge id="${index}" source="${this.escapeXML(edge.source)}" target="${this.escapeXML(edge.target)}">
        <attvalues>
          <attvalue for="0" value="${this.escapeXML(edge.type)}"/>
          <attvalue for="1" value="${edge.strength}"/>`;

      if (options.includeMetadata) {
        xml += `
          <attvalue for="2" value="${edge.healthScore}"/>`;
      }

      xml += `
        </attvalues>
      </edge>`;
    });

    xml += `
    </edges>
  </graph>
</gexf>`;

    const blob = new Blob([xml], { type: 'application/xml' });

    return {
      data: blob,
      filename: `dependency-graph-${new Date().toISOString().split('T')[0]}.gexf`,
      mimeType: 'application/xml',
      size: blob.size,
    };
  }

  /**
   * Add metadata overlay to canvas
   */
  private async addMetadataOverlay(
    ctx: CanvasRenderingContext2D,
    graph: DependencyGraph,
    width: number,
    height: number
  ): Promise<void> {
    // Semi-transparent background for metadata
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 300, 120);

    // White text for metadata
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText('Dependency Graph', 20, 35);

    ctx.font = '12px Arial';
    ctx.fillText(`Nodes: ${graph.metadata.totalNodes}`, 20, 55);
    ctx.fillText(`Edges: ${graph.metadata.totalEdges}`, 20, 75);
    ctx.fillText(`Generated: ${graph.metadata.generatedAt.toLocaleDateString()}`, 20, 95);
    ctx.fillText(`Source: ${graph.metadata.source}`, 20, 115);
  }

  /**
   * Create SVG metadata panel
   */
  private createSVGMetadataPanel(graph: DependencyGraph, width: number, height: number): string {
    return `
  <!-- Metadata Panel -->
  <rect x="10" y="10" width="280" height="110" fill="rgba(0,0,0,0.8)" stroke="#ccc" stroke-width="1"/>
  <text x="20" y="30" class="title" fill="white">Graph Metadata</text>
  <text x="20" y="50" class="metadata" fill="white">Nodes: ${graph.metadata.totalNodes}</text>
  <text x="20" y="65" class="metadata" fill="white">Edges: ${graph.metadata.totalEdges}</text>
  <text x="20" y="80" class="metadata" fill="white">Generated: ${graph.metadata.generatedAt.toLocaleDateString()}</text>
  <text x="20" y="95" class="metadata" fill="white">Source: ${graph.metadata.source}</text>
  <text x="20" y="110" class="metadata" fill="white">Version: ${graph.metadata.version}</text>`;
  }

  /**
   * Helper methods for data formatting
   */
  private escapeCSV(str: string): string {
    if (typeof str !== 'string') return '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private escapeXML(str: string): string {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Batch export multiple formats
   */
  async batchExport(
    graph: DependencyGraph,
    formats: GraphExportOptions['format'][],
    baseOptions: Omit<GraphExportOptions, 'format'>,
    canvas?: HTMLCanvasElement,
    analytics?: GraphAnalytics
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const format of formats) {
      try {
        const options: GraphExportOptions = { ...baseOptions, format };
        const result = await this.exportGraph(graph, options, canvas, analytics);
        results.push(result);
      } catch (error) {
        console.error(`Failed to export ${format}:`, error);
        // Continue with other formats
      }
    }

    return results;
  }

  /**
   * Download export result
   */
  downloadExportResult(result: ExportResult): void {
    const url = result.data instanceof Blob 
      ? URL.createObjectURL(result.data)
      : `data:${result.mimeType};charset=utf-8,${encodeURIComponent(result.data as string)}`;

    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (result.data instanceof Blob) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Get available export formats with descriptions
   */
  getAvailableFormats(): Array<{
    format: GraphExportOptions['format'];
    name: string;
    description: string;
    supportsMetadata: boolean;
    requiresCanvas: boolean;
  }> {
    return [
      {
        format: 'png',
        name: 'PNG Image',
        description: 'High-quality raster image suitable for presentations',
        supportsMetadata: true,
        requiresCanvas: true,
      },
      {
        format: 'svg',
        name: 'SVG Vector',
        description: 'Scalable vector graphics with interactive elements',
        supportsMetadata: true,
        requiresCanvas: false,
      },
      {
        format: 'json',
        name: 'JSON Data',
        description: 'Complete graph data including all metadata and analytics',
        supportsMetadata: true,
        requiresCanvas: false,
      },
      {
        format: 'csv',
        name: 'CSV Spreadsheet',
        description: 'Tabular data format for analysis in spreadsheet applications',
        supportsMetadata: true,
        requiresCanvas: false,
      },
      {
        format: 'graphml',
        name: 'GraphML',
        description: 'Standard XML format for graph data exchange',
        supportsMetadata: true,
        requiresCanvas: false,
      },
      {
        format: 'gexf',
        name: 'GEXF',
        description: 'Graph Exchange XML Format for Gephi and other graph tools',
        supportsMetadata: true,
        requiresCanvas: false,
      },
    ];
  }
}