/**
 * Type definitions for the config storage service
 */

/**
 * Represents a rule action type
 */
export enum ActionType {
  BLOCK = 'block',
  ALLOW = 'allow',
  LOG = 'log',
  CHALLENGE = 'challenge',
  RATE_LIMIT = 'rateLimit',
}

/**
 * Represents a comparison operator
 */
export enum OperatorType {
  EQUALS = 'equals',
  NOT_EQUALS = 'notEquals',
  GREATER_THAN = 'greaterThan',
  LESS_THAN = 'lessThan',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'notContains',
  MATCHES = 'matches', // regex
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  EXISTS = 'exists',
  NOT_EXISTS = 'notExists',
}

/**
 * Represents an action in a rule
 */
export interface Action {
  /** The type of action to perform */
  type: ActionType | string;
  /** The parameters for the action */
  parameters?: Record<string, unknown>;
}

/**
 * Represents an improved rule action with specific properties
 */
export interface RuleAction {
  /** The type of action to perform */
  type: string;
  /** Status code for block actions */
  status?: number;
  /** Throttle limit - now optional for rateLimit actions since it's defined at the rule level */
  limit?: number;
  /** Additional parameters */
  [key: string]: unknown;
}

/**
 * Represents a condition in a rule
 */
export interface Condition {
  /** The field to check */
  field: string;
  /** The operator to use */
  operator: string;
  /** The value to compare */
  value?: string | number | boolean;
}

/**
 * Represents rate limit settings
 */
export interface RateLimit {
  /** The maximum number of requests */
  limit: number;
  /** The time period in seconds */
  period: number;
}

/**
 * Represents a fingerprint parameter
 */
export interface FingerprintParameter {
  /** The name of the parameter */
  name: string;
  /** Optional header name */
  headerName?: string;
  /** Optional header value */
  headerValue?: string;
  /** Optional cookie name */
  cookieName?: string;
  /** Optional cookie value */
  cookieValue?: string;
  /** Optional body field */
  bodyField?: string;
  /** Optional body field name */
  bodyFieldName?: string;
}

/**
 * Represents fingerprint settings
 */
export interface Fingerprint {
  /** The parameters to use for fingerprinting */
  parameters: (string | FingerprintParameter)[];
}

/**
 * Represents a match rule in a rule
 */
export interface MatchRule {
  /** The conditions to match */
  conditions: Condition[];
  /** The action to take if matched */
  action: Action;
}

/**
 * Represents an improved match rule
 */
export interface Match {
  /** The conditions to match */
  conditions: Condition[];
  /** The action to take if matched */
  action: RuleAction;
}

/**
 * Represents a rate limiting rule
 */
export interface Rule {
  /** The unique identifier for the rule */
  id: string;
  /** The name of the rule */
  name: string;
  /** The description of the rule */
  description: string;
  /** The rate limit settings */
  rateLimit: RateLimit;
  /** The fingerprint settings */
  fingerprint: Fingerprint;
  /** The initial match rule */
  initialMatch: Match;
  /** The else-if match rules */
  elseIfActions: Match[];
  /** The else action (optional) */
  elseAction?: RuleAction;
  /** The priority of the rule */
  priority?: number;
  /** The creation timestamp */
  createdAt?: string;
  /** The last update timestamp */
  updatedAt?: string;
}

/**
 * Represents a version of a rule
 */
export interface RuleVersion {
  /** The unique identifier for the version */
  versionId: string;
  /** The timestamp of the version */
  timestamp: string;
  /** The rule data */
  rule: Rule;
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  /** The page number (1-based) */
  page: number;
  /** The number of items per page */
  limit: number;
}

/**
 * Pagination metadata for responses
 */
export interface PaginationMeta {
  /** The current page */
  currentPage: number;
  /** The number of items per page */
  pageSize: number;
  /** The total number of items */
  totalItems: number;
  /** The total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPrevPage: boolean;
}

/**
 * Paginated response for rules
 */
export interface PaginatedRules {
  /** Array of rules for the current page */
  rules: Rule[];
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Paginated response for rule versions
 */
export interface PaginatedVersions {
  /** Array of rule versions for the current page */
  versions: RuleVersion[];
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Configuration object containing all rules
 */
export interface Config {
  /** Array of all rate limiting rules */
  rules: Rule[];
}

/**
 * Environment bindings for the worker
 */
export interface Env extends Environment {
  /** Durable Object namespace for config storage */
  CONFIG_STORAGE: DurableObjectNamespace;
}

/**
 * Environment type for services
 */
export interface Environment {
  /** Durable Object namespace for config storage */
  CONFIG_STORAGE?: DurableObjectNamespace;
  /** Queue for config updates */
  CONFIG_QUEUE?: Queue;
  /** Environment name */
  ENVIRONMENT?: string;
  /** Any additional environment variables */
  [key: string]: unknown;
}

/**
 * Durable Object state interface
 */
export interface DurableObjectState {
  /** Storage for the Durable Object */
  storage: {
    get(key: string): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<boolean>;
  };
}

/**
 * Config update message format
 */
export interface ConfigUpdateMessage {
  /** Message type */
  type: 'config_update';
  /** Version timestamp */
  version: number;
  /** Environment (optional) */
  environment?: string;
}