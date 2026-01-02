
import { Integration, IntegrationProvider } from '@prisma/client';

export interface IntegrationResult {
  success: boolean;
  entitiesSynced: number;
  message?: string;
  errors?: string[];
}

export interface IProviderAdapter {
  provider: IntegrationProvider;
  validateCredentials(credentials: string): Promise<boolean>;
  sync(integration: Integration): Promise<IntegrationResult>;
}
