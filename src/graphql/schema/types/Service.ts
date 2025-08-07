/**
 * Service Type Definitions
 */

import { ObjectType, Field, ID, Int, registerEnumType } from 'type-graphql';
import { User } from './User';
import { Plugin } from './Plugin';
import { PaginatedResponse } from './Common';

@ObjectType()
export class Service {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ServiceType)
  type: ServiceType;

  @Field(() => ServiceStatus)
  status: ServiceStatus;

  @Field(() => User)
  owner: User;

  @Field(() => [String])
  tags: string[];

  @Field(() => ServiceMetadata)
  metadata: ServiceMetadata;

  @Field(() => [Dependency], { nullable: true })
  dependencies?: Dependency[];

  @Field(() => [Plugin], { nullable: true })
  plugins?: Plugin[];

  @Field(() => HealthStatus)
  health: HealthStatus;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Int)
  version: number;
}

@ObjectType()
export class ServiceMetadata {
  @Field({ nullable: true })
  repository?: string;

  @Field({ nullable: true })
  documentation?: string;

  @Field({ nullable: true })
  apiSpec?: string;

  @Field(() => [String], { nullable: true })
  environments?: string[];

  @Field(() => JSON, { nullable: true })
  customFields?: any;
}

@ObjectType()
export class Dependency {
  @Field(() => ID)
  id: string;

  @Field()
  serviceId: string;

  @Field()
  dependsOnId: string;

  @Field(() => DependencyType)
  type: DependencyType;

  @Field({ nullable: true })
  version?: string;

  @Field()
  isRequired: boolean;
}

@ObjectType()
export class HealthStatus {
  @Field(() => HealthState)
  state: HealthState;

  @Field({ nullable: true })
  message?: string;

  @Field(() => [HealthCheck])
  checks: HealthCheck[];

  @Field(() => Date)
  lastChecked: Date;
}

@ObjectType()
export class HealthCheck {
  @Field()
  name: string;

  @Field(() => HealthState)
  status: HealthState;

  @Field({ nullable: true })
  message?: string;

  @Field(() => Int, { nullable: true })
  responseTime?: number;
}

export enum ServiceType {
  API = 'API',
  BACKEND = 'BACKEND',
  FRONTEND = 'FRONTEND',
  DATABASE = 'DATABASE',
  LIBRARY = 'LIBRARY',
  TOOL = 'TOOL',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
}

export enum ServiceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEPRECATED = 'DEPRECATED',
  MAINTENANCE = 'MAINTENANCE',
  DEVELOPMENT = 'DEVELOPMENT',
}

export enum DependencyType {
  RUNTIME = 'RUNTIME',
  BUILD = 'BUILD',
  TEST = 'TEST',
  OPTIONAL = 'OPTIONAL',
}

export enum HealthState {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN',
}

registerEnumType(ServiceType, { name: 'ServiceType' });
registerEnumType(ServiceStatus, { name: 'ServiceStatus' });
registerEnumType(DependencyType, { name: 'DependencyType' });
registerEnumType(HealthState, { name: 'HealthState' });

@ObjectType()
export class ServiceConnection extends PaginatedResponse(Service) {}

@ObjectType()
export class ServiceStats {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  active: number;

  @Field(() => Int)
  inactive: number;

  @Field(() => Int)
  deprecated: number;

  @Field(() => [ServiceTypeCount])
  byType: ServiceTypeCount[];
}

@ObjectType()
export class ServiceTypeCount {
  @Field(() => ServiceType)
  type: ServiceType;

  @Field(() => Int)
  count: number;
}