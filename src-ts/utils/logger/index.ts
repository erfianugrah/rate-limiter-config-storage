/**
 * Structured logging utility for Cloudflare Workers
 */

/**
 * Log levels enum
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private prefix: string;
  
  /**
   * Create a new logger
   * 
   * @param prefix - The prefix to use for log messages
   */
  constructor(prefix = 'ConfigStorage') {
    this.prefix = prefix;
  }

  /**
   * Format a log message with a timestamp and prefix
   * 
   * @param message - The message to format
   * @returns The formatted message
   */
  private _formatMessage(message: string): string {
    return `[${this.prefix}] ${message}`;
  }

  /**
   * Format data for logging by safely stringifying objects
   * 
   * @param data - The data to format
   * @returns The formatted data
   */
  private _formatData(data: unknown): string {
    if (data === undefined) return '';
    
    if (data instanceof Error) {
      return data.stack || data.message;
    }
    
    if (typeof data === 'object' && data !== null) {
      try {
        // Handle circular references in the object
        const cache = new Set();
        return JSON.stringify(data, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
              return '[Circular]';
            }
            cache.add(value);
          }
          return value;
        }, 2);
      } catch (err) {
        return `[Unstringifiable Object: ${err instanceof Error ? err.message : 'Unknown error'}]`;
      }
    }
    
    return String(data);
  }

  /**
   * Debug level logging
   * 
   * @param message - The message to log
   * @param data - Optional data to log
   */
  debug(message: string, data?: unknown): void {
    console.debug(this._formatMessage(message), data !== undefined ? this._formatData(data) : '');
  }

  /**
   * Info level logging
   * 
   * @param message - The message to log
   * @param data - Optional data to log
   */
  info(message: string, data?: unknown): void {
    console.info(this._formatMessage(message), data !== undefined ? this._formatData(data) : '');
  }

  /**
   * Warning level logging
   * 
   * @param message - The message to log
   * @param data - Optional data to log
   */
  warn(message: string, data?: unknown): void {
    console.warn(this._formatMessage(message), data !== undefined ? this._formatData(data) : '');
  }

  /**
   * Error level logging
   * 
   * @param message - The message to log
   * @param error - The error or data to log
   */
  error(message: string, error: unknown): void {
    console.error(
      this._formatMessage(message), 
      error instanceof Error 
        ? error.stack || error.message 
        : this._formatData(error)
    );
  }
}

// Map of logger instances by prefix
const loggerInstances = new Map<string, Logger>();

/**
 * Get a logger instance for a specific prefix
 * 
 * @param prefix - The prefix to use
 * @returns The logger instance
 */
export function getLogger(prefix = 'ConfigStorage'): Logger {
  if (!loggerInstances.has(prefix)) {
    loggerInstances.set(prefix, new Logger(prefix));
  }
  
  // We know this exists because we just set it if it didn't
  return loggerInstances.get(prefix)!;
}

/**
 * Default logger instance
 */
export const logger = getLogger();