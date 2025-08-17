// System metrics collection for comprehensive observability
import os from 'os';
import { PrometheusMetrics } from './PrometheusMetrics';

// System resource collection
export async function collectSystemMetrics(metrics: PrometheusMetrics): Promise<void> {
  try {
    const startTime = Date.now();
    const instance = process.env.INSTANCE_ID || os.hostname();

    // CPU Metrics
    await collectCpuMetrics(metrics, instance);

    // Memory Metrics
    await collectMemoryMetrics(metrics, instance);

    // Disk Metrics
    await collectDiskMetrics(metrics, instance);

    // Network Metrics (if available)
    await collectNetworkMetrics(metrics, instance);

    // Process Metrics
    await collectProcessMetrics(metrics, instance);

    // Application-specific Metrics
    await collectApplicationMetrics(metrics, instance);

    // Event Loop Metrics (Node.js specific)
    await collectEventLoopMetrics(metrics, instance);

    const duration = Date.now() - startTime;
    console.debug(`System metrics collection completed in ${duration}ms`);

  } catch (error) {
    console.error('Error collecting system metrics:', error);
    metrics.recordError('system_metrics', 'collection_failed', 'warning', 'monitoring');
  }
}

async function collectCpuMetrics(metrics: PrometheusMetrics, instance: string): Promise<void> {
  try {
    const cpus = os.cpus();
    const numCPUs = cpus.length;
    
    // Calculate overall CPU usage
    let totalUser = 0;
    let totalSystem = 0;
    let totalIdle = 0;
    let totalTotal = 0;

    for (const cpu of cpus) {
      totalUser += cpu.times.user;
      totalSystem += cpu.times.sys;
      totalIdle += cpu.times.idle;
      totalTotal += cpu.times.user + cpu.times.sys + cpu.times.idle + cpu.times.nice + cpu.times.irq;
    }

    const usagePercent = ((totalTotal - totalIdle) / totalTotal) * 100;

    metrics.cpuUsage.set({ instance, component: 'system' }, usagePercent);
    metrics.cpuUsage.set({ instance, component: 'user' }, (totalUser / totalTotal) * 100);
    metrics.cpuUsage.set({ instance, component: 'system_kernel' }, (totalSystem / totalTotal) * 100);
    metrics.cpuUsage.set({ instance, component: 'idle' }, (totalIdle / totalTotal) * 100);

    // Per-core CPU metrics (if detailed monitoring is enabled)
    if (process.env.DETAILED_CPU_METRICS === 'true') {
      cpus.forEach((cpu, index) => {
        const coreTotal = cpu.times.user + cpu.times.sys + cpu.times.idle + cpu.times.nice + cpu.times.irq;
        const coreUsage = ((coreTotal - cpu.times.idle) / coreTotal) * 100;
        metrics.cpuUsage.set({ instance, component: `core_${index}` }, coreUsage);
      });
    }

    // Load average (Unix systems)
    const loadAvg = os.loadavg();
    metrics.cpuUsage.set({ instance, component: 'load_1m' }, loadAvg[0]);
    metrics.cpuUsage.set({ instance, component: 'load_5m' }, loadAvg[1]);
    metrics.cpuUsage.set({ instance, component: 'load_15m' }, loadAvg[2]);

  } catch (error) {
    console.error('Error collecting CPU metrics:', error);
  }
}

