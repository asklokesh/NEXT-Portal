/**
 * Common GraphQL Types
 */

import { ObjectType, Field, Int, ClassType } from 'type-graphql';

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;
}

export function PaginatedResponse<T>(TClass: ClassType<T>) {
  @ObjectType(`${TClass.name}Edge`)
  class Edge {
    @Field(() => TClass)
    node: T;

    @Field()
    cursor: string;
  }

  @ObjectType(`${TClass.name}Connection`)
  class Connection {
    @Field(() => [Edge])
    edges: Edge[];

    @Field(() => PageInfo)
    pageInfo: PageInfo;

    @Field(() => Int)
    totalCount: number;
  }

  return Connection;
}

@ObjectType()
export class MutationResponse {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => [Error], { nullable: true })
  errors?: Error[];
}

@ObjectType()
export class Error {
  @Field()
  message: string;

  @Field({ nullable: true })
  code?: string;

  @Field(() => [String], { nullable: true })
  path?: string[];
}

@ObjectType()
export class BatchOperationResult {
  @Field(() => Int)
  successful: number;

  @Field(() => Int)
  failed: number;

  @Field(() => [Error], { nullable: true })
  errors?: Error[];
}

@ObjectType()
export class FileUpload {
  @Field()
  filename: string;

  @Field()
  mimetype: string;

  @Field()
  encoding: string;

  @Field(() => Int)
  size: number;
}

@ObjectType()
export class Metric {
  @Field()
  name: string;

  @Field()
  value: number;

  @Field({ nullable: true })
  unit?: string;

  @Field(() => Date)
  timestamp: Date;

  @Field(() => JSON, { nullable: true })
  labels?: any;
}

@ObjectType()
export class TimeSeries {
  @Field()
  label: string;

  @Field(() => [DataPoint])
  data: DataPoint[];
}

@ObjectType()
export class DataPoint {
  @Field(() => Date)
  timestamp: Date;

  @Field()
  value: number;
}

@ObjectType()
export class AggregatedMetric {
  @Field()
  avg: number;

  @Field()
  min: number;

  @Field()
  max: number;

  @Field()
  sum: number;

  @Field(() => Int)
  count: number;

  @Field({ nullable: true })
  p50?: number;

  @Field({ nullable: true })
  p95?: number;

  @Field({ nullable: true })
  p99?: number;
}