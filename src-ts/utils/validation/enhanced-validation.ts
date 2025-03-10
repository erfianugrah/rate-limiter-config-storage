/**
 * Enhanced validation utilities for rate limiter rules
 */
import { logger } from "../logger/index.js";
import { Rule, RuleAction, Condition, Fingerprint, RateLimit, Match } from "../../types/index.js";

/**
 * The result of a rule validation
 */
export class ValidationResult {
  /**
   * Whether the validation passed
   */
  valid = true;

  /**
   * List of validation errors
   */
  errors: Array<{ field: string; message: string }> = [];

  /**
   * List of validation warnings (non-critical issues)
   */
  warnings: Array<{ field: string; message: string }> = [];

  /**
   * Add an error to the validation result
   * 
   * @param field - The field that failed validation
   * @param message - The error message
   */
  addError(field: string, message: string): void {
    this.valid = false;
    this.errors.push({ field, message });
  }

  /**
   * Add a warning to the validation result
   * 
   * @param field - The field that has a warning
   * @param message - The warning message
   */
  addWarning(field: string, message: string): void {
    this.warnings.push({ field, message });
  }
}

/**
 * Validate that a field exists and has the correct type
 * 
 * @param rule - The rule object
 * @param field - The field to validate
 * @param expectedType - The expected type
 * @param result - The validation result to update
 * @param required - Whether the field is required
 */
function validateField(
  rule: Record<string, any>,
  field: string,
  expectedType: string,
  result: ValidationResult,
  required = true
): void {
  // Check if field exists
  if (!(field in rule)) {
    if (required) {
      result.addError(field, `Missing required field: ${field}`);
    }
    return;
  }
  
  // Check field type
  const value = rule[field];
  let actualType = typeof value;
  
  // Special handling for arrays
  if (Array.isArray(value)) {
    actualType = 'array' as typeof actualType;
  }
  // Special handling for null
  else if (value === null) {
    actualType = 'null' as typeof actualType;
  }
  
  if (actualType !== expectedType) {
    result.addError(field, `Invalid type for ${field}: expected ${expectedType}, got ${actualType}`);
  }
}

/**
 * Validate rate limit configuration
 * 
 * @param rateLimit - The rate limit object
 * @param result - The validation result to update
 */
function validateRateLimit(rateLimit: RateLimit | any, result: ValidationResult): void {
  if (!rateLimit || typeof rateLimit !== 'object') {
    result.addError('rateLimit', 'Missing or invalid rateLimit object');
    return;
  }
  
  validateField(rateLimit, 'limit', 'number', result);
  validateField(rateLimit, 'period', 'number', result);
  
  // Additional validation for rate limit values
  if (typeof rateLimit.limit === 'number' && rateLimit.limit <= 0) {
    result.addError('rateLimit.limit', 'Rate limit must be greater than 0');
  }
  
  if (typeof rateLimit.period === 'number' && rateLimit.period <= 0) {
    result.addError('rateLimit.period', 'Rate limit period must be greater than 0');
  }
}

/**
 * Validate fingerprint configuration
 * 
 * @param fingerprint - The fingerprint object
 * @param result - The validation result to update
 */
function validateFingerprint(fingerprint: Fingerprint | any, result: ValidationResult): void {
  if (!fingerprint || typeof fingerprint !== 'object') {
    result.addError('fingerprint', 'Missing or invalid fingerprint object');
    return;
  }
  
  // Validate parameters array
  if (!Array.isArray(fingerprint.parameters)) {
    result.addError('fingerprint.parameters', 'Fingerprint parameters must be an array');
    return;
  }
  
  // Check if parameters are valid
  if (fingerprint.parameters.length === 0) {
    result.addWarning('fingerprint.parameters', 'Fingerprint has no parameters, rule will apply to all requests');
  }
  
  // Check each parameter - allow both strings and objects with 'name' property
  fingerprint.parameters.forEach((param: any, index: number) => {
    if (typeof param !== 'string' && (typeof param !== 'object' || !param || typeof param.name !== 'string')) {
      result.addError(`fingerprint.parameters[${index}]`, 'Fingerprint parameter must be a string or an object with a name property');
    }
  });
}

