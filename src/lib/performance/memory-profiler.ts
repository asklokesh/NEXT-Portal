/**
 * Memory Profiler and Leak Detector
 * Monitors memory usage and detects potential memory leaks
 */

import { EventEmitter } from 'events';
import { MemoryProfile, MemoryLeak } from './types';

export class MemoryProfiler extends EventEmitter {
  private isProfileActive = false;
  private samples: MemoryProfile[] = [];
  private leakDetectionThreshold = 10; // MB
  private sampleInterval: NodeJS.Timeout | null = null;
  private baseline: MemoryProfile | null = null;
  private retainedObjects: Map<string, WeakRef<any>> = new Map();

  constructor() {
    super();
  }

  public startProfiling(intervalMs: number = 1000): void {
    if (this.isProfileActive) {
      console.warn('Memory profiling is already active');
      return;
    }

    this.isProfileActive = true;
    this.samples = [];
    this.baseline = this.captureMemorySnapshot();

    this.sampleInterval = setInterval(() => {
      const snapshot = this.captureMemorySnapshot();
      this.samples.push(snapshot);
      this.analyzeMemoryTrends();
      this.emit('memorySample', snapshot);
    }, intervalMs);

    this.emit('profilingStarted', { timestamp: Date.now() });
  }

  public stopProfiling(): MemoryProfile[] {
    if (!this.isProfileActive) {
      return [];
    }

    this.isProfileActive = false;
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }

    const leaks = this.detectMemoryLeaks();
    this.emit('profilingStopped', { 
      samples: this.samples,
      leaks,
      timestamp: Date.now() 
    });

