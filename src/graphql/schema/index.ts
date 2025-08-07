/**
 * GraphQL Schema Definition
 * Type-safe schema with TypeGraphQL
 */

import { buildSchema } from 'type-graphql';
import { GraphQLSchema } from 'graphql';
import { Container } from 'typedi';
import { authChecker } from '../auth/auth-checker';

// Import all resolvers
import { UserResolver } from './resolvers/UserResolver';
import { ServiceResolver } from './resolvers/ServiceResolver';
import { TemplateResolver } from './resolvers/TemplateResolver';
import { PluginResolver } from './resolvers/PluginResolver';
import { NotificationResolver } from './resolvers/NotificationResolver';
import { AuditLogResolver } from './resolvers/AuditLogResolver';
import { DashboardResolver } from './resolvers/DashboardResolver';
import { CostResolver } from './resolvers/CostResolver';
import { MetricsResolver } from './resolvers/MetricsResolver';
import { WorkflowResolver } from './resolvers/WorkflowResolver';

// Import all types
export * from './types/User';
export * from './types/Service';
export * from './types/Template';
export * from './types/Plugin';
export * from './types/Notification';
export * from './types/AuditLog';
export * from './types/Dashboard';
export * from './types/Cost';
export * from './types/Metrics';
export * from './types/Workflow';
export * from './types/Common';

// Import custom scalars
import { DateScalar } from './scalars/DateScalar';
import { JSONScalar } from './scalars/JSONScalar';
import { URLScalar } from './scalars/URLScalar';

export async function createSchema(): Promise<GraphQLSchema> {
  const schema = await buildSchema({
    resolvers: [
      UserResolver,
      ServiceResolver,
      TemplateResolver,
      PluginResolver,
      NotificationResolver,
      AuditLogResolver,
      DashboardResolver,
      CostResolver,
      MetricsResolver,
      WorkflowResolver,
    ],
    scalarsMap: [
      { type: Date, scalar: DateScalar },
      { type: Object, scalar: JSONScalar },
      { type: URL, scalar: URLScalar },
    ],
    authChecker,
    container: Container,
    validate: true,
    emitSchemaFile: {
      path: './schema.graphql',
      sortedSchema: true,
      commentDescriptions: true,
    },
  });

  return schema;
}