import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLogger, Logger } from '../../src-ts/utils/logger/index.js';

describe('Logger', () => {
  let logger: Logger;
  
  // Mock console methods
  beforeEach(() => {
    logger = getLogger('TestLogger');
    
    // Mock console methods
    console.debug = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });
  
  // Reset mocks after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should create a logger with a prefix', () => {
    expect(logger).toBeDefined();
    expect(logger.prefix).toBe('TestLogger');
  });
  
  it('should log debug messages', () => {
    logger.debug('Test debug message');
    expect(console.debug).toHaveBeenCalledWith('[TestLogger] Test debug message', '');
    
    logger.debug('Test debug message with data', { test: 'data' });
    expect(console.debug).toHaveBeenCalledWith('[TestLogger] Test debug message with data', expect.stringContaining('"test": "data"'));
  });
  
  it('should log info messages', () => {
    logger.info('Test info message');
    expect(console.info).toHaveBeenCalledWith('[TestLogger] Test info message', '');
    
    logger.info('Test info message with data', { test: 'data' });
    expect(console.info).toHaveBeenCalledWith('[TestLogger] Test info message with data', expect.stringContaining('"test": "data"'));
  });
  
  it('should log warning messages', () => {
    logger.warn('Test warning message');
    expect(console.warn).toHaveBeenCalledWith('[TestLogger] Test warning message', '');
    
    logger.warn('Test warning message with data', { test: 'data' });
    expect(console.warn).toHaveBeenCalledWith('[TestLogger] Test warning message with data', expect.stringContaining('"test": "data"'));
  });
  
  it('should log error messages', () => {
    logger.error('Test error message', new Error('Test error'));
    expect(console.error).toHaveBeenCalledWith('[TestLogger] Test error message', expect.stringContaining('Test error'));
    
    logger.error('Test error message with data', { test: 'error data' });
    expect(console.error).toHaveBeenCalledWith('[TestLogger] Test error message with data', expect.stringContaining('"test": "error data"'));
  });
  
  it('should handle circular references in objects', () => {
    const circularObj: any = { a: 1 };
    circularObj.self = circularObj;
    
    logger.debug('Message with circular object', circularObj);
    expect(console.debug).toHaveBeenCalledWith('[TestLogger] Message with circular object', expect.stringContaining('"self": "[Circular]"'));
  });

  it('should create different logger instances for different prefixes', () => {
    const logger1 = getLogger('Logger1');
    const logger2 = getLogger('Logger2');
    const logger1Again = getLogger('Logger1');
    
    expect(logger1).not.toBe(logger2);
    expect(logger1).toBe(logger1Again);
    expect(logger1.prefix).toBe('Logger1');
    expect(logger2.prefix).toBe('Logger2');
  });
});