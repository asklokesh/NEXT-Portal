// Real User Monitoring (RUM) implementation for frontend performance
import { getPrometheusMetrics } from './PrometheusMetrics';
import { getLogger } from '../logging/StructuredLogger';

// Browser performance metrics interface
export interface PerformanceTiming {
  navigationStart: number;
  unloadEventStart: number;
  unloadEventEnd: number;
  redirectStart: number;
  redirectEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domLoading: number;
  domInteractive: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
  loadEventStart: number;
  loadEventEnd: number;
}

export interface WebVitalsMetrics {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  tenantId?: string;
  userAgent: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  connection?: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
  geolocation?: {
    country: string;
    city: string;
    timezone: string;
  };
  startTime: number;
  endTime?: number;
  pageViews: PageView[];
  errors: FrontendError[];
  interactions: UserInteraction[];
}

export interface PageView {
  id: string;
  url: string;
  title: string;
  referrer: string;
  startTime: number;
  endTime?: number;
  performanceTiming: PerformanceTiming;
  webVitals: WebVitalsMetrics;
  resources: ResourceTiming[];
}

export interface ResourceTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

export interface FrontendError {
  id: string;
  timestamp: number;
  message: string;
  filename: string;
  lineno: number;
  colno: number;
  error?: {
    name: string;
    stack: string;
  };
  url: string;
  userAgent: string;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface UserInteraction {
  id: string;
  timestamp: number;
  type: 'click' | 'scroll' | 'input' | 'navigation' | 'form_submit';
  target: string;
  url: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export class RealUserMonitoring {
  private metrics = getPrometheusMetrics();
  private logger = getLogger('rum', 'client-side');
  private sessions = new Map<string, UserSession>();
  private performanceObserver?: PerformanceObserver;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeBrowserMonitoring();
    }
  }

