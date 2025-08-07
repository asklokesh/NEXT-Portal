/**
 * Event-Driven Architecture Core Module
 * Provides comprehensive event-driven patterns for the Backstage portal
 */

export * from './core/event-bus';
export * from './core/event-store';
export * from './core/event-types';
export * from './patterns/event-sourcing';
export * from './patterns/cqrs';
export * from './patterns/saga';
export * from './infrastructure/kafka-producer';
export * from './infrastructure/kafka-consumer';
export * from './monitoring/event-monitor';
export * from './gateway/event-gateway';
export * from './processors/event-processor';
export * from './streaming/event-stream';