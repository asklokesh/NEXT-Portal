/**
 * Core Web Vitals Monitoring
 * Tracks and reports on Google's Core Web Vitals metrics
 */

import { PerformanceMetrics } from './types';

export interface WebVitalsMetrics {
  LCP: number | null; // Largest Contentful Paint
  FID: number | null; // First Input Delay
  CLS: number | null; // Cumulative Layout Shift
  FCP: number | null; // First Contentful Paint
  TTFB: number | null; // Time to First Byte
  INP: number | null; // Interaction to Next Paint
}

export class CoreWebVitalsMonitor {
  private metrics: WebVitalsMetrics = {
    LCP: null,
    FID: null,
    CLS: null,
    FCP: null,
    TTFB: null,
    INP: null
  };

  private observers: PerformanceObserver[] = [];
  private callbacks: Map<string, (metric: any) => void> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeMonitoring();
    }
  }

  private initializeMonitoring(): void {
    // Monitor LCP
    this.observeLCP();
    
    // Monitor FID
    this.observeFID();
    
    // Monitor CLS
    this.observeCLS();
    
    // Monitor FCP
    this.observeFCP();
    
    // Monitor TTFB
    this.observeTTFB();
    
    // Monitor INP
    this.observeINP();
  }

  private observeLCP(): void {
    try {
      let lcpValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        lcpValue = lastEntry.renderTime || lastEntry.loadTime;
        this.metrics.LCP = lcpValue;
        this.reportMetric('LCP', lcpValue);
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('LCP observation not supported:', error);
    }
  }

  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstInput = entries[0] as any;
        if (firstInput) {
          const fidValue = firstInput.processingStart - firstInput.startTime;
          this.metrics.FID = fidValue;
          this.reportMetric('FID', fidValue);
        }
      });
      
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FID observation not supported:', error);
    }
  }

  private observeCLS(): void {
    try {
      let clsValue = 0;
      let sessionValue = 0;
      let sessionEntries: any[] = [];
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only count layout shifts without recent user input
          if (!(entry as any).hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
            
            // If the entry is more than 1 second after the previous entry,
            // or more than 5 seconds after the first entry, start a new session
            if (sessionEntries.length &&
                ((entry.startTime - lastSessionEntry.startTime > 1000) ||
                 (entry.startTime - firstSessionEntry.startTime > 5000))) {
              sessionValue = 0;
              sessionEntries = [];
            }
            
            sessionEntries.push(entry);
            sessionValue += (entry as any).value;
            clsValue = Math.max(clsValue, sessionValue);
            this.metrics.CLS = clsValue;
            this.reportMetric('CLS', clsValue);
          }
        }
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('CLS observation not supported:', error);
    }
  }

  private observeFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.FCP = fcpEntry.startTime;
          this.reportMetric('FCP', fcpEntry.startTime);
        }
      });
      
      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FCP observation not supported:', error);
    }
  }

  private observeTTFB(): void {
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
        this.metrics.TTFB = ttfb;
        this.reportMetric('TTFB', ttfb);
      }
    } catch (error) {
      console.warn('TTFB observation not supported:', error);
    }
  }

  private observeINP(): void {
    try {
      let inpValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.interactionId) {
            const inputDelay = entry.processingStart - entry.startTime;
            const processingTime = entry.processingEnd - entry.processingStart;
            const presentationDelay = entry.startTime + entry.duration - entry.processingEnd;
            const totalDuration = inputDelay + processingTime + presentationDelay;
            
            inpValue = Math.max(inpValue, totalDuration);
            this.metrics.INP = inpValue;
            this.reportMetric('INP', inpValue);
          }
        });
      });
      
      observer.observe({ entryTypes: ['event'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('INP observation not supported:', error);
    }
  }

  private reportMetric(name: string, value: number): void {
    const callback = this.callbacks.get(name);
    if (callback) {
      callback({
        name,
        value,
        rating: this.getRating(name, value),
        timestamp: Date.now()
      });
    }

    // Also report to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Web Vitals] ${name}: ${value.toFixed(2)}ms (${this.getRating(name, value)})`);
    }
  }

  private getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds: Record<string, [number, number]> = {
      LCP: [2500, 4000],
      FID: [100, 300],
      CLS: [0.1, 0.25],
      FCP: [1800, 3000],
      TTFB: [800, 1800],
      INP: [200, 500]
    };

    const [good, poor] = thresholds[metric] || [Infinity, Infinity];
    
    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  public onMetric(metricName: string, callback: (metric: any) => void): void {
    this.callbacks.set(metricName, callback);
  }

  public getMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  public getScore(): number {
    let score = 100;
    const weights = {
      LCP: 25,
      FID: 25,
      CLS: 25,
      FCP: 10,
      TTFB: 10,
      INP: 5
    };

    Object.entries(this.metrics).forEach(([key, value]) => {
      if (value !== null) {
        const rating = this.getRating(key, value);
        if (rating === 'needs-improvement') {
          score -= weights[key as keyof typeof weights] * 0.5;
        } else if (rating === 'poor') {
          score -= weights[key as keyof typeof weights];
        }
      }
    });

    return Math.max(0, score);
  }

  public async generateReport(): Promise<{
    metrics: WebVitalsMetrics;
    score: number;
    recommendations: string[];
  }> {
    const score = this.getScore();
    const recommendations: string[] = [];

    Object.entries(this.metrics).forEach(([key, value]) => {
      if (value !== null) {
        const rating = this.getRating(key, value);
        if (rating !== 'good') {
          recommendations.push(this.getRecommendation(key, value, rating));
        }
      }
    });

    return {
      metrics: this.getMetrics(),
      score,
      recommendations
    };
  }

  private getRecommendation(metric: string, value: number, rating: string): string {
    const recommendations: Record<string, string> = {
      LCP: 'Optimize images, preload critical resources, and minimize render-blocking CSS',
      FID: 'Break up long tasks, use web workers, and optimize JavaScript execution',
      CLS: 'Set size attributes on images/videos, avoid inserting content above existing content',
      FCP: 'Eliminate render-blocking resources, inline critical CSS, preconnect to required origins',
      TTFB: 'Optimize server response time, use CDN, implement efficient caching',
      INP: 'Optimize event handlers, minimize main thread work, use CSS animations instead of JS'
    };

    return `${metric} is ${rating} (${value.toFixed(2)}ms). ${recommendations[metric]}`;
  }

  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.callbacks.clear();
  }
}