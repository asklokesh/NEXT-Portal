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
    console.error(chalk.red('✗ ' + formattedMessage));
    this.winston.error(formattedMessage, { args });
  }

  public warn(message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(message, args);
    console.warn(chalk.yellow('⚠ ' + formattedMessage));
    this.winston.warn(formattedMessage, { args });
  }

  public info(message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(message, args);
    console.info(chalk.blue('ℹ ' + formattedMessage));
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
    console.debug(chalk.gray('🔍 ' + formattedMessage));
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

  public table(data: any[][], options?: { title?: string }): void {
    if (options?.title) {
      console.log(chalk.bold(options.title));
    }
    
    // Simple table formatting for arrays
    if (data.length === 0) return;
    
    const columnWidths = data[0].map((_, colIndex) => 
      Math.max(...data.map(row => String(row[colIndex] || '').length))
    );
    
    data.forEach((row, rowIndex) => {
      const formattedRow = row.map((cell, colIndex) => {
        const cellStr = String(cell || '');
        return rowIndex === 0 
          ? chalk.bold(cellStr.padEnd(columnWidths[colIndex]))
          : cellStr.padEnd(columnWidths[colIndex]);
      }).join(' │ ');
      
      console.log(formattedRow);
      
      // Add separator after header
      if (rowIndex === 0 && data.length > 1) {
        console.log(columnWidths.map(width => '─'.repeat(width)).join('─┼─'));
      }
    });
  }

  public json(data: any, pretty: boolean = true): void {
    const jsonStr = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    console.log(jsonStr);
    this.winston.info('JSON output', { data });
  }

  public yaml(data: any): void {
    const yaml = require('js-yaml');
    const yamlStr = yaml.dump(data, { indent: 2 });
    console.log(yamlStr);
    this.winston.info('YAML output', { data });
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

  public startSpinner(message: string): { succeed: (message?: string) => void; fail: (message?: string) => void; stop: () => void } {
    const ora = require('ora');
    const spinner = ora(message).start();
    
    return {
      succeed: (msg?: string) => {
        spinner.succeed(msg || message);
        this.winston.info(`Spinner succeeded: ${msg || message}`);
      },
      fail: (msg?: string) => {
        spinner.fail(msg || message);
        this.winston.error(`Spinner failed: ${msg || message}`);
      },
      stop: () => {
        spinner.stop();
        this.winston.info(`Spinner stopped: ${message}`);
      }
    };
  }

  public prompt(questions: any[]): Promise<any> {
    const inquirer = require('inquirer');
    return inquirer.prompt(questions);
  }

  public confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    return this.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue
    }]).then(answers => answers.confirmed);
  }

  public select(message: string, choices: string[] | { name: string; value: any }[]): Promise<any> {
    return this.prompt([{
      type: 'list',
      name: 'selected',
      message,
      choices
    }]).then(answers => answers.selected);
  }

  public input(message: string, defaultValue?: string): Promise<string> {
    return this.prompt([{
      type: 'input',
      name: 'input',
      message,
      default: defaultValue
    }]).then(answers => answers.input);
  }
}