/**
 * Validate condition object
 * 
 * @param condition - The condition object
 * @param index - The condition index (for error messages)
 * @param path - The path to the condition (for error messages)
 * @param result - The validation result to update
 */
function validateCondition(
  condition: Condition | any,
  index: number,
  path: string,
  result: ValidationResult
): void {
  if (!condition || typeof condition !== 'object') {
    result.addError(`${path}[${index}]`, 'Invalid condition object');
    return;
  }
  
  validateField(condition, 'field', 'string', result);
  validateField(condition, 'operator', 'string', result);
  validateField(condition, 'value', 'string', result, false);
  
  // Validate operator
  const validOperators = ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'matches', 'exists', 'notExists'];
  if (condition.operator && !validOperators.includes(condition.operator)) {
    result.addError(`${path}[${index}].operator`, `Invalid operator: ${condition.operator}. Must be one of: ${validOperators.join(', ')}`);
  }
  
  // Check if value is required for this operator
  const valueRequiredOperators = ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'matches'];
  if (valueRequiredOperators.includes(condition.operator) && !('value' in condition)) {
    result.addError(`${path}[${index}].value`, `Value is required for operator: ${condition.operator}`);
  }
  
  // Special validation for regex pattern
  if (condition.operator === 'matches' && condition.value) {
    try {
      new RegExp(condition.value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid regex pattern';
      result.addError(`${path}[${index}].value`, `Invalid regex pattern: ${errorMessage}`);
    }
  }
}

/**
 * Validate action object
 * 
 * @param action - The action object
 * @param path - The path to the action (for error messages)
 * @param result - The validation result to update
 */
function validateAction(action: RuleAction | any, path: string, result: ValidationResult): void {
  if (!action || typeof action !== 'object') {
    result.addError(path, 'Invalid action object');
    return;
  }
  
  validateField(action, 'type', 'string', result);
  
  // Validate action type
  const validTypes = ['block', 'allow', 'challenge', 'log', 'rateLimit'];
  if (action.type && !validTypes.includes(action.type)) {
    result.addError(`${path}.type`, `Invalid action type: ${action.type}. Must be one of: ${validTypes.join(', ')}`);
  }
  
  // Validate action-specific fields
  if (action.type === 'block') {
    validateField(action, 'status', 'number', result, false);
    if (action.status && (action.status < 400 || action.status > 599)) {
      result.addError(`${path}.status`, 'Block status must be a valid HTTP error code (400-599)');
    }
  }
}

/**
 * Validate match configuration (condition and action)
 * 
 * @param match - The match object
 * @param path - The path to the match (for error messages)
 * @param result - The validation result to update
 */
function validateMatch(match: Match | any, path: string, result: ValidationResult): void {
  if (!match || typeof match !== 'object') {
    result.addError(path, 'Invalid match object');
    return;
  }
  
  // Validate conditions
  if (!Array.isArray(match.conditions)) {
    result.addError(`${path}.conditions`, 'Conditions must be an array');
  } else {
    match.conditions.forEach((condition: Condition, index: number) => {
      validateCondition(condition, index, `${path}.conditions`, result);
    });
  }
  
  // Validate action
  validateAction(match.action, `${path}.action`, result);
}

/**
 * Validate rule ID for uniqueness
 * 
 * @param id - The rule ID to validate
 * @param existingIds - Array of existing rule IDs
 * @param result - The validation result to update
 * @param exemptId - An ID to exempt from uniqueness check (used when updating a rule)
 */
export function validateRuleId(
  id: string | undefined,
  existingIds: string[] = [],
  result: ValidationResult,
  exemptId: string | null = null
): void {
  if (!id) {
    result.addError('id', 'Rule ID is required');
    return;
  }
  
  if (typeof id !== 'string') {
    result.addError('id', 'Rule ID must be a string');
    return;
  }
  
  // Check if ID is unique
  if (existingIds.includes(id) && id !== exemptId) {
    result.addError('id', `Rule ID "${id}" already exists`);
  }
  
  // Check ID format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
    result.addError('id', 'Rule ID must contain only alphanumeric characters, hyphens, and underscores');
  }
}

