
import { ObservabilityConfig } from './observability-config';

export interface SLO {
  id: string;
  serviceName: string;
  name: string;
  description: string;
  target: number;
  window: '28d' | '30d'; // 28 or 30 day window
  metricName: string;
}

export interface ErrorBudget {
  sloId: string;
  totalEvents: number;
  goodEvents: number;
  badEvents: number;
  remainingBudget: number;
}

export class SREAutomation {
  private slos: Map<string, SLO> = new Map();
  private errorBudgets: Map<string, ErrorBudget> = new Map();

  constructor(private config: ObservabilityConfig) {
    this.loadSLOs();
  }

  private loadSLOs() {
    // In a real implementation, this would load SLOs from a persistent store
    // For now, we'll define some sample SLOs
    const sampleSLOs: SLO[] = [
      {
        id: 'api-availability',
        serviceName: 'backend-api',
        name: 'API Availability',
        description: 'The percentage of successful API requests.',
        target: 0.999,
        window: '28d',
        metricName: 'http_requests_total',
      },
      {
        id: 'api-latency',
        serviceName: 'backend-api',
        name: 'API Latency',
        description: 'The percentage of API requests served within 500ms.',
        target: 0.99,
        window: '28d',
        metricName: 'http_request_duration_seconds',
      },
    ];

    for (const slo of sampleSLOs) {
      this.slos.set(slo.id, slo);
      this.errorBudgets.set(slo.id, {
        sloId: slo.id,
        totalEvents: 0,
        goodEvents: 0,
        badEvents: 0,
        remainingBudget: 1 - slo.target,
      });
    }
  }

  async processMetric(metric: any): Promise<void> {
    for (const slo of this.slos.values()) {
      if (slo.metricName === metric.name) {
        const errorBudget = this.errorBudgets.get(slo.id);
        if (errorBudget) {
          errorBudget.totalEvents++;
          if (this.isGoodEvent(slo, metric)) {
            errorBudget.goodEvents++;
          } else {
            errorBudget.badEvents++;
          }
          this.updateErrorBudget(slo, errorBudget);
        }
      }
    }
  }

  private isGoodEvent(slo: SLO, metric: any): boolean {
    if (slo.id === 'api-availability') {
      return metric.labels.status_code.startsWith('2');
    }
    if (slo.id === 'api-latency') {
      return metric.value <= 0.5;
    }
    return true;
  }

  private updateErrorBudget(slo: SLO, errorBudget: ErrorBudget) {
    const burnRate = errorBudget.badEvents / errorBudget.totalEvents;
    errorBudget.remainingBudget = (1 - slo.target) - burnRate;
  }

  async processIncident(incident: any): Promise<void> {
    // This is a simplified example. In a real implementation, we would
    // have a more sophisticated way of mapping incidents to SLOs and
    // calculating the impact on the error budget.
    const sloId = incident.labels.slo_id;
    if (sloId) {
        const errorBudget = this.errorBudgets.get(sloId);
        if (errorBudget) {
            // For simplicity, we'll just burn a fixed amount of budget for each incident
            errorBudget.remainingBudget -= 0.0001;
        }
    }
  }

  async getSLOStatus(serviceName: string): Promise<any> {
    const serviceSLOs = Array.from(this.slos.values()).filter(
      (slo) => slo.serviceName === serviceName
    );

    return serviceSLOs.map((slo) => ({
      ...slo,
      errorBudget: this.errorBudgets.get(slo.id),
    }));
  }

  async getErrorBudget(sloId: string): Promise<ErrorBudget | undefined> {
    return this.errorBudgets.get(sloId);
  }
}
