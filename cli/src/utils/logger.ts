import chalk from 'chalk';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export class Logger {
  private static instance: Logger;
  private winston: WinstonLogger;
  private level: LogLevel = 'info';

  private constructor() {
    this.winston = createLogger({
      level: this.level,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        // File transport for debugging
        new transports.File({
          filename: 'backstage-cli.log',
          level: 'debug',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          silent: process.env.NODE_ENV === 'test'
        })
      ]
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
    this.winston.level = level;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public error(message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(message, args);
    console.error(chalk.red('[ERROR] ' + formattedMessage));
    this.winston.error(formattedMessage, { args });
  }

  public warn(message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(message, args);
    console.warn(chalk.yellow('[WARN] ' + formattedMessage));
    this.winston.warn(formattedMessage, { args });
  }

  public info(message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(message, args);
    console.info(chalk.blue('[INFO] ' + formattedMessage));
    this.winston.info(formattedMessage, { args });
  }

  public success(message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(message, args);
    console.log(chalk.green(formattedMessage));
    this.winston.info(formattedMessage, { args });
  }

  public debug(message: string, ...args: any[]): void {
    if (this.level !== 'debug') return;
    
    const formattedMessage = this.formatMessage(message, args);
    console.debug(chalk.gray('[DEBUG] ' + formattedMessage));
    this.winston.debug(formattedMessage, { args });
  }

  public log(level: LogLevel, message: string, ...args: any[]): void {
    switch (level) {
      case 'error':
        this.error(message, ...args);
        break;
      case 'warn':
        this.warn(message, ...args);
        break;
      case 'info':
        this.info(message, ...args);
        break;
      case 'debug':
        this.debug(message, ...args);
        break;
    }
  }

  private formatMessage(message: string, args: any[]): string {
    if (args.length === 0) return message;
    
    // Simple string formatting
    let formatted = message;
    args.forEach((arg, index) => {
      const placeholder = `{${index}}`;
      if (formatted.includes(placeholder)) {
        formatted = formatted.replace(placeholder, String(arg));
      } else if (index === 0 && !formatted.includes('{0}')) {
        // If no placeholders, append first arg
        formatted += ` ${String(arg)}`;
      }
    });
    
    return formatted;
  }
}