async function collectMemoryMetrics(metrics: PrometheusMetrics, instance: string): Promise<void> {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // System memory metrics
    metrics.memoryUsage.set({ instance, component: 'system', type: 'total' }, totalMemory);
    metrics.memoryUsage.set({ instance, component: 'system', type: 'used' }, usedMemory);
    metrics.memoryUsage.set({ instance, component: 'system', type: 'free' }, freeMemory);
    metrics.memoryUsage.set({ instance, component: 'system', type: 'usage_percent' }, memoryUsagePercent);

    // Process memory metrics
    const processMemory = process.memoryUsage();
    metrics.memoryUsage.set({ instance, component: 'process', type: 'resident_set' }, processMemory.rss);
    metrics.memoryUsage.set({ instance, component: 'process', type: 'heap_total' }, processMemory.heapTotal);
    metrics.memoryUsage.set({ instance, component: 'process', type: 'heap_used' }, processMemory.heapUsed);
    metrics.memoryUsage.set({ instance, component: 'process', type: 'external' }, processMemory.external);
    metrics.memoryUsage.set({ instance, component: 'process', type: 'array_buffers' }, processMemory.arrayBuffers);

    // Heap usage percentage
    const heapUsagePercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;
    metrics.memoryUsage.set({ instance, component: 'process', type: 'heap_usage_percent' }, heapUsagePercent);

  } catch (error) {
    console.error('Error collecting memory metrics:', error);
  }
}

async function collectDiskMetrics(metrics: PrometheusMetrics, instance: string): Promise<void> {
  try {
    // Node.js doesn't have built-in disk usage APIs, so we'll use process stats
    // In a production environment, you might want to use child_process to call system commands
    // or use a library like 'node-disk-info'

    // For now, we'll collect basic filesystem info that's available
    const tmpdir = os.tmpdir();
    
    // Placeholder disk metrics (would be replaced with actual disk usage collection)
    metrics.diskUsage.set({ instance, mount_point: '/', device: 'root' }, 0);
    
    // If running in a container, might want to check container filesystem usage
    if (process.env.CONTAINER_MODE) {
      // Container-specific disk metrics would go here
    }

  } catch (error) {
    console.error('Error collecting disk metrics:', error);
  }
}

async function collectNetworkMetrics(metrics: PrometheusMetrics, instance: string): Promise<void> {
  try {
    const networkInterfaces = os.networkInterfaces();
    
    // Collect network interface information
    Object.entries(networkInterfaces).forEach(([interfaceName, interfaces]) => {
      if (interfaces) {
        interfaces.forEach((iface, index) => {
          if (!iface.internal && iface.family === 'IPv4') {
            // Network interface is active
            // Note: Node.js doesn't provide traffic statistics directly
            // In production, you'd want to read from /proc/net/dev on Linux
            // or use system-specific methods
            
            // Placeholder for now
            metrics.networkBytesTotal.inc({
              instance,
              interface: interfaceName,
              direction: 'rx'
            }, 0);
            
            metrics.networkBytesTotal.inc({
              instance,
              interface: interfaceName,
              direction: 'tx'
            }, 0);
          }
        });
      }
    });

  } catch (error) {
    console.error('Error collecting network metrics:', error);
  }
}

async function collectProcessMetrics(metrics: PrometheusMetrics, instance: string): Promise<void> {
  try {
    // Process uptime
    const uptime = process.uptime();
    metrics.cpuUsage.set({ instance, component: 'process_uptime' }, uptime);

    // Process ID
    const pid = process.pid;
    metrics.cpuUsage.set({ instance, component: 'process_id' }, pid);

    // Node.js version info
    const nodeVersion = process.version;
    // Note: Version strings can't be stored directly in Prometheus metrics
    // They would typically be stored as labels or in a separate info metric

    // Resource usage
    if (process.resourceUsage) {
      const resourceUsage = process.resourceUsage();
      metrics.cpuUsage.set({ instance, component: 'user_cpu_time' }, resourceUsage.userCPUTime);
      metrics.cpuUsage.set({ instance, component: 'system_cpu_time' }, resourceUsage.systemCPUTime);
      metrics.memoryUsage.set({ instance, component: 'process', type: 'max_rss' }, resourceUsage.maxRSS);
    }

    // File descriptors (Unix systems)
    try {
      const fdCount = await getFileDescriptorCount();
      metrics.cpuUsage.set({ instance, component: 'file_descriptors' }, fdCount);
    } catch (error) {
      // File descriptor counting not available on this system
    }

  } catch (error) {
    console.error('Error collecting process metrics:', error);
  }
}

