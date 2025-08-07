import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PluginMetrics {
  installId: string;
  pluginId: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  containers: ContainerMetrics[];
  services: ServiceMetrics[];
  resources: ResourceMetrics;
  health: HealthMetrics;
  logs: LogEntry[];
  timestamp: string;
}

interface ContainerMetrics {
  id: string;
  name: string;
  image: string;
  status: string;
  uptime: string;
  cpu: number;
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: {
    rx: number;
    tx: number;
  };
  ports: string[];
}

interface ServiceMetrics {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: string;
  errorCount: number;
}

interface ResourceMetrics {
  totalCpu: number;
  totalMemory: number;
  totalStorage: number;
  networkIO: {
    received: number;
    transmitted: number;
  };
}

interface HealthMetrics {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
}

interface HealthCheck {
  name: string;
  status: 'passing' | 'warning' | 'critical';
  message: string;
  lastCheck: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
}

// Monitor single plugin installation
const monitorPlugin = async (installId: string): Promise<PluginMetrics | null> => {
  const workDir = `/Users/lokesh/git/saas-idp/plugin-runtime/${installId}`;
  
  try {
    // Check if Docker Compose exists
    const { stdout: composeCheck } = await execAsync(`ls docker-compose.yml`, { cwd: workDir });
    if (!composeCheck) {
      return null;
    }

    // Get container metrics
    const containers = await getContainerMetrics(workDir);
    
    // Get service health
    const services = await getServiceMetrics();
    
    // Calculate resource usage
    const resources = calculateResourceMetrics(containers);
    
    // Perform health checks
    const health = await performHealthChecks(services);
    
    // Get recent logs
    const logs = await getRecentLogs(workDir);

    return {
      installId,
      pluginId: 'unknown', // This would be stored in metadata
      status: determineOverallStatus(containers, services),
      containers,
      services,
      resources,
      health,
      logs,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error monitoring plugin ${installId}:`, error);
    return null;
  }
};

// Get container metrics using Docker stats
const getContainerMetrics = async (workDir: string): Promise<ContainerMetrics[]> => {
  try {
    const { stdout: containerIds } = await execAsync('docker-compose ps -q', { cwd: workDir });
    const ids = containerIds.trim().split('\n').filter(id => id.trim());
    
    if (ids.length === 0) {
      return [];
    }
    
    const containers: ContainerMetrics[] = [];
    
    for (const id of ids) {
      try {
        // Get container info
        const { stdout: inspectOutput } = await execAsync(`docker inspect ${id}`);
        const containerInfo = JSON.parse(inspectOutput)[0];
        
        // Get container stats
        const { stdout: statsOutput } = await execAsync(`docker stats ${id} --no-stream --format "table {{.CPUPerc}},{{.MemUsage}},{{.NetIO}}"`, { timeout: 10000 });
        const statsLines = statsOutput.trim().split('\n');
        const statsData = statsLines[1]?.split(',') || [];
        
        // Parse memory usage
        const memUsage = statsData[1]?.split(' / ') || ['0B', '0B'];
        const memUsageBytes = parseMemoryString(memUsage[0]);
        const memLimitBytes = parseMemoryString(memUsage[1]);
        
        // Parse network IO
        const netIO = statsData[2]?.split(' / ') || ['0B', '0B'];
        const netRx = parseMemoryString(netIO[0]);
        const netTx = parseMemoryString(netIO[1]);
        
        // Get port mappings
        const ports = Object.keys(containerInfo.NetworkSettings.Ports || {});
        
        containers.push({
          id: id.slice(0, 12),
          name: containerInfo.Name.replace('/', ''),
          image: containerInfo.Config.Image,
          status: containerInfo.State.Status,
          uptime: calculateUptime(containerInfo.State.StartedAt),
          cpu: parseFloat(statsData[0]?.replace('%', '') || '0'),
          memory: {
            usage: memUsageBytes,
            limit: memLimitBytes,
            percentage: memLimitBytes > 0 ? (memUsageBytes / memLimitBytes) * 100 : 0
          },
          network: {
            rx: netRx,
            tx: netTx
          },
          ports
        });
        
      } catch (containerError) {
        console.error(`Error getting metrics for container ${id}:`, containerError);
      }
    }
    
    return containers;
    
  } catch (error) {
    console.error('Error getting container metrics:', error);
    return [];
  }
};

// Get service health metrics
const getServiceMetrics = async (): Promise<ServiceMetrics[]> => {
  const services = [
    { name: 'frontend', url: 'http://localhost:3000' },
    { name: 'backend', url: 'http://localhost:7007/api/health' },
    { name: 'nginx', url: 'http://localhost/health' },
    { name: 'grafana', url: 'http://localhost:3001/api/health' },
    { name: 'prometheus', url: 'http://localhost:9090/-/healthy' }
  ];
  
  const serviceMetrics: ServiceMetrics[] = [];
  
  for (const service of services) {
    const startTime = Date.now();
    let status: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
    
    try {
      const { stdout } = await execAsync(`curl -f -s -o /dev/null -w "%{http_code}" ${service.url}`, { timeout: 5000 });
      const httpCode = parseInt(stdout.trim());
      status = httpCode >= 200 && httpCode < 400 ? 'healthy' : 'unhealthy';
    } catch (error) {
      status = 'unhealthy';
    }
    
    const responseTime = Date.now() - startTime;
    
    serviceMetrics.push({
      name: service.name,
      url: service.url,
      status,
      responseTime,
      lastCheck: new Date().toISOString(),
      errorCount: 0 // This would be tracked over time
    });
  }
  
  return serviceMetrics;
};

// Calculate aggregate resource metrics
const calculateResourceMetrics = (containers: ContainerMetrics[]): ResourceMetrics => {
  return containers.reduce(
    (acc, container) => ({
      totalCpu: acc.totalCpu + container.cpu,
      totalMemory: acc.totalMemory + container.memory.usage,
      totalStorage: acc.totalStorage, // Would need additional Docker API call
      networkIO: {
        received: acc.networkIO.received + container.network.rx,
        transmitted: acc.networkIO.transmitted + container.network.tx
      }
    }),
    {
      totalCpu: 0,
      totalMemory: 0,
      totalStorage: 0,
      networkIO: { received: 0, transmitted: 0 }
    }
  );
};

// Perform comprehensive health checks
const performHealthChecks = async (services: ServiceMetrics[]): Promise<HealthMetrics> => {
  const checks: HealthCheck[] = [];
  
  // Service availability checks
  for (const service of services) {
    checks.push({
      name: `${service.name}_availability`,
      status: service.status === 'healthy' ? 'passing' : 'critical',
      message: service.status === 'healthy' 
        ? `${service.name} is responding (${service.responseTime}ms)`
        : `${service.name} is not responding`,
      lastCheck: service.lastCheck
    });
  }
  
  // Resource usage checks
  const totalMemoryGB = services.length * 1; // Rough estimate
  if (totalMemoryGB > 8) {
    checks.push({
      name: 'memory_usage',
      status: 'warning',
      message: 'High memory usage detected',
      lastCheck: new Date().toISOString()
    });
  }
  
  // Overall health
  const criticalCount = checks.filter(c => c.status === 'critical').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (criticalCount > 0) {
    overall = 'unhealthy';
  } else if (warningCount > 0) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }
  
  return { overall, checks };
};

// Get recent logs from containers
const getRecentLogs = async (workDir: string): Promise<LogEntry[]> => {
  try {
    const { stdout: logsOutput } = await execAsync('docker-compose logs --tail=50 --timestamps', { 
      cwd: workDir,
      timeout: 10000 
    });
    
    const logLines = logsOutput.split('\n').filter(line => line.trim());
    const logs: LogEntry[] = [];
    
    for (const line of logLines.slice(-20)) { // Last 20 log entries
      const match = line.match(/^(\S+)\s+\|\s+(.+)$/);
      if (match) {
        const [, service, message] = match;
        
        // Try to parse timestamp from message
        const timestampMatch = message.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
        const timestamp = timestampMatch ? timestampMatch[1] + 'Z' : new Date().toISOString();
        
        // Determine log level
        let level: 'info' | 'warn' | 'error' | 'debug' = 'info';
        if (message.toLowerCase().includes('error')) level = 'error';
        else if (message.toLowerCase().includes('warn')) level = 'warn';
        else if (message.toLowerCase().includes('debug')) level = 'debug';
        
        logs.push({
          timestamp,
          level,
          service: service.replace(/_\d+$/, ''), // Remove container suffix
          message: message.replace(timestampMatch?.[0] || '', '').trim()
        });
      }
    }
    
    return logs.reverse(); // Most recent first
    
  } catch (error) {
    console.error('Error getting logs:', error);
    return [];
  }
};

// Helper functions
const parseMemoryString = (memStr: string): number => {
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  const match = memStr.match(/^([\d.]+)(\w+)$/);
  if (!match) return 0;
  const [, value, unit] = match;
  return parseFloat(value) * (units[unit as keyof typeof units] || 1);
};

const calculateUptime = (startedAt: string): string => {
  const start = new Date(startedAt);
  const now = new Date();
  const uptimeMs = now.getTime() - start.getTime();
  
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const determineOverallStatus = (containers: ContainerMetrics[], services: ServiceMetrics[]): 'running' | 'stopped' | 'error' | 'unknown' => {
  if (containers.length === 0) return 'stopped';
  
  const runningContainers = containers.filter(c => c.status === 'running').length;
  const healthyServices = services.filter(s => s.status === 'healthy').length;
  
  if (runningContainers === containers.length && healthyServices > 0) {
    return 'running';
  } else if (runningContainers > 0) {
    return 'error';
  } else {
    return 'stopped';
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const installId = searchParams.get('installId');
    const action = searchParams.get('action') || 'metrics';

    if (action === 'list') {
      // Return list of all monitored plugins
      // This would typically come from a database
      return NextResponse.json({
        success: true,
        message: 'Plugin monitoring not yet implemented for list action',
        plugins: []
      });
    }

    if (!installId) {
      return NextResponse.json({
        success: false,
        error: 'Install ID is required'
      }, { status: 400 });
    }

    const metrics = await monitorPlugin(installId);

    if (!metrics) {
      return NextResponse.json({
        success: false,
        error: 'Plugin not found or not running'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('Error monitoring plugin:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get plugin metrics'
    }, { status: 500 });
  }
}

// WebSocket endpoint for real-time monitoring would go here
// This would require additional setup with Socket.io or similar