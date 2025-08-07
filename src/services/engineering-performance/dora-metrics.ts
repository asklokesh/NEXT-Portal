
import { Incident } from '../observability/incident-manager';
import { DeploymentOrchestration } from '../deployment/deployment-orchestrator';

export interface DORAMetrics {
  deploymentFrequency: number; // deployments per day
  leadTimeForChanges: number; // hours
  meanTimeToRecovery: number; // hours
  changeFailureRate: number; // percentage
}

export class DORAMetricsService {
  private deployments: DeploymentOrchestration[] = [];
  private incidents: Incident[] = [];

  addDeployment(deployment: DeploymentOrchestration) {
    this.deployments.push(deployment);
  }

  addIncident(incident: Incident) {
    this.incidents.push(incident);
  }

  calculateMetrics(serviceName: string, timeWindowDays: number): DORAMetrics {
    const timeWindowEnd = new Date();
    const timeWindowStart = new Date();
    timeWindowStart.setDate(timeWindowStart.getDate() - timeWindowDays);

    const serviceDeployments = this.deployments.filter(
      (d) =>
        d.config.name === serviceName &&
        new Date(d.startTime) >= timeWindowStart &&
        new Date(d.startTime) <= timeWindowEnd
    );

    const serviceIncidents = this.incidents.filter(
      (i) =>
        i.service === serviceName &&
        new Date(i.detectedAt) >= timeWindowStart &&
        new Date(i.detectedAt) <= timeWindowEnd
    );

    const deploymentFrequency = serviceDeployments.length / timeWindowDays;

    const leadTimeForChanges = this.calculateLeadTimeForChanges(serviceDeployments);
    const meanTimeToRecovery = this.calculateMeanTimeToRecovery(serviceIncidents);
    const changeFailureRate = this.calculateChangeFailureRate(
      serviceDeployments,
      serviceIncidents
    );

    return {
      deploymentFrequency,
      leadTimeForChanges,
      meanTimeToRecovery,
      changeFailureRate,
    };
  }

  private calculateLeadTimeForChanges(
    deployments: DeploymentOrchestration[]
  ): number {
    if (deployments.length === 0) {
      return 0;
    }

    const totalLeadTime = deployments.reduce((acc, d) => {
      const duration = d.duration || 0;
      return acc + duration;
    }, 0);

    return totalLeadTime / deployments.length / 1000 / 3600; // convert to hours
  }

  private calculateMeanTimeToRecovery(incidents: Incident[]): number {
    const resolvedIncidents = incidents.filter((i) => i.resolvedAt);
    if (resolvedIncidents.length === 0) {
      return 0;
    }

    const totalRecoveryTime = resolvedIncidents.reduce((acc, i) => {
      const recoveryTime = i.resolvedAt!.getTime() - i.detectedAt.getTime();
      return acc + recoveryTime;
    }, 0);

    return totalRecoveryTime / resolvedIncidents.length / 1000 / 3600; // convert to hours
  }

  private calculateChangeFailureRate(
    deployments: DeploymentOrchestration[],
    incidents: Incident[]
  ): number {
    if (deployments.length === 0) {
      return 0;
    }

    const failedDeployments = deployments.filter(
      (d) => d.status.phase === 'failed'
    ).length;

    const deploymentRelatedIncidents = incidents.filter((i) =>
      i.tags?.source?.startsWith('deployment')
    ).length;

    const changeFailures = failedDeployments + deploymentRelatedIncidents;

    return (changeFailures / deployments.length) * 100;
  }
}
