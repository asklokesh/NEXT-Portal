/**
 * Logger Implementation
 */

export class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: any): void {
    console.log(`[${this.context}] INFO: ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    console.debug(`[${this.context}] DEBUG: ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[${this.context}] WARN: ${message}`, meta || '');
  }

  error(message: string, error?: Error, meta?: any): void {
    console.error(`[${this.context}] ERROR: ${message}`, error, meta || '');
  }
}