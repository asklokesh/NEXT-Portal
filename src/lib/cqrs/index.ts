/**
 * CQRS (Command Query Responsibility Segregation) Module
 * Separates read and write models for optimal performance
 */

export * from './commands/command-bus';
export * from './commands/command-handler';
export * from './queries/query-bus';
export * from './queries/query-handler';
export * from './models/read-model';
export * from './models/write-model';
export * from './projections/projection-engine';