async function collectApplicationMetrics(metrics: PrometheusMetrics, instance: string): Promise<void> {
  try {
    // Application-specific metrics
    
    // Count active connections (would be retrieved from actual connection pools)
    const activeConnections = await getActiveConnectionCounts();
    
    metrics.databaseConnectionsActive.set({
      database: 'postgresql',
      pool: 'main'
    }, activeConnections.database || 0);

    metrics.websocketConnectionsActive.set({
      namespace: 'default',
      room: 'all'
    }, activeConnections.websocket || 0);

    // Plugin health status
    const pluginHealth = await getPluginHealthStatus();
    Object.entries(pluginHealth).forEach(([pluginId, isHealthy]) => {
      metrics.pluginHealthStatus.set({
        plugin_id: pluginId,
        version: 'current',
        environment: process.env.NODE_ENV || 'development'
      }, isHealthy ? 1 : 0);
    });

    // Cache metrics
    const cacheStats = await getCacheStats();
    Object.entries(cacheStats).forEach(([cacheName, stats]) => {
      metrics.cacheSize.set({ cache_name: cacheName }, stats.size || 0);
    });

  } catch (error) {
    console.error('Error collecting application metrics:', error);
  }
}

async function collectEventLoopMetrics(metrics: PrometheusMetrics, instance: string): Promise<void> {
  try {
    // Event loop lag measurement
    const eventLoopLag = await measureEventLoopLag();
    metrics.cpuUsage.set({ instance, component: 'event_loop_lag_ms' }, eventLoopLag);

    // Active handles and requests
    if ((process as any)._getActiveHandles) {
      const activeHandles = (process as any)._getActiveHandles().length;
      metrics.cpuUsage.set({ instance, component: 'active_handles' }, activeHandles);
    }

    if ((process as any)._getActiveRequests) {
      const activeRequests = (process as any)._getActiveRequests().length;
      metrics.cpuUsage.set({ instance, component: 'active_requests' }, activeRequests);
    }

  } catch (error) {
    console.error('Error collecting event loop metrics:', error);
  }
}

// Helper functions

async function getFileDescriptorCount(): Promise<number> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'linux' && process.platform !== 'darwin') {
      reject(new Error('File descriptor counting not supported on this platform'));
      return;
    }

    // On Unix systems, we can count files in /proc/self/fd/
    const fs = require('fs');
    try {
      const fdDir = '/proc/self/fd/';
      fs.readdir(fdDir, (err: any, files: string[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(files.length);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function getActiveConnectionCounts(): Promise<{[key: string]: number}> {
  // This would typically query your connection pools
  // Placeholder implementation
  return {
    database: Math.floor(Math.random() * 10), // Replace with actual database connection count
    websocket: Math.floor(Math.random() * 100), // Replace with actual WebSocket connection count
    redis: Math.floor(Math.random() * 5) // Replace with actual Redis connection count
  };
}

async function getPluginHealthStatus(): Promise<{[pluginId: string]: boolean}> {
  // This would check actual plugin health
  // Placeholder implementation
  const plugins = ['catalog', 'auth', 'cicd', 'monitoring', 'templates'];
  const health: {[key: string]: boolean} = {};
  
  plugins.forEach(plugin => {
    health[plugin] = Math.random() > 0.1; // 90% chance of being healthy
  });
  
  return health;
}

async function getCacheStats(): Promise<{[cacheName: string]: {size: number}}> {
  // This would query actual cache statistics
  // Placeholder implementation
  return {
    'redis-main': { size: Math.floor(Math.random() * 1000000) },
    'memory-cache': { size: Math.floor(Math.random() * 100000) },
    'session-cache': { size: Math.floor(Math.random() * 50000) }
  };
}

async function measureEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      resolve(lag);
    });
  });
}

// Utility function to collect all metrics at once
export async function collectAllMetrics(metrics: PrometheusMetrics): Promise<void> {
  await collectSystemMetrics(metrics);
}

// Export individual collection functions for selective use
export {
  collectCpuMetrics,
  collectMemoryMetrics,
  collectDiskMetrics,
  collectNetworkMetrics,
  collectProcessMetrics,
  collectApplicationMetrics,
  collectEventLoopMetrics
};