    return this.samples;
  }

  private captureMemorySnapshot(): MemoryProfile {
    const memUsage = this.getMemoryUsage();
    
    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      leaks: []
    };
  }

  private getMemoryUsage(): any {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    } else if (typeof window !== 'undefined' && (performance as any).memory) {
      // Browser environment
      const memory = (performance as any).memory;
      return {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: 0,
        rss: memory.jsHeapSizeLimit,
        arrayBuffers: 0
      };
    } else {
      // Fallback
      return {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        arrayBuffers: 0
      };
    }
  }

  private analyzeMemoryTrends(): void {
    if (this.samples.length < 5) return;

    const recentSamples = this.samples.slice(-10);
    const avgGrowth = this.calculateAverageGrowth(recentSamples);

    if (avgGrowth > this.leakDetectionThreshold * 1024 * 1024) {
      this.emit('potentialLeak', {
        averageGrowth: avgGrowth,
        samples: recentSamples,
        timestamp: Date.now()
      });
    }
  }

  private calculateAverageGrowth(samples: MemoryProfile[]): number {
    if (samples.length < 2) return 0;

    let totalGrowth = 0;
    for (let i = 1; i < samples.length; i++) {
      totalGrowth += samples[i].heapUsed - samples[i - 1].heapUsed;
    }

    return totalGrowth / (samples.length - 1);
  }

  private detectMemoryLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    if (this.samples.length < 10) {
      return leaks;
    }

    // Analyze heap growth patterns
    const heapGrowthLeak = this.detectHeapGrowthLeak();
    if (heapGrowthLeak) {
      leaks.push(heapGrowthLeak);
    }

    // Check for DOM node leaks (browser only)
    if (typeof window !== 'undefined') {
      const domLeak = this.detectDOMLeaks();
      if (domLeak) {
        leaks.push(domLeak);
      }
    }

    // Check for event listener leaks
    const listenerLeak = this.detectEventListenerLeaks();
    if (listenerLeak) {
      leaks.push(listenerLeak);
    }

    return leaks;
  }

  private detectHeapGrowthLeak(): MemoryLeak | null {
    const samples = this.samples.slice(-20);
    if (samples.length < 10) return null;

    const growthRate = this.calculateGrowthRate(samples);
    const threshold = 1024 * 1024; // 1MB per sample

    if (growthRate > threshold) {
      return {
        location: 'Heap Memory',
        size: growthRate,
        count: samples.length,
        growth: growthRate,
        stackTrace: this.generateStackTrace()
      };
    }

    return null;
  }

  private calculateGrowthRate(samples: MemoryProfile[]): number {
    if (samples.length < 2) return 0;

    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    const timeDiff = lastSample.timestamp - firstSample.timestamp;
    const memoryDiff = lastSample.heapUsed - firstSample.heapUsed;

    return (memoryDiff / timeDiff) * 1000; // Growth per second
  }

  private detectDOMLeaks(): MemoryLeak | null {
    if (typeof document === 'undefined') return null;

    const detachedNodes = this.findDetachedDOMNodes();
    if (detachedNodes > 100) {
      return {
        location: 'DOM Nodes',
        size: detachedNodes * 1024, // Estimate 1KB per node
        count: detachedNodes,
        growth: 0,
        stackTrace: ['Detached DOM nodes detected', `Count: ${detachedNodes}`]
      };
    }

    return null;
  }

  private findDetachedDOMNodes(): number {
    // This is a simplified check - in production, you'd use Chrome DevTools Protocol
    let count = 0;
    const allNodes = document.querySelectorAll('*');
    
    allNodes.forEach(node => {
      if (!document.body.contains(node) && node.parentNode) {
        count++;
      }
    });

    return count;
  }

  private detectEventListenerLeaks(): MemoryLeak | null {
    // Check for excessive event listeners
    const listenerCount = this.countEventListeners();
    
    if (listenerCount > 1000) {
      return {
        location: 'Event Listeners',
        size: listenerCount * 512, // Estimate 512 bytes per listener
        count: listenerCount,
        growth: 0,
        stackTrace: ['Excessive event listeners detected', `Count: ${listenerCount}`]
      };
    }

    return null;
  }

  private countEventListeners(): number {
    if (typeof window === 'undefined') return 0;

    let count = 0;
    const allElements = document.querySelectorAll('*');
    
    // This is a simplified count - actual implementation would need to track all listener types
    allElements.forEach(element => {
      // Check common event types
      const events = ['click', 'change', 'input', 'submit', 'keydown', 'keyup', 'scroll'];
      events.forEach(eventType => {
        // Note: This is an approximation as we can't directly count listeners
        if ((element as any)[`on${eventType}`]) {
          count++;
        }
      });
    });

    return count;
  }

  private generateStackTrace(): string[] {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 7) : ['Stack trace not available'];
  }

  public async generateReport(): Promise<{
    summary: {
      totalSamples: number;
      duration: number;
      averageHeapUsed: number;
      peakHeapUsed: number;
      leaksDetected: number;
    };
    leaks: MemoryLeak[];
    recommendations: string[];
  }> {
    const leaks = this.detectMemoryLeaks();
    const avgHeap = this.samples.reduce((sum, s) => sum + s.heapUsed, 0) / this.samples.length;
    const peakHeap = Math.max(...this.samples.map(s => s.heapUsed));
    const duration = this.samples.length > 0 
      ? this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp
      : 0;

    const recommendations = this.generateRecommendations(leaks, avgHeap, peakHeap);

    return {
      summary: {
        totalSamples: this.samples.length,
        duration,
        averageHeapUsed: avgHeap,
        peakHeapUsed: peakHeap,
        leaksDetected: leaks.length
      },
      leaks,
      recommendations
    };
  }

  private generateRecommendations(leaks: MemoryLeak[], avgHeap: number, peakHeap: number): string[] {
    const recommendations: string[] = [];

    if (leaks.length > 0) {
      recommendations.push('Memory leaks detected - investigate and fix immediately');
    }

    if (peakHeap > 200 * 1024 * 1024) { // 200MB
      recommendations.push('High memory usage detected - consider optimizing data structures');
    }

    if (avgHeap > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Average memory usage is high - implement lazy loading and pagination');
    }

    const hasDOM = leaks.some(l => l.location === 'DOM Nodes');
    if (hasDOM) {
      recommendations.push('Remove event listeners when components unmount');
      recommendations.push('Clean up DOM references in useEffect cleanup functions');
    }

    const hasListeners = leaks.some(l => l.location === 'Event Listeners');
    if (hasListeners) {
      recommendations.push('Use event delegation instead of individual listeners');
      recommendations.push('Implement proper cleanup in component lifecycle methods');
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory usage is optimal - no issues detected');
    }

    return recommendations;
  }

  public trackObject(key: string, object: any): void {
    this.retainedObjects.set(key, new WeakRef(object));
  }

  public checkRetainedObjects(): Map<string, boolean> {
    const results = new Map<string, boolean>();
    
    this.retainedObjects.forEach((ref, key) => {
      const obj = ref.deref();
      results.set(key, obj !== undefined);
    });

    return results;
  }

  public forceGarbageCollection(): void {
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    } else {
      console.warn('Manual garbage collection not available');
    }
  }

  public cleanup(): void {
    this.stopProfiling();
    this.retainedObjects.clear();
    this.samples = [];
    this.baseline = null;
    this.removeAllListeners();
  }
}