  private initializeBrowserMonitoring(): void {
    // Initialize performance observer
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });

      this.performanceObserver.observe({ 
        entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift', 'resource'] 
      });
    }

    // Listen for Web Vitals
    this.initializeWebVitals();

    // Listen for errors
    this.initializeErrorTracking();

    // Listen for user interactions
    this.initializeInteractionTracking();

    // Track page visibility changes
    this.initializeVisibilityTracking();

    // Send data periodically
    setInterval(() => this.sendSessionData(), 30000); // Every 30 seconds

    // Send data before page unload
    window.addEventListener('beforeunload', () => this.sendSessionData(true));
    window.addEventListener('pagehide', () => this.sendSessionData(true));
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.handleNavigationTiming(entry as PerformanceNavigationTiming);
        break;
      case 'paint':
        this.handlePaintTiming(entry as PerformancePaintTiming);
        break;
      case 'largest-contentful-paint':
        this.handleLCPTiming(entry as LargestContentfulPaint);
        break;
      case 'first-input':
        this.handleFIDTiming(entry as PerformanceEventTiming);
        break;
      case 'layout-shift':
        this.handleCLSTiming(entry as LayoutShift);
        break;
      case 'resource':
        this.handleResourceTiming(entry as PerformanceResourceTiming);
        break;
    }
  }

  private handleNavigationTiming(entry: PerformanceNavigationTiming): void {
    const timing: PerformanceTiming = {
      navigationStart: entry.navigationStart,
      unloadEventStart: entry.unloadEventStart,
      unloadEventEnd: entry.unloadEventEnd,
      redirectStart: entry.redirectStart,
      redirectEnd: entry.redirectEnd,
      fetchStart: entry.fetchStart,
      domainLookupStart: entry.domainLookupStart,
      domainLookupEnd: entry.domainLookupEnd,
      connectStart: entry.connectStart,
      connectEnd: entry.connectEnd,
      secureConnectionStart: entry.secureConnectionStart,
      requestStart: entry.requestStart,
      responseStart: entry.responseStart,
      responseEnd: entry.responseEnd,
      domLoading: entry.domLoading,
      domInteractive: entry.domInteractive,
      domContentLoadedEventStart: entry.domContentLoadedEventStart,
      domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
      domComplete: entry.domComplete,
      loadEventStart: entry.loadEventStart,
      loadEventEnd: entry.loadEventEnd
    };

    // Calculate key metrics
    const metrics = {
      dns: entry.domainLookupEnd - entry.domainLookupStart,
      tcp: entry.connectEnd - entry.connectStart,
      ssl: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0,
      request: entry.responseStart - entry.requestStart,
      response: entry.responseEnd - entry.responseStart,
      dom: entry.domComplete - entry.domLoading,
      load: entry.loadEventEnd - entry.loadEventStart,
      total: entry.loadEventEnd - entry.navigationStart
    };

    // Send metrics to backend
    this.sendMetrics('navigation_timing', metrics);
    
    this.logger.performance('Navigation timing recorded', metrics.total, {
      url: window.location.href,
      ...metrics
    });
  }

  private handlePaintTiming(entry: PerformancePaintTiming): void {
    const paintTime = Math.round(entry.startTime);
    
    if (entry.name === 'first-contentful-paint') {
      this.sendMetrics('web_vitals_fcp', { value: paintTime });
    } else if (entry.name === 'first-paint') {
      this.sendMetrics('web_vitals_fp', { value: paintTime });
    }

    this.logger.performance(`${entry.name} recorded`, paintTime, {
      url: window.location.href,
      paintType: entry.name
    });
  }

  private handleLCPTiming(entry: LargestContentfulPaint): void {
    const lcpTime = Math.round(entry.startTime);
    this.sendMetrics('web_vitals_lcp', { value: lcpTime });

    this.logger.performance('Largest Contentful Paint recorded', lcpTime, {
      url: window.location.href,
      element: entry.element?.tagName,
      size: entry.size
    });
  }

  private handleFIDTiming(entry: PerformanceEventTiming): void {
    const fid = Math.round(entry.processingStart - entry.startTime);
    this.sendMetrics('web_vitals_fid', { value: fid });

    this.logger.performance('First Input Delay recorded', fid, {
      url: window.location.href,
      eventType: entry.name
    });
  }

  private handleCLSTiming(entry: LayoutShift): void {
    if (!entry.hadRecentInput) {
      this.sendMetrics('web_vitals_cls', { value: entry.value });

      this.logger.performance('Cumulative Layout Shift recorded', entry.value, {
        url: window.location.href,
        hadRecentInput: entry.hadRecentInput
      });
    }
  }

  private handleResourceTiming(entry: PerformanceResourceTiming): void {
    const resource: ResourceTiming = {
      name: entry.name,
      entryType: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
      transferSize: entry.transferSize || 0,
      encodedBodySize: entry.encodedBodySize || 0,
      decodedBodySize: entry.decodedBodySize || 0
    };

    // Categorize resource type
    const resourceType = this.categorizeResource(entry.name);
    
    this.sendMetrics('resource_timing', {
      resourceType,
      duration: resource.duration,
      size: resource.transferSize
    });

    // Log slow resources
    if (resource.duration > 1000) {
      this.logger.warn('Slow resource detected', {
        url: window.location.href,
        resource: resource.name,
        duration: resource.duration,
        size: resource.transferSize
      });
    }
  }

  private initializeWebVitals(): void {
    // Initialize Web Vitals library if available
    if (typeof window !== 'undefined' && (window as any).webVitals) {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = (window as any).webVitals;

      getCLS((metric: any) => this.sendWebVitalMetric('CLS', metric));
      getFID((metric: any) => this.sendWebVitalMetric('FID', metric));
      getFCP((metric: any) => this.sendWebVitalMetric('FCP', metric));
      getLCP((metric: any) => this.sendWebVitalMetric('LCP', metric));
      getTTFB((metric: any) => this.sendWebVitalMetric('TTFB', metric));
    }
  }

  private sendWebVitalMetric(name: string, metric: any): void {
    this.sendMetrics(`web_vitals_${name.toLowerCase()}`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta
    });

    this.logger.performance(`Web Vital ${name} recorded`, metric.value, {
      url: window.location.href,
      rating: metric.rating,
      delta: metric.delta
    });
  }

  private initializeErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.trackError({
        id: this.generateId(),
        timestamp: Date.now(),
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? {
          name: event.error.name,
          stack: event.error.stack
        } : undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        severity: 'high'
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        id: this.generateId(),
        timestamp: Date.now(),
        message: `Unhandled Promise Rejection: ${event.reason}`,
        filename: '',
        lineno: 0,
        colno: 0,
        url: window.location.href,
        userAgent: navigator.userAgent,
        severity: 'high'
      });
    });
  }

  private initializeInteractionTracking(): void {
    // Track clicks
    document.addEventListener('click', (event) => {
      this.trackInteraction({
        id: this.generateId(),
        timestamp: Date.now(),
        type: 'click',
        target: this.getElementSelector(event.target as Element),
        url: window.location.href,
        metadata: {
          x: (event as MouseEvent).clientX,
          y: (event as MouseEvent).clientY
        }
      });
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      this.trackInteraction({
        id: this.generateId(),
        timestamp: Date.now(),
        type: 'form_submit',
        target: this.getElementSelector(event.target as Element),
        url: window.location.href
      });
    });

    // Track scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.trackInteraction({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'scroll',
          target: 'window',
          url: window.location.href,
          metadata: {
            scrollY: window.scrollY,
            scrollX: window.scrollX
          }
        });
      }, 250);
    });
  }

  private initializeVisibilityTracking(): void {
    let visibilityStart = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page became hidden
        const visibleTime = Date.now() - visibilityStart;
        this.sendMetrics('page_visibility', {
          event: 'hidden',
          visibleTime
        });
      } else {
        // Page became visible
        visibilityStart = Date.now();
        this.sendMetrics('page_visibility', {
          event: 'visible'
        });
      }
    });
  }

  // Public methods
  trackError(error: FrontendError): void {
    this.sendMetrics('frontend_error', {
      message: error.message,
      filename: error.filename,
      severity: error.severity
    });

    this.logger.error('Frontend error tracked', new Error(error.message), {
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      url: error.url,
      severity: error.severity
    });
  }

  trackInteraction(interaction: UserInteraction): void {
    this.sendMetrics('user_interaction', {
      type: interaction.type,
      target: interaction.target
    });
  }

  trackCustomMetric(name: string, value: number, metadata?: Record<string, any>): void {
    this.sendMetrics(`custom_${name}`, { value, ...metadata });
    
    this.logger.info(`Custom metric tracked: ${name}`, {
      value,
      ...metadata
    });
  }

  // Helper methods
  private sendMetrics(type: string, data: Record<string, any>): void {
    // Send to backend API
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/rum/metrics', JSON.stringify({
        type,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...data
      }));
    } else {
      // Fallback to fetch
      fetch('/api/rum/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          ...data
        })
      }).catch(() => {
        // Ignore network errors
      });
    }
  }

  private sendSessionData(isBeforeUnload: boolean = false): void {
    // Implementation would send accumulated session data
    // This is a placeholder for the session data transmission logic
  }

  private categorizeResource(url: string): string {
    if (url.match(/\.(js|mjs)$/)) return 'script';
    if (url.match(/\.(css)$/)) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
    if (url.match(/\.(mp4|webm|ogg|mp3|wav)$/)) return 'media';
    if (url.match(/\/api\//)) return 'api';
    return 'other';
  }

  private getElementSelector(element: Element): string {
    if (!element) return 'unknown';
    
    let selector = element.tagName.toLowerCase();
    
    if (element.id) {
      selector += `#${element.id}`;
    } else if (element.className) {
      selector += `.${element.className.split(' ').join('.')}`;
    }
    
    return selector;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Global instance
let rumInstance: RealUserMonitoring | null = null;

export function initializeRUM(): RealUserMonitoring {
  if (!rumInstance) {
    rumInstance = new RealUserMonitoring();
  }
  return rumInstance;
}

export function getRUM(): RealUserMonitoring {
  if (!rumInstance) {
    throw new Error('RUM not initialized. Call initializeRUM() first.');
  }
  return rumInstance;
}

// Browser-specific type definitions
declare global {
  interface Window {
    webVitals?: any;
  }
}

interface LargestContentfulPaint extends PerformanceEntry {
  element?: Element;
  size: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}