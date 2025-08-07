import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { z } from 'zod';

// Define the schema for an incident
const IncidentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  createdAt: z.date(),
  updatedAt: z.date(),
  assignee: z.string().optional(),
  service: z.string(),
});

export type Incident = z.infer<typeof IncidentSchema>;

export class IncidentManager extends EventEmitter {
  private incidents: Map<string, Incident> = new Map();

  constructor(private logger: Logger) {
    super();
  }

  async createIncident(incidentData: Omit<Omit<Incident, 'id'>, 'createdAt'>): Promise<Incident> {
    const incident = IncidentSchema.parse({
      id: crypto.randomUUID(),
      ...incidentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.incidents.set(incident.id, incident);
    this.logger.info(`New incident created: ${incident.id}`);
    this.emit('incidentCreated', incident);
    return incident;
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    return this.incidents.get(id);
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined> {
    const incident = this.incidents.get(id);
    if (incident) {
      const updatedIncident = { ...incident, ...updates, updatedAt: new Date() };
      this.incidents.set(id, updatedIncident);
      this.logger.info(`Incident updated: ${id}`);
      this.emit('incidentUpdated', updatedIncident);
      return updatedIncident;
    }
    return undefined;
  }
}