/**
 * Enhanced validation for a rule
 * 
 * @param rule - The rule to validate
 * @param existingIds - Array of existing rule IDs (for uniqueness validation)
 * @param exemptId - An ID to exempt from uniqueness check (used when updating a rule)
 * @returns The validation result
 */
export function validateRule(
  rule: Rule | any,
  existingIds: string[] = [],
  exemptId: string | null = null
): ValidationResult {
  const result = new ValidationResult();
  
  if (!rule) {
    result.addError('rule', 'Rule is null or undefined');
    return result;
  }
  
  if (typeof rule !== 'object') {
    result.addError('rule', `Invalid rule type: ${typeof rule}`);
    return result;
  }
  
  // Validate basic fields
  validateRuleId(rule.id, existingIds, result, exemptId);
  validateField(rule, 'name', 'string', result);
  validateField(rule, 'description', 'string', result);
  validateField(rule, 'priority', 'number', result, false);
  
  // Validate dates if present
  if ('createdAt' in rule && !(new Date(rule.createdAt)).getTime()) {
    result.addError('createdAt', 'Invalid date format for createdAt');
  }
  
  if ('updatedAt' in rule && !(new Date(rule.updatedAt)).getTime()) {
    result.addError('updatedAt', 'Invalid date format for updatedAt');
  }
  
  // Validate complex objects
  validateRateLimit(rule.rateLimit, result);
  validateFingerprint(rule.fingerprint, result);
  validateMatch(rule.initialMatch, 'initialMatch', result);
  
  // Validate elseIfActions
  if (!Array.isArray(rule.elseIfActions)) {
    result.addError('elseIfActions', 'elseIfActions must be an array');
  } else {
    rule.elseIfActions.forEach((match: Match, index: number) => {
      validateMatch(match, `elseIfActions[${index}]`, result);
    });
  }
  
  // Validate elseAction if present
  if ('elseAction' in rule) {
    validateAction(rule.elseAction, 'elseAction', result);
  }
  
  return result;
}

/**
 * Validate an array of rules
 * 
 * @param rules - The rules to validate
 * @returns The validation result
 */
export function validateRules(rules: Rule[] | any): ValidationResult {
  const result = new ValidationResult();
  
  if (!Array.isArray(rules)) {
    result.addError('rules', `Expected array of rules, got ${typeof rules}`);
    return result;
  }
  
  // Extract all rule IDs for uniqueness validation
  const ruleIds = rules.map(rule => rule.id);
  
  // Validate each rule
  rules.forEach((rule: Rule, index: number) => {
    const ruleResult = validateRule(rule, ruleIds);
    
    // Copy errors and warnings with index prefix
    ruleResult.errors.forEach(error => {
      result.addError(`rules[${index}].${error.field}`, error.message);
    });
    
    ruleResult.warnings.forEach(warning => {
      result.addWarning(`rules[${index}].${warning.field}`, warning.message);
    });
    
    if (!ruleResult.valid) {
      result.valid = false;
    }
  });
  
  // Check for duplicate priorities
  const priorities = rules
    .filter((rule: Rule) => typeof rule.priority === 'number')
    .map((rule: Rule) => rule.priority);
  
  const uniquePriorities = new Set(priorities);
  if (priorities.length !== uniquePriorities.size) {
    result.addWarning('priorities', 'Multiple rules have the same priority value');
  }
  
  return result;
}

/**
 * Log validation errors and warnings
 * 
 * @param result - The validation result to log
 */
export function logValidationResult(result: ValidationResult): void {
  if (!result.valid) {
    logger.error('Validation failed with errors:', result.errors);
  }
  
  if (result.warnings.length > 0) {
    logger.warn('Validation warnings:', result.warnings);
  }
}