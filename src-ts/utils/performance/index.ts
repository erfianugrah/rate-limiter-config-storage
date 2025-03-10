/**
 * Performance tracking utilities
 */
import { logger } from "../logger/index.js";

/**
 * Measures execution time of a function
 * 
 * @param name - Name of the function being measured
 * @param fn - The function to measure
 * @returns The result of the function
 */
export async function trackPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startTime = Date.now();
  try {
    return await fn();
  } finally {
    const duration = Date.now() - startTime;
    logger.info(`${name} execution time: ${duration}ms`);
  }
}

/**
 * Creates a function that wraps another function with performance tracking
 * 
 * @param name - Name of the function being measured
 * @param fn - The function to wrap
 * @returns The wrapped function
 */
export function withPerformanceTracking<T extends unknown[], R>(
  name: string, 
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    return await trackPerformance(name, () => fn(...args));
  };
}