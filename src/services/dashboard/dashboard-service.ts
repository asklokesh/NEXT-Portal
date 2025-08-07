
import { Logger } from '@backstage/backend-common';

export interface DashboardLayout {
  widgets: {
    id: string;
    type: string;
    config: any;
  }[];
}

export class DashboardService {
  private logger: Logger;
  private userDashboards: Map<string, DashboardLayout> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Dashboard Service');
  }

  async getDashboard(userId: string): Promise<DashboardLayout> {
    return this.userDashboards.get(userId) || { widgets: [] };
  }

  async saveDashboard(userId: string, layout: DashboardLayout): Promise<void> {
    this.userDashboards.set(userId, layout);
  }
}
