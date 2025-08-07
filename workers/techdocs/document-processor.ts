/**
 * TechDocs v2 Document Processing Worker
 * High-performance background processing for documentation
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';

import { TechDocsEngine } from '../../src/lib/techdocs-v2/core/engine';
import { MultiFormatEngine } from '../../src/lib/techdocs-v2/formats/multi-format-engine';
import { AISearchEngine } from '../../src/lib/techdocs-v2/core/search';
import { AIDocumentationGenerator } from '../../src/lib/techdocs-v2/ai/generator';
import { VisualDocumentationRenderer } from '../../src/lib/techdocs-v2/core/renderer';

import { 
  TechDocument, 
  DocumentFormat, 
  DocumentContent 
} from '../../src/lib/techdocs-v2/types';

interface ProcessingJob {
  id: string;
  type: 'parse' | 'render' | 'index' | 'generate' | 'convert' | 'validate';
  payload: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout: number;
  retries: number;
  createdAt: Date;
}

interface ProcessingResult {
  jobId: string;
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    cacheHitRate?: number;
  };
}

class DocumentProcessor extends EventEmitter {
  private engines: {
    techDocs: TechDocsEngine;
    multiFormat: MultiFormatEngine;
    search: AISearchEngine;
    ai: AIDocumentationGenerator;
    renderer: VisualDocumentationRenderer;
  };
  
  private processingQueue: ProcessingJob[] = [];
  private activeJobs: Map<string, ProcessingJob> = new Map();
  private workers: Map<string, Worker> = new Map();
  private isProcessing = false;
  private concurrency = 4;
  private metrics = {
    totalJobs: 0,
    successfulJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };

  constructor() {
    super();
    this.initializeEngines();
    this.startProcessing();
    this.setupMetricsCollection();
  }

  private async initializeEngines() {
    this.engines = {
      techDocs: new TechDocsEngine({
        performance: {
          caching: { enabled: true, strategy: 'lru', ttl: 600, layers: ['memory'] },
          compression: { enabled: true, algorithm: 'gzip', level: 6 },
          lazy: { enabled: false, threshold: 0, rootMargin: '0px' },
          cdn: { enabled: false, provider: 'none', endpoints: [] },
        },
      }),
      multiFormat: new MultiFormatEngine(),
      search: new AISearchEngine({
        vectorStore: { provider: 'memory', dimensions: 768 },
        textIndex: { engine: 'memory', analyzer: 'standard' },
        entities: { model: 'simple', languages: ['en'] },
        queryProcessing: { nlp: false, entityLinking: false },
        ranking: { algorithm: 'tf-idf', features: ['text'] },
        embedding: { model: 'simple', cache: true },
      }),
      ai: new AIDocumentationGenerator({
        contentGeneration: {
          enabled: true,
          model: 'gpt-3.5-turbo',
          creativity: 0.5,
          context: {
            includeCodebase: false,
            includeRelatedDocs: true,
            includeUserHistory: false,
            maxContextLength: 4000,
          },
          templates: [],
        },
        smartSuggestions: {
          enabled: true,
          types: ['content-improvement'],
          frequency: 'periodic',
        },
        autoComplete: {
          enabled: false,
          minChars: 3,
          maxSuggestions: 5,
          contextAware: false,
        },
        qualityAnalysis: {
          enabled: true,
          metrics: ['readability', 'completeness'],
          threshold: 0.7,
        },
      }),
      renderer: new VisualDocumentationRenderer(),
    };

    this.emit('engines:initialized');
  }

  /**
   * Add a processing job to the queue
   */
  async addJob(job: Omit<ProcessingJob, 'id' | 'createdAt'>): Promise<string> {
    const fullJob: ProcessingJob = {
      ...job,
      id: this.generateJobId(),
      createdAt: new Date(),
    };

    // Insert job based on priority
    const insertIndex = this.findInsertIndex(fullJob.priority);
    this.processingQueue.splice(insertIndex, 0, fullJob);

    this.emit('job:queued', { jobId: fullJob.id, type: fullJob.type });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return fullJob.id;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): 'queued' | 'processing' | 'completed' | 'failed' | 'not-found' {
    if (this.activeJobs.has(jobId)) {
      return 'processing';
    }

    if (this.processingQueue.some(job => job.id === jobId)) {
      return 'queued';
    }

    // In a real implementation, we'd check completed/failed job storage
    return 'not-found';
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Remove from queue if not started
    const queueIndex = this.processingQueue.findIndex(job => job.id === jobId);
    if (queueIndex >= 0) {
      this.processingQueue.splice(queueIndex, 1);
      this.emit('job:cancelled', { jobId });
      return true;
    }

    // If job is active, we'd need to terminate the worker
    if (this.activeJobs.has(jobId)) {
      const worker = this.workers.get(jobId);
      if (worker) {
        await worker.terminate();
        this.workers.delete(jobId);
        this.activeJobs.delete(jobId);
        this.emit('job:cancelled', { jobId });
        return true;
      }
    }

    return false;
  }

  /**
   * Get processing metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.processingQueue.length,
      activeJobs: this.activeJobs.size,
      availableWorkers: this.concurrency - this.activeJobs.size,
    };
  }

  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    while (this.processingQueue.length > 0 && this.activeJobs.size < this.concurrency) {
      const job = this.processingQueue.shift();
      if (!job) break;

      await this.processJob(job);
    }

    this.isProcessing = false;
  }

  private async processJob(job: ProcessingJob) {
    const startTime = Date.now();
    
    try {
      this.activeJobs.set(job.id, job);
      this.emit('job:started', { jobId: job.id, type: job.type });

      let result: any;

      switch (job.type) {
        case 'parse':
          result = await this.parseDocument(job.payload);
          break;
        case 'render':
          result = await this.renderDocument(job.payload);
          break;
        case 'index':
          result = await this.indexDocument(job.payload);
          break;
        case 'generate':
          result = await this.generateContent(job.payload);
          break;
        case 'convert':
          result = await this.convertFormat(job.payload);
          break;
        case 'validate':
          result = await this.validateDocument(job.payload);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      const processingTime = Date.now() - startTime;
      const metrics = this.collectJobMetrics();

      const processingResult: ProcessingResult = {
        jobId: job.id,
        success: true,
        result,
        processingTime,
        metrics,
      };

      this.emit('job:completed', processingResult);
      this.updateMetrics(processingResult);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const metrics = this.collectJobMetrics();

      const processingResult: ProcessingResult = {
        jobId: job.id,
        success: false,
        error: error.message,
        processingTime,
        metrics,
      };

      // Retry logic
      if (job.retries > 0) {
        job.retries--;
        job.priority = 'high'; // Increase priority for retries
        this.processingQueue.unshift(job);
        this.emit('job:retry', { jobId: job.id, retriesLeft: job.retries });
      } else {
        this.emit('job:failed', processingResult);
        this.updateMetrics(processingResult);
      }

    } finally {
      this.activeJobs.delete(job.id);
      
      // Continue processing remaining jobs
      if (this.processingQueue.length > 0) {
        setImmediate(() => this.startProcessing());
      }
    }
  }

  private async parseDocument(payload: any): Promise<DocumentContent> {
    const { content, format, options } = payload;
    return await this.engines.multiFormat.parseDocument(content, format, options);
  }

  private async renderDocument(payload: any): Promise<any> {
    const { blocks, options } = payload;
    return await this.engines.renderer.renderBlocks(blocks, options);
  }

  private async indexDocument(payload: any): Promise<void> {
    const { document } = payload;
    await this.engines.search.indexDocument(document);
  }

  private async generateContent(payload: any): Promise<any> {
    const { documentId, prompt, context } = payload;
    return await this.engines.ai.generateFromTemplate('code-explanation', {
      code: payload.code || '',
      language: payload.language || 'javascript',
    }, context);
  }

  private async convertFormat(payload: any): Promise<DocumentContent> {
    const { content, targetFormat, options } = payload;
    return await this.engines.multiFormat.convertFormat(content, targetFormat, options);
  }

  private async validateDocument(payload: any): Promise<any> {
    const { document, config } = payload;
    return await this.engines.techDocs.validateDocument(document.id, config);
  }

  private findInsertIndex(priority: ProcessingJob['priority']): number {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const targetPriority = priorityOrder[priority];

    for (let i = 0; i < this.processingQueue.length; i++) {
      const jobPriority = priorityOrder[this.processingQueue[i].priority];
      if (jobPriority > targetPriority) {
        return i;
      }
    }

    return this.processingQueue.length;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private collectJobMetrics() {
    const memoryUsage = process.memoryUsage();
    return {
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: process.cpuUsage().user / 1000, // ms
    };
  }

  private updateMetrics(result: ProcessingResult) {
    this.metrics.totalJobs++;
    
    if (result.success) {
      this.metrics.successfulJobs++;
    } else {
      this.metrics.failedJobs++;
    }

    // Update rolling average
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.totalJobs - 1) + result.processingTime) / 
      this.metrics.totalJobs;

    this.metrics.memoryUsage = result.metrics.memoryUsage;
    this.metrics.cpuUsage = result.metrics.cpuUsage;
  }

  private setupMetricsCollection() {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics:updated', metrics);
      
      // Log performance warnings
      if (metrics.memoryUsage > 500) { // 500MB
        console.warn(`High memory usage: ${metrics.memoryUsage.toFixed(2)}MB`);
      }
      
      if (metrics.queueLength > 100) {
        console.warn(`Large queue size: ${metrics.queueLength} jobs`);
      }
      
    }, 30000); // Every 30 seconds
  }
}

// Worker thread entry point
if (!isMainThread && parentPort) {
  const processor = new DocumentProcessor();
  
  parentPort.on('message', async (message) => {
    const { type, payload, jobId } = message;
    
    try {
      switch (type) {
        case 'process':
          const result = await processor.addJob(payload);
          parentPort!.postMessage({ type: 'result', jobId, result });
          break;
        
        case 'status':
          const status = processor.getJobStatus(payload.jobId);
          parentPort!.postMessage({ type: 'status', jobId, status });
          break;
        
        case 'metrics':
          const metrics = processor.getMetrics();
          parentPort!.postMessage({ type: 'metrics', jobId, metrics });
          break;
        
        case 'cancel':
          const cancelled = await processor.cancelJob(payload.jobId);
          parentPort!.postMessage({ type: 'cancelled', jobId, cancelled });
          break;
        
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      parentPort!.postMessage({ 
        type: 'error', 
        jobId, 
        error: error.message 
      });
    }
  });
  
  // Forward processor events
  processor.on('job:completed', (result) => {
    parentPort!.postMessage({ type: 'job:completed', data: result });
  });
  
  processor.on('job:failed', (result) => {
    parentPort!.postMessage({ type: 'job:failed', data: result });
  });
  
  processor.on('metrics:updated', (metrics) => {
    parentPort!.postMessage({ type: 'metrics:updated', data: metrics });
  });
}

// Main thread worker manager
export class DocumentProcessorManager {
  private workers: Worker[] = [];
  private currentWorker = 0;
  private jobCallbacks: Map<string, { resolve: Function; reject: Function }> = new Map();

  constructor(workerCount: number = 2) {
    for (let i = 0; i < workerCount; i++) {
      this.createWorker();
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(__filename);
    
    worker.on('message', (message) => {
      const { type, jobId, result, error, data } = message;
      
      if (jobId && this.jobCallbacks.has(jobId)) {
        const { resolve, reject } = this.jobCallbacks.get(jobId)!;
        this.jobCallbacks.delete(jobId);
        
        if (error) {
          reject(new Error(error));
        } else {
          resolve(result);
        }
      }
      
      // Forward events
      if (type.startsWith('job:') || type.startsWith('metrics:')) {
        this.emit(type, data);
      }
    });
    
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      // Restart worker
      this.restartWorker(worker);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
        this.restartWorker(worker);
      }
    });
    
    this.workers.push(worker);
    return worker;
  }

  private restartWorker(oldWorker: Worker) {
    const index = this.workers.indexOf(oldWorker);
    if (index >= 0) {
      oldWorker.terminate();
      this.workers[index] = this.createWorker();
    }
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.currentWorker];
    this.currentWorker = (this.currentWorker + 1) % this.workers.length;
    return worker;
  }

  async processJob(job: Omit<ProcessingJob, 'id' | 'createdAt'>): Promise<any> {
    return new Promise((resolve, reject) => {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.jobCallbacks.set(jobId, { resolve, reject });
      
      const worker = this.getNextWorker();
      worker.postMessage({
        type: 'process',
        jobId,
        payload: job,
      });
      
      // Timeout handling
      setTimeout(() => {
        if (this.jobCallbacks.has(jobId)) {
          this.jobCallbacks.delete(jobId);
          reject(new Error(`Job ${jobId} timed out`));
        }
      }, job.timeout || 30000);
    });
  }

  async getJobStatus(jobId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.jobCallbacks.set(jobId, { resolve, reject });
      
      const worker = this.getNextWorker();
      worker.postMessage({
        type: 'status',
        jobId,
        payload: { jobId },
      });
    });
  }

  async getMetrics(): Promise<any> {
    return new Promise((resolve, reject) => {
      const jobId = `metrics_${Date.now()}`;
      this.jobCallbacks.set(jobId, { resolve, reject });
      
      const worker = this.getNextWorker();
      worker.postMessage({
        type: 'metrics',
        jobId,
      });
    });
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );
    this.workers = [];
  }

  // EventEmitter-like interface for compatibility
  private events: Record<string, Function[]> = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  private emit(event: string, data: any) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
}

export default DocumentProcessor;