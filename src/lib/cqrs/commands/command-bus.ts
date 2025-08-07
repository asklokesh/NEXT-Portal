/**
 * Command Bus Implementation
 * Routes commands to appropriate handlers with validation
 */

import { EventBus } from '../../event-driven/core/event-bus';
import { KafkaProducer } from '../../kafka/producer/kafka-producer';
import { Logger } from '../../monitoring/logger';
import { MetricsCollector } from '../../monitoring/metrics';
import { z } from 'zod';

export interface Command {
  commandId: string;
  commandType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  metadata: CommandMetadata;
}

export interface CommandMetadata {
  correlationId: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
  timestamp: Date;
  version: string;
}

export interface CommandHandler<T = any> {
  commandType: string;
  schema?: z.ZodSchema<T>;
  handle(command: Command): Promise<CommandResult>;
  validate?(command: Command): Promise<boolean>;
}

export interface CommandResult {
  success: boolean;
  aggregateId?: string;
  version?: number;
  events?: any[];
  error?: Error;
}

export interface CommandBusConfig {
  enableAsync?: boolean;
  enableValidation?: boolean;
  enableMetrics?: boolean;
  timeout?: number;
}

export class CommandBus {
  private handlers: Map<string, CommandHandler>;
  private eventBus: EventBus;
  private kafkaProducer?: KafkaProducer;
  private logger: Logger;
  private metrics: MetricsCollector;
  private config: Required<CommandBusConfig>;
  private commandQueue: Command[] = [];
  private isProcessing: boolean = false;

  constructor(
    eventBus: EventBus,
    config: CommandBusConfig = {}
  ) {
    this.handlers = new Map();
    this.eventBus = eventBus;
    this.logger = new Logger('CommandBus');
    this.metrics = new MetricsCollector('command_bus');
    
    this.config = {
      enableAsync: config.enableAsync ?? true,
      enableValidation: config.enableValidation ?? true,
      enableMetrics: config.enableMetrics ?? true,
      timeout: config.timeout ?? 30000
    };

    if (this.config.enableAsync) {
      this.initializeKafkaProducer();
    }

    this.startProcessing();
  }

  /**
   * Initialize Kafka producer for async commands
   */
  private async initializeKafkaProducer(): Promise<void> {
    try {
      this.kafkaProducer = new KafkaProducer({
        idempotent: true,
        transactional: true
      });
      await this.kafkaProducer.connect();
      this.logger.info('Kafka producer initialized for async commands');
    } catch (error) {
      this.logger.error('Failed to initialize Kafka producer', error as Error);
    }
  }

  /**
   * Register a command handler
   */
  registerHandler(handler: CommandHandler): void {
    if (this.handlers.has(handler.commandType)) {
      throw new Error(`Handler already registered for command type: ${handler.commandType}`);
    }

    this.handlers.set(handler.commandType, handler);
    this.logger.info(`Command handler registered: ${handler.commandType}`);
  }

  /**
   * Execute a command synchronously
   */
  async execute(command: Command): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // Validate command structure
      this.validateCommandStructure(command);

      // Get handler
      const handler = this.handlers.get(command.commandType);
      if (!handler) {
        throw new Error(`No handler registered for command type: ${command.commandType}`);
      }

