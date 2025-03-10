/**
 * Constants for rate limiter config storage
 */

/**
 * Maximum number of versions to keep per rule
 */
export const VERSION_LIMIT = 20;

/**
 * Headers for JSON responses
 */
export const JSON_CONTENT_TYPE = { 'Content-Type': 'application/json' } as const;

/**
 * HTTP status codes used in the application
 */
export enum HttpStatus {
  OK = 200,
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * Cache time-to-live in milliseconds
 */
export const CACHE_TTL = 60000; // 1 minute

/**
 * Environment identifiers
 */
export enum Environment {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEVELOPMENT = 'development'
}

/**
 * Default environment
 */
export const DEFAULT_ENVIRONMENT = Environment.PRODUCTION;