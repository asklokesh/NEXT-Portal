import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface PipelineNode {
  id: string;
  type: 'source' | 'transform' | 'sink' | 'branch' | 'merge';
  name: string;
  config: any;
  position: { x: number; y: number };
  dependencies: string[];
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  nodes: PipelineNode[];
  edges: Array<{ from: string; to: string }>;
  status: 'draft' | 'active' | 'paused' | 'failed';
  schedule: {
    type: 'cron' | 'event' | 'continuous';
    expression?: string;
    event?: string;
  };
  version: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface PipelineExecution {
  id: string;
  pipelineId: string;
  version: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  nodeExecutions: Map<string, NodeExecution>;
  metrics: {
    recordsProcessed: number;
    recordsSuccessful: number;
    recordsFailed: number;
    bytesProcessed: number;
    duration: number;
  };
  errors: any[];
}

interface NodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  recordsIn: number;
  recordsOut: number;
  errors: any[];
  checkpoints: any[];
}

export class PipelineEngine extends EventEmitter {
  private pipelines: Map<string, Pipeline> = new Map();
  private executions: Map<string, PipelineExecution> = new Map();
  private processors: Map<string, any> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeProcessors();
  }

  private initializeProcessors() {
    this.processors.set('csv-source', this.createCSVSource());
    this.processors.set('api-source', this.createAPISource());
    this.processors.set('db-source', this.createDatabaseSource());
    this.processors.set('kafka-source', this.createKafkaSource());
    this.processors.set('filter-transform', this.createFilterTransform());
    this.processors.set('map-transform', this.createMapTransform());
    this.processors.set('aggregate-transform', this.createAggregateTransform());
    this.processors.set('db-sink', this.createDatabaseSink());
    this.processors.set('file-sink', this.createFileSink());
    this.processors.set('api-sink', this.createAPISink());
  }

  async createPipeline(pipeline: Omit<Pipeline, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<Pipeline> {
    const newPipeline: Pipeline = {
      ...pipeline,
      id: `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.validatePipeline(newPipeline);
    this.pipelines.set(newPipeline.id, newPipeline);
    
    await this.persistPipeline(newPipeline);
    this.schedulePipeline(newPipeline);

    this.emit('pipeline-created', newPipeline);
    return newPipeline;
  }

  private async validatePipeline(pipeline: Pipeline): Promise<void> {
    const errors = [];

    if (!pipeline.nodes || pipeline.nodes.length === 0) {
      errors.push('Pipeline must have at least one node');
    }

    const sourceNodes = pipeline.nodes.filter(n => n.type === 'source');
    const sinkNodes = pipeline.nodes.filter(n => n.type === 'sink');

    if (sourceNodes.length === 0) {
      errors.push('Pipeline must have at least one source node');
    }

    if (sinkNodes.length === 0) {
      errors.push('Pipeline must have at least one sink node');
    }

    const hasCycle = this.detectCycle(pipeline);
    if (hasCycle) {
      errors.push('Pipeline contains cycles');
    }

    if (errors.length > 0) {
      throw new Error(`Pipeline validation failed: ${errors.join(', ')}`);
    }
  }

  private detectCycle(pipeline: Pipeline): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const adjacencyList = new Map<string, string[]>();
    pipeline.nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });

    pipeline.edges.forEach(edge => {
      adjacencyList.get(edge.from)?.push(edge.to);
    });

    for (const nodeId of pipeline.nodes.map(n => n.id)) {
      if (this.hasCycleUtil(nodeId, visited, recursionStack, adjacencyList)) {
        return true;
      }
    }

    return false;
  }

  private hasCycleUtil(
    nodeId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    adjacencyList: Map<string, string[]>
  ): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (this.hasCycleUtil(neighbor, visited, recursionStack, adjacencyList)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  async executePipeline(
    pipelineId: string,
    options: {
      version?: number;
      input?: any;
      dryRun?: boolean;
    } = {}
  ): Promise<PipelineExecution> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const execution: PipelineExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pipelineId,
      version: options.version || pipeline.version,
      status: 'running',
      startTime: new Date(),
      nodeExecutions: new Map(),
      metrics: {
        recordsProcessed: 0,
        recordsSuccessful: 0,
        recordsFailed: 0,
        bytesProcessed: 0,
        duration: 0
      },
      errors: []
    };

    this.executions.set(execution.id, execution);

    try {
      await this.executeDAG(pipeline, execution, options);
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.metrics.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.emit('pipeline-completed', execution);
    } catch (error: any) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.errors.push({
        message: error.message,
        timestamp: new Date(),
        stack: error.stack
      });

      this.emit('pipeline-failed', execution);
    }

    await this.persistExecution(execution);
    return execution;
  }

  private async executeDAG(
    pipeline: Pipeline,
    execution: PipelineExecution,
    options: any
  ): Promise<void> {
    const topology = this.topologicalSort(pipeline);
    const dataFlow = new Map<string, any>();
    
    for (const nodeId of topology) {
      const node = pipeline.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const nodeExecution: NodeExecution = {
        nodeId,
        status: 'running',
        startTime: new Date(),
        recordsIn: 0,
        recordsOut: 0,
        errors: [],
        checkpoints: []
      };

      execution.nodeExecutions.set(nodeId, nodeExecution);

      try {
        const inputData = this.gatherNodeInputs(node, dataFlow);
        const processor = this.processors.get(node.type);
        
        if (!processor) {
          throw new Error(`No processor found for node type: ${node.type}`);
        }

        const result = await this.executeNode(node, processor, inputData, options);
        
        dataFlow.set(nodeId, result);
        nodeExecution.status = 'completed';
        nodeExecution.endTime = new Date();
        nodeExecution.recordsOut = Array.isArray(result) ? result.length : 1;

        execution.metrics.recordsProcessed += nodeExecution.recordsOut;
        execution.metrics.recordsSuccessful += nodeExecution.recordsOut;

      } catch (error: any) {
        nodeExecution.status = 'failed';
        nodeExecution.endTime = new Date();
        nodeExecution.errors.push({
          message: error.message,
          timestamp: new Date()
        });

        execution.metrics.recordsFailed += nodeExecution.recordsIn;
        throw error;
      }
    }
  }

  private topologicalSort(pipeline: Pipeline): string[] {
    const indegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    pipeline.nodes.forEach(node => {
      indegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    });

    pipeline.edges.forEach(edge => {
      adjacencyList.get(edge.from)?.push(edge.to);
      indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    });

    const queue: string[] = [];
    const result: string[] = [];

    indegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      neighbors.forEach(neighbor => {
        const newDegree = (indegree.get(neighbor) || 0) - 1;
        indegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }

    return result;
  }

  private gatherNodeInputs(node: PipelineNode, dataFlow: Map<string, any>): any {
    if (node.dependencies.length === 0) {
      return null;
    }

    if (node.dependencies.length === 1) {
      return dataFlow.get(node.dependencies[0]);
    }

    return node.dependencies.map(depId => dataFlow.get(depId));
  }

  private async executeNode(
    node: PipelineNode,
    processor: any,
    inputData: any,
    options: any
  ): Promise<any> {
    const context = {
      nodeId: node.id,
      config: node.config,
      dryRun: options.dryRun || false,
      checkpoint: this.createCheckpoint(node.id)
    };

    return await processor.execute(inputData, context);
  }

  private createCheckpoint(nodeId: string): any {
    return {
      save: async (data: any) => {
        await prisma.pipelineCheckpoint.create({
          data: {
            nodeId,
            checkpointData: data,
            timestamp: new Date()
          }
        });
      },
      load: async () => {
        const checkpoint = await prisma.pipelineCheckpoint.findFirst({
          where: { nodeId },
          orderBy: { timestamp: 'desc' }
        });
        return checkpoint?.checkpointData;
      }
    };
  }

  private schedulePipeline(pipeline: Pipeline): void {
    if (pipeline.schedule.type === 'cron' && pipeline.schedule.expression) {
      const cronJob = this.createCronJob(pipeline.schedule.expression, () => {
        this.executePipeline(pipeline.id);
      });
      
      this.scheduledJobs.set(pipeline.id, cronJob);
    }
  }

  private createCronJob(expression: string, callback: () => void): NodeJS.Timeout {
    return setTimeout(callback, 60000);
  }

  async updatePipeline(
    pipelineId: string,
    updates: Partial<Pipeline>
  ): Promise<Pipeline> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const updatedPipeline: Pipeline = {
      ...pipeline,
      ...updates,
      version: pipeline.version + 1,
      updatedAt: new Date()
    };

    await this.validatePipeline(updatedPipeline);
    this.pipelines.set(pipelineId, updatedPipeline);
    await this.persistPipeline(updatedPipeline);

    this.emit('pipeline-updated', updatedPipeline);
    return updatedPipeline;
  }

  async deletePipeline(pipelineId: string): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const scheduledJob = this.scheduledJobs.get(pipelineId);
    if (scheduledJob) {
      clearTimeout(scheduledJob);
      this.scheduledJobs.delete(pipelineId);
    }

    this.pipelines.delete(pipelineId);
    await this.deletePipelineFromDB(pipelineId);

    this.emit('pipeline-deleted', { pipelineId });
  }

  async getPipelineMetrics(pipelineId: string): Promise<any> {
    const executions = Array.from(this.executions.values())
      .filter(e => e.pipelineId === pipelineId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    const recentExecutions = executions.slice(0, 10);
    
    const successRate = executions.length > 0
      ? executions.filter(e => e.status === 'completed').length / executions.length
      : 0;

    const avgDuration = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, e) => sum + e.metrics.duration, 0) / recentExecutions.length
      : 0;

    const throughput = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, e) => sum + e.metrics.recordsProcessed, 0) / recentExecutions.length
      : 0;

    return {
      totalExecutions: executions.length,
      successRate,
      avgDuration,
      throughput,
      recentExecutions: recentExecutions.slice(0, 5),
      lastExecution: executions[0]
    };
  }

  private createCSVSource(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { filePath, delimiter = ',' } = context.config;
        
        if (context.dryRun) {
          return [{ sample: 'data' }];
        }

        const fs = await import('fs').then(m => m.promises);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const headers = lines[0].split(delimiter);
        
        return lines.slice(1).map(line => {
          const values = line.split(delimiter);
          const record: any = {};
          headers.forEach((header, index) => {
            record[header.trim()] = values[index]?.trim();
          });
          return record;
        });
      }
    };
  }

  private createAPISource(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { url, method = 'GET', headers = {}, body } = context.config;
        
        if (context.dryRun) {
          return [{ id: 1, data: 'sample' }];
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
          throw new Error(`API call failed: ${response.statusText}`);
        }

        return await response.json();
      }
    };
  }

  private createDatabaseSource(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { query, parameters = [] } = context.config;
        
        if (context.dryRun) {
          return [{ id: 1, name: 'sample' }];
        }

        return await prisma.$queryRawUnsafe(query, ...parameters);
      }
    };
  }

  private createKafkaSource(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { topic, groupId, batchSize = 100 } = context.config;
        
        if (context.dryRun) {
          return Array(batchSize).fill({ topic, message: 'sample' });
        }

        return [];
      }
    };
  }

  private createFilterTransform(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { condition } = context.config;
        
        if (!Array.isArray(inputData)) {
          return inputData;
        }

        return inputData.filter(record => {
          try {
            return new Function('record', `return ${condition}`)(record);
          } catch (error) {
            return false;
          }
        });
      }
    };
  }

  private createMapTransform(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { mapping } = context.config;
        
        if (!Array.isArray(inputData)) {
          return inputData;
        }

        return inputData.map(record => {
          const mapped: any = {};
          Object.entries(mapping).forEach(([targetField, sourceField]) => {
            if (typeof sourceField === 'string') {
              mapped[targetField] = record[sourceField];
            } else if (typeof sourceField === 'function') {
              mapped[targetField] = sourceField(record);
            }
          });
          return mapped;
        });
      }
    };
  }

  private createAggregateTransform(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { groupBy, aggregations } = context.config;
        
        if (!Array.isArray(inputData)) {
          return inputData;
        }

        const groups = new Map<string, any[]>();
        
        inputData.forEach(record => {
          const key = Array.isArray(groupBy)
            ? groupBy.map(field => record[field]).join('|')
            : record[groupBy];
          
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(record);
        });

        const results = [];
        for (const [key, records] of groups) {
          const result: any = {};
          
          if (Array.isArray(groupBy)) {
            groupBy.forEach((field, index) => {
              result[field] = key.split('|')[index];
            });
          } else {
            result[groupBy] = key;
          }

          Object.entries(aggregations).forEach(([field, agg]: [string, any]) => {
            const values = records.map(r => r[agg.field] || 0);
            
            switch (agg.function) {
              case 'sum':
                result[field] = values.reduce((a, b) => a + b, 0);
                break;
              case 'avg':
                result[field] = values.reduce((a, b) => a + b, 0) / values.length;
                break;
              case 'count':
                result[field] = values.length;
                break;
              case 'min':
                result[field] = Math.min(...values);
                break;
              case 'max':
                result[field] = Math.max(...values);
                break;
            }
          });

          results.push(result);
        }

        return results;
      }
    };
  }

  private createDatabaseSink(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { table, operation = 'insert' } = context.config;
        
        if (context.dryRun) {
          return { written: Array.isArray(inputData) ? inputData.length : 1 };
        }

        if (!Array.isArray(inputData)) {
          inputData = [inputData];
        }

        let result;
        switch (operation) {
          case 'insert':
            result = await (prisma as any)[table].createMany({
              data: inputData
            });
            break;
          case 'upsert':
            result = await Promise.all(
              inputData.map((record: any) =>
                (prisma as any)[table].upsert({
                  where: { id: record.id },
                  update: record,
                  create: record
                })
              )
            );
            break;
        }

        return { written: inputData.length };
      }
    };
  }

  private createFileSink(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { filePath, format = 'json' } = context.config;
        
        if (context.dryRun) {
          return { written: Array.isArray(inputData) ? inputData.length : 1 };
        }

        const fs = await import('fs').then(m => m.promises);
        let content: string;

        switch (format) {
          case 'json':
            content = JSON.stringify(inputData, null, 2);
            break;
          case 'csv':
            content = this.convertToCSV(inputData);
            break;
          default:
            content = String(inputData);
        }

        await fs.writeFile(filePath, content);
        return { written: Array.isArray(inputData) ? inputData.length : 1 };
      }
    };
  }

  private createAPISink(): any {
    return {
      execute: async (inputData: any, context: any) => {
        const { url, method = 'POST', headers = {} } = context.config;
        
        if (context.dryRun) {
          return { sent: Array.isArray(inputData) ? inputData.length : 1 };
        }

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify(inputData)
        });

        if (!response.ok) {
          throw new Error(`API call failed: ${response.statusText}`);
        }

        return { sent: Array.isArray(inputData) ? inputData.length : 1 };
      }
    };
  }

  private convertToCSV(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header =>
          JSON.stringify(row[header] || '')
        ).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  private async persistPipeline(pipeline: Pipeline): Promise<void> {
    await prisma.pipeline.upsert({
      where: { id: pipeline.id },
      update: {
        name: pipeline.name,
        description: pipeline.description,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
        status: pipeline.status,
        schedule: pipeline.schedule,
        version: pipeline.version,
        tags: pipeline.tags,
        updatedAt: pipeline.updatedAt
      },
      create: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
        status: pipeline.status,
        schedule: pipeline.schedule,
        version: pipeline.version,
        tags: pipeline.tags,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt
      }
    });
  }

  private async persistExecution(execution: PipelineExecution): Promise<void> {
    await prisma.pipelineExecution.create({
      data: {
        id: execution.id,
        pipelineId: execution.pipelineId,
        version: execution.version,
        status: execution.status,
        startTime: execution.startTime,
        endTime: execution.endTime,
        metrics: execution.metrics,
        errors: execution.errors
      }
    });
  }

  private async deletePipelineFromDB(pipelineId: string): Promise<void> {
    await prisma.pipeline.delete({
      where: { id: pipelineId }
    });
  }
}