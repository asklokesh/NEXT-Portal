import { Incident, IncidentStatistics, TrendDataPoint } from './types';

interface MetricPoint {
  timestamp: Date;
  value: number;
  labels: Record<string, string>;
}

interface AggregatedMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

export class MetricsCollector {
  private incidents: Map<string, Incident> = new Map();
  private metrics: Map<string, MetricPoint[]> = new Map();
  private aggregatedMetrics: Map<string, AggregatedMetric> = new Map();

  // Core incident metrics
  collectIncidentMetrics(incidents: Incident[]): void {
    incidents.forEach(incident => {
      this.incidents.set(incident.id, incident);
    });

    this.calculateMTTR();
    this.calculateMTTA();
    this.calculateMTBF();
    this.calculateSeverityDistribution();
    this.calculateStatusDistribution();
    this.calculateServiceImpact();
    this.calculateTimeToDetection();
    this.calculateEscalationRate();
    this.calculateSLACompliance();
  }

  private calculateMTTR(): void {
    const resolvedIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.resolvedAt && incident.acknowledgedAt);

    if (resolvedIncidents.length === 0) {
      this.storeMetric('incident.mttr.overall', 0, 'minutes');
      return;
    }

    // Overall MTTR
    const totalResolutionTime = resolvedIncidents.reduce((sum, incident) => {
      const resolutionTime = incident.resolvedAt!.getTime() - incident.acknowledgedAt!.getTime();
      return sum + (resolutionTime / 60000); // Convert to minutes
    }, 0);

    const overallMTTR = totalResolutionTime / resolvedIncidents.length;
    this.storeMetric('incident.mttr.overall', overallMTTR, 'minutes');

    // MTTR by severity
    const severities = ['critical', 'high', 'medium', 'low'];
    severities.forEach(severity => {
      const severityIncidents = resolvedIncidents.filter(i => i.severity === severity);
      if (severityIncidents.length > 0) {
        const severityMTTR = severityIncidents.reduce((sum, incident) => {
          const resolutionTime = incident.resolvedAt!.getTime() - incident.acknowledgedAt!.getTime();
          return sum + (resolutionTime / 60000);
        }, 0) / severityIncidents.length;
        
        this.storeMetric(`incident.mttr.severity.${severity}`, severityMTTR, 'minutes', { severity });
      }
    });

    // MTTR by service
    const services = new Set<string>();
    resolvedIncidents.forEach(incident => {
      incident.affectedServices.forEach(service => services.add(service));
    });

