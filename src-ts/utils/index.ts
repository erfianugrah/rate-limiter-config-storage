/**
 * Utility functions
 */
export { Logger, LogLevel, logger, getLogger } from './logger/index.js';
export { trackPerformance, withPerformanceTracking } from './performance/index.js';
export { isRule, isValidRuleStructure, areValidRules } from './validation/index.js';

/**
 * Safely stringifies an object, handling circular references
 * 
 * @param obj - The object to stringify
 * @param indent - The indentation level
 * @returns The stringified object
 */
export function safeStringify(obj: unknown, indent = 2): string {
  try {
    // Handle circular references
    const cache = new Set();
    const result = JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (cache.has(value)) {
            return "[Circular]";
          }
          cache.add(value);
        }
        return value;
      },
      indent
    );
    return result;
  } catch (error) {
    console.error("Error stringifying object:", error);
    return String(obj);
  }
}