      // Validate command if enabled
      if (this.config.enableValidation) {
        await this.validateCommand(command, handler);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(handler, command);

      // Publish events if successful
      if (result.success && result.events) {
        for (const event of result.events) {
          await this.eventBus.publish(event);
        }
      }

      // Track metrics
      if (this.config.enableMetrics) {
        this.metrics.recordHistogram('command_execution_time', Date.now() - startTime);
        this.metrics.incrementCounter('commands_executed', {
          commandType: command.commandType,
          success: result.success.toString()
        });
      }

      return result;
    } catch (error) {
      this.metrics.incrementCounter('command_errors', {
        commandType: command.commandType
      });
      
      this.logger.error('Command execution failed', error as Error, {
        commandType: command.commandType,
        aggregateId: command.aggregateId
      });

      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Send command asynchronously via Kafka
   */
  async send(command: Command): Promise<void> {
    if (!this.config.enableAsync || !this.kafkaProducer) {
      throw new Error('Async commands not enabled');
    }

    const startTime = Date.now();

    try {
      // Validate command structure
      this.validateCommandStructure(command);

      // Send to Kafka
      await this.kafkaProducer.send(
        'backstage.commands',
        command as any,
        command.aggregateId
      );

      // Track metrics
      if (this.config.enableMetrics) {
        this.metrics.recordHistogram('command_send_time', Date.now() - startTime);
        this.metrics.incrementCounter('commands_sent', {
          commandType: command.commandType
        });
      }

      this.logger.debug(`Command sent: ${command.commandType}`, {
        commandId: command.commandId,
        aggregateId: command.aggregateId
      });
    } catch (error) {
      this.metrics.incrementCounter('command_send_errors', {
        commandType: command.commandType
      });
      
      this.logger.error('Failed to send command', error as Error);
      throw error;
    }
  }

  /**
   * Send batch of commands
   */
  async sendBatch(commands: Command[]): Promise<void> {
    if (!this.config.enableAsync || !this.kafkaProducer) {
      throw new Error('Async commands not enabled');
    }

    const startTime = Date.now();

    try {
      // Validate all commands
      for (const command of commands) {
        this.validateCommandStructure(command);
      }

      // Send batch to Kafka
      await this.kafkaProducer.sendBatch(
        'backstage.commands',
        commands as any[]
      );

      // Track metrics
      if (this.config.enableMetrics) {
        this.metrics.recordHistogram('command_batch_send_time', Date.now() - startTime);
        this.metrics.incrementCounter('command_batches_sent', {
          size: commands.length.toString()
        });
      }

      this.logger.info(`Command batch sent: ${commands.length} commands`);
    } catch (error) {
      this.metrics.incrementCounter('command_batch_send_errors');
      this.logger.error('Failed to send command batch', error as Error);
      throw error;
    }
  }

  /**
   * Queue command for processing
   */
  queue(command: Command): void {
    this.commandQueue.push(command);
    this.logger.debug(`Command queued: ${command.commandType}`);
  }

  /**
   * Start processing queued commands
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.isProcessing) {
      if (this.commandQueue.length === 0) {
        await this.sleep(100);
        continue;
      }

      const command = this.commandQueue.shift();
      if (!command) {
        continue;
      }

      try {
        await this.execute(command);
      } catch (error) {
        this.logger.error('Failed to process queued command', error as Error);
      }
    }
  }

  /**
   * Validate command structure
   */
  private validateCommandStructure(command: Command): void {
    if (!command.commandId) {
      throw new Error('Command ID is required');
    }

    if (!command.commandType) {
      throw new Error('Command type is required');
    }

    if (!command.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    if (!command.aggregateType) {
      throw new Error('Aggregate type is required');
    }

    if (!command.metadata) {
      throw new Error('Command metadata is required');
    }

    if (!command.metadata.correlationId) {
      throw new Error('Correlation ID is required');
    }
  }

  /**
   * Validate command against handler schema
   */
  private async validateCommand(command: Command, handler: CommandHandler): Promise<void> {
    // Use handler's custom validation if available
    if (handler.validate) {
      const isValid = await handler.validate(command);
      if (!isValid) {
        throw new Error('Command validation failed');
      }
    }

    // Use schema validation if available
    if (handler.schema) {
      try {
        handler.schema.parse(command.payload);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(`Schema validation failed: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw error;
      }
    }
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(
    handler: CommandHandler,
    command: Command
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command execution timeout: ${this.config.timeout}ms`));
      }, this.config.timeout);

      handler.handle(command)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get registered handlers
   */
  getHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get metrics
   */
  getMetrics(): any {
    return {
      queueSize: this.commandQueue.length,
      handlersCount: this.handlers.size,
      ...this.metrics.getMetrics()
    };
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    
    if (this.kafkaProducer) {
      await this.kafkaProducer.disconnect();
    }

    this.logger.info('Command bus stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Base class for command handlers
 */
export abstract class BaseCommandHandler<T = any> implements CommandHandler<T> {
  abstract commandType: string;
  schema?: z.ZodSchema<T>;

  abstract handle(command: Command): Promise<CommandResult>;

  protected createSuccessResult(
    aggregateId: string,
    version: number,
    events: any[]
  ): CommandResult {
    return {
      success: true,
      aggregateId,
      version,
      events
    };
  }

  protected createErrorResult(error: Error): CommandResult {
    return {
      success: false,
      error
    };
  }
}