    services.forEach(service => {
      const serviceIncidents = resolvedIncidents.filter(i => i.affectedServices.includes(service));
      if (serviceIncidents.length > 0) {
        const serviceMTTR = serviceIncidents.reduce((sum, incident) => {
          const resolutionTime = incident.resolvedAt!.getTime() - incident.acknowledgedAt!.getTime();
          return sum + (resolutionTime / 60000);
        }, 0) / serviceIncidents.length;
        
        this.storeMetric(`incident.mttr.service.${service}`, serviceMTTR, 'minutes', { service });
      }
    });
  }

  private calculateMTTA(): void {
    const acknowledgedIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.acknowledgedAt);

    if (acknowledgedIncidents.length === 0) {
      this.storeMetric('incident.mtta.overall', 0, 'minutes');
      return;
    }

    // Overall MTTA
    const totalAckTime = acknowledgedIncidents.reduce((sum, incident) => {
      const ackTime = incident.acknowledgedAt!.getTime() - incident.createdAt.getTime();
      return sum + (ackTime / 60000); // Convert to minutes
    }, 0);

    const overallMTTA = totalAckTime / acknowledgedIncidents.length;
    this.storeMetric('incident.mtta.overall', overallMTTA, 'minutes');

    // MTTA by severity
    const severities = ['critical', 'high', 'medium', 'low'];
    severities.forEach(severity => {
      const severityIncidents = acknowledgedIncidents.filter(i => i.severity === severity);
      if (severityIncidents.length > 0) {
        const severityMTTA = severityIncidents.reduce((sum, incident) => {
          const ackTime = incident.acknowledgedAt!.getTime() - incident.createdAt.getTime();
          return sum + (ackTime / 60000);
        }, 0) / severityIncidents.length;
        
        this.storeMetric(`incident.mtta.severity.${severity}`, severityMTTA, 'minutes', { severity });
      }
    });

    // MTTA by priority
    const priorities = ['P0', 'P1', 'P2', 'P3', 'P4'];
    priorities.forEach(priority => {
      const priorityIncidents = acknowledgedIncidents.filter(i => i.priority === priority);
      if (priorityIncidents.length > 0) {
        const priorityMTTA = priorityIncidents.reduce((sum, incident) => {
          const ackTime = incident.acknowledgedAt!.getTime() - incident.createdAt.getTime();
          return sum + (ackTime / 60000);
        }, 0) / priorityIncidents.length;
        
        this.storeMetric(`incident.mtta.priority.${priority}`, priorityMTTA, 'minutes', { priority });
      }
    });
  }

  private calculateMTBF(): void {
    const allIncidents = Array.from(this.incidents.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (allIncidents.length < 2) {
      this.storeMetric('incident.mtbf.overall', 0, 'hours');
      return;
    }

    // Calculate time between failures
    let totalTimeBetweenFailures = 0;
    let count = 0;

    for (let i = 1; i < allIncidents.length; i++) {
      const timeBetween = allIncidents[i].createdAt.getTime() - allIncidents[i - 1].createdAt.getTime();
      totalTimeBetweenFailures += timeBetween / (1000 * 60 * 60); // Convert to hours
      count++;
    }

    if (count > 0) {
      const overallMTBF = totalTimeBetweenFailures / count;
      this.storeMetric('incident.mtbf.overall', overallMTBF, 'hours');
    }

    // MTBF by service
    const services = new Set<string>();
    allIncidents.forEach(incident => {
      incident.affectedServices.forEach(service => services.add(service));
    });

    services.forEach(service => {
      const serviceIncidents = allIncidents.filter(i => i.affectedServices.includes(service));
      if (serviceIncidents.length > 1) {
        let serviceTotalTime = 0;
        let serviceCount = 0;

        for (let i = 1; i < serviceIncidents.length; i++) {
          const timeBetween = serviceIncidents[i].createdAt.getTime() - serviceIncidents[i - 1].createdAt.getTime();
          serviceTotalTime += timeBetween / (1000 * 60 * 60);
          serviceCount++;
        }

        if (serviceCount > 0) {
          const serviceMTBF = serviceTotalTime / serviceCount;
          this.storeMetric(`incident.mtbf.service.${service}`, serviceMTBF, 'hours', { service });
        }
      }
    });
  }

  private calculateSeverityDistribution(): void {
    const severityCount: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    Array.from(this.incidents.values()).forEach(incident => {
      severityCount[incident.severity]++;
    });

    Object.entries(severityCount).forEach(([severity, count]) => {
      this.storeMetric(`incident.count.severity.${severity}`, count, 'count', { severity });
    });

    // Calculate percentages
    const total = Object.values(severityCount).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      Object.entries(severityCount).forEach(([severity, count]) => {
        const percentage = (count / total) * 100;
        this.storeMetric(`incident.percentage.severity.${severity}`, percentage, 'percent', { severity });
      });
    }
  }

  private calculateStatusDistribution(): void {
    const statusCount: Record<string, number> = {};

    Array.from(this.incidents.values()).forEach(incident => {
      statusCount[incident.status] = (statusCount[incident.status] || 0) + 1;
    });

    Object.entries(statusCount).forEach(([status, count]) => {
      this.storeMetric(`incident.count.status.${status}`, count, 'count', { status });
    });
  }

  private calculateServiceImpact(): void {
    const serviceImpact: Record<string, {
      incidentCount: number;
      totalDowntime: number;
      lastIncident: Date;
    }> = {};

    Array.from(this.incidents.values()).forEach(incident => {
      incident.affectedServices.forEach(service => {
        if (!serviceImpact[service]) {
          serviceImpact[service] = {
            incidentCount: 0,
            totalDowntime: 0,
            lastIncident: new Date(0)
          };
        }

        serviceImpact[service].incidentCount++;
        serviceImpact[service].lastIncident = incident.createdAt > serviceImpact[service].lastIncident 
          ? incident.createdAt 
          : serviceImpact[service].lastIncident;

        if (incident.resolvedAt) {
          const downtime = incident.resolvedAt.getTime() - incident.createdAt.getTime();
          serviceImpact[service].totalDowntime += downtime / 60000; // Convert to minutes
        }
      });
    });

    Object.entries(serviceImpact).forEach(([service, impact]) => {
      this.storeMetric(`incident.count.service.${service}`, impact.incidentCount, 'count', { service });
      this.storeMetric(`incident.downtime.service.${service}`, impact.totalDowntime, 'minutes', { service });
      
      const daysSinceLastIncident = (Date.now() - impact.lastIncident.getTime()) / (1000 * 60 * 60 * 24);
      this.storeMetric(`incident.days_since_last.service.${service}`, daysSinceLastIncident, 'days', { service });
    });
  }

  private calculateTimeToDetection(): void {
    const incidentsWithDetectionTime = Array.from(this.incidents.values())
      .filter(incident => incident.metrics.detectionTime > 0);

    if (incidentsWithDetectionTime.length === 0) {
      this.storeMetric('incident.detection_time.overall', 0, 'minutes');
      return;
    }

    const averageDetectionTime = incidentsWithDetectionTime.reduce((sum, incident) => 
      sum + incident.metrics.detectionTime, 0
    ) / incidentsWithDetectionTime.length;

    this.storeMetric('incident.detection_time.overall', averageDetectionTime, 'minutes');

    // Detection time by severity
    const severities = ['critical', 'high', 'medium', 'low'];
    severities.forEach(severity => {
      const severityIncidents = incidentsWithDetectionTime.filter(i => i.severity === severity);
      if (severityIncidents.length > 0) {
        const averageDetection = severityIncidents.reduce((sum, incident) => 
          sum + incident.metrics.detectionTime, 0
        ) / severityIncidents.length;
        
        this.storeMetric(`incident.detection_time.severity.${severity}`, averageDetection, 'minutes', { severity });
      }
    });
  }

  private calculateEscalationRate(): void {
    const totalIncidents = this.incidents.size;
    if (totalIncidents === 0) {
      this.storeMetric('incident.escalation_rate.overall', 0, 'percent');
      return;
    }

    const escalatedIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.metrics.escalations > 0);

    const escalationRate = (escalatedIncidents.length / totalIncidents) * 100;
    this.storeMetric('incident.escalation_rate.overall', escalationRate, 'percent');

    // Average number of escalations
    const totalEscalations = Array.from(this.incidents.values())
      .reduce((sum, incident) => sum + incident.metrics.escalations, 0);

    const averageEscalations = escalatedIncidents.length > 0 
      ? totalEscalations / escalatedIncidents.length 
      : 0;

    this.storeMetric('incident.escalations.average', averageEscalations, 'count');
  }

  private calculateSLACompliance(): void {
    const totalIncidents = this.incidents.size;
    if (totalIncidents === 0) {
      this.storeMetric('incident.sla_compliance.overall', 100, 'percent');
      return;
    }

    const compliantIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.slaStatus !== 'breached');

    const complianceRate = (compliantIncidents.length / totalIncidents) * 100;
    this.storeMetric('incident.sla_compliance.overall', complianceRate, 'percent');

    // SLA compliance by severity
    const severities = ['critical', 'high', 'medium', 'low'];
    severities.forEach(severity => {
      const severityIncidents = Array.from(this.incidents.values()).filter(i => i.severity === severity);
      if (severityIncidents.length > 0) {
        const compliant = severityIncidents.filter(i => i.slaStatus !== 'breached').length;
        const severityCompliance = (compliant / severityIncidents.length) * 100;
        
        this.storeMetric(`incident.sla_compliance.severity.${severity}`, severityCompliance, 'percent', { severity });
      }
    });
  }

  // Trend calculation
  calculateTrends(timeRange: string): TrendDataPoint[] {
    const now = new Date();
    const trends: TrendDataPoint[] = [];

    let intervals: number;
    let intervalDuration: number;
    let labelFormat: (date: Date) => string;

    switch (timeRange) {
      case '1h':
        intervals = 12;
        intervalDuration = 5 * 60 * 1000; // 5 minutes
        labelFormat = (date) => date.toTimeString().substring(0, 5);
        break;
      case '24h':
        intervals = 24;
        intervalDuration = 60 * 60 * 1000; // 1 hour
        labelFormat = (date) => date.getHours().toString().padStart(2, '0') + ':00';
        break;
      case '7d':
        intervals = 7;
        intervalDuration = 24 * 60 * 60 * 1000; // 1 day
        labelFormat = (date) => date.toLocaleDateString('en-US', { weekday: 'short' });
        break;
      case '30d':
        intervals = 30;
        intervalDuration = 24 * 60 * 60 * 1000; // 1 day
        labelFormat = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        break;
      default:
        intervals = 24;
        intervalDuration = 60 * 60 * 1000;
        labelFormat = (date) => date.getHours().toString().padStart(2, '0') + ':00';
    }

    for (let i = intervals - 1; i >= 0; i--) {
      const intervalStart = new Date(now.getTime() - (i + 1) * intervalDuration);
      const intervalEnd = new Date(now.getTime() - i * intervalDuration);

      const intervalIncidents = Array.from(this.incidents.values()).filter(incident => 
        incident.createdAt >= intervalStart && incident.createdAt < intervalEnd
      );

      const resolvedInInterval = Array.from(this.incidents.values()).filter(incident => 
        incident.resolvedAt && incident.resolvedAt >= intervalStart && incident.resolvedAt < intervalEnd
      );

      // Calculate MTTR for this interval
      let intervalMTTR = 0;
      const resolvedWithAck = resolvedInInterval.filter(i => i.acknowledgedAt);
      if (resolvedWithAck.length > 0) {
        const totalResolutionTime = resolvedWithAck.reduce((sum, incident) => {
          return sum + (incident.resolvedAt!.getTime() - incident.acknowledgedAt!.getTime()) / 60000;
        }, 0);
        intervalMTTR = totalResolutionTime / resolvedWithAck.length;
      }

      // Calculate MTTA for this interval
      let intervalMTTA = 0;
      const acknowledgedInInterval = intervalIncidents.filter(i => i.acknowledgedAt);
      if (acknowledgedInInterval.length > 0) {
        const totalAckTime = acknowledgedInInterval.reduce((sum, incident) => {
          return sum + (incident.acknowledgedAt!.getTime() - incident.createdAt.getTime()) / 60000;
        }, 0);
        intervalMTTA = totalAckTime / acknowledgedInInterval.length;
      }

      trends.push({
        date: labelFormat(intervalEnd),
        incidents: intervalIncidents.length,
        resolved: resolvedInInterval.length,
        mttr: intervalMTTR,
        mtta: intervalMTTA
      });
    }

    return trends;
  }

  // Utility methods
  private storeMetric(name: string, value: number, unit: string, tags: Record<string, string> = {}): void {
    const metric: AggregatedMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    this.aggregatedMetrics.set(name, metric);

    // Also store as time series point
    const points = this.metrics.get(name) || [];
    points.push({
      timestamp: new Date(),
      value,
      labels: tags
    });

    // Keep only last 1000 points
    if (points.length > 1000) {
      points.shift();
    }

    this.metrics.set(name, points);
  }

  // Public methods for accessing metrics
  getMetric(name: string): AggregatedMetric | undefined {
    return this.aggregatedMetrics.get(name);
  }

  getMetricTimeSeries(name: string, since?: Date): MetricPoint[] {
    const points = this.metrics.get(name) || [];
    
    if (since) {
      return points.filter(point => point.timestamp >= since);
    }
    
    return points;
  }

  getAllMetrics(): Map<string, AggregatedMetric> {
    return new Map(this.aggregatedMetrics);
  }

  getMetricsSnapshot(): Record<string, AggregatedMetric> {
    return Object.fromEntries(this.aggregatedMetrics.entries());
  }

  // Export metrics in Prometheus format
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    
    this.aggregatedMetrics.forEach((metric, name) => {
      const metricName = name.replace(/\./g, '_');
      const labels = Object.entries(metric.tags)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');
      
      const labelsStr = labels ? `{${labels}}` : '';
      
      lines.push(`# HELP ${metricName} ${metric.unit}`);
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`${metricName}${labelsStr} ${metric.value} ${metric.timestamp.getTime()}`);
    });

    return lines.join('\n');
  }

  // Main collection method
  collect(): void {
    const incidents = Array.from(this.incidents.values());
    this.collectIncidentMetrics(incidents);
    
    console.log(`Collected metrics for ${incidents.length} incidents`);
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.aggregatedMetrics.clear();
    this.incidents.clear();
  }
}