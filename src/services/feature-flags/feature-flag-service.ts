import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { z } from 'zod';

const FeatureFlagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export class FeatureFlagService extends EventEmitter {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor(private logger: Logger) {
    super();
  }

  async createFlag(flagData: Omit<FeatureFlag, 'id'>): Promise<FeatureFlag> {
    const flag = FeatureFlagSchema.parse({
      id: crypto.randomUUID(),
      ...flagData,
    });
    this.flags.set(flag.id, flag);
    this.logger.info(`Feature flag created: ${flag.id}`);
    this.emit('flagCreated', flag);
    return flag;
  }

  async getFlag(id: string): Promise<FeatureFlag | undefined> {
    return this.flags.get(id);
  }

  async updateFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | undefined> {
    const flag = this.flags.get(id);
    if (flag) {
      const updatedFlag = { ...flag, ...updates };
      this.flags.set(id, updatedFlag);
      this.logger.info(`Feature flag updated: ${id}`);
      this.emit('flagUpdated', updatedFlag);
      return updatedFlag;
    }
    return undefined;
  }
}
