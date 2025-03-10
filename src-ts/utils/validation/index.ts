/**
 * Validation utilities
 */
import { Rule } from "../../types/index.js";
import { logger } from "../logger/index.js";

/**
 * Type guard to check if an object matches the Rule interface structure
 * 
 * @param obj - Object to check
 * @returns Whether the object is a valid Rule
 */
export function isRule(obj: unknown): obj is Rule {
  if (!obj || typeof obj !== 'object') return false;
  
  const rule = obj as Partial<Rule>;
  
  return (
    typeof rule.id === 'string' &&
    typeof rule.name === 'string' &&
    typeof rule.description === 'string' &&
    !!rule.rateLimit &&
    typeof rule.rateLimit === 'object' &&
    typeof rule.rateLimit.limit === 'number' &&
    typeof rule.rateLimit.period === 'number' &&
    !!rule.fingerprint &&
    typeof rule.fingerprint === 'object' &&
    Array.isArray(rule.fingerprint.parameters) &&
    !!rule.initialMatch &&
    typeof rule.initialMatch === 'object' &&
    Array.isArray(rule.initialMatch.conditions) &&
    !!rule.initialMatch.action &&
    typeof rule.initialMatch.action === 'object' &&
    Array.isArray(rule.elseIfActions) &&
    (!rule.elseAction || typeof rule.elseAction === 'object')
  );
}

/**
 * Validates that a rule has the correct structure
 * 
 * @param rule - The rule to validate
 * @returns Whether the rule is valid
 */
export function isValidRuleStructure(rule: unknown): boolean {
  try {
    const isValid = isRule(rule);

    if (!isValid) {
      logger.warn("Invalid rule structure", rule);
    }

    return isValid;
  } catch (error) {
    logger.error("Error validating rule structure", error);
    return false;
  }
}

/**
 * Validates an array of rules
 * 
 * @param rules - The rules to validate
 * @returns Whether all rules are valid
 */
export function areValidRules(rules: unknown): boolean {
  try {
    if (!Array.isArray(rules)) {
      logger.warn("Rules is not an array", typeof rules);
      return false;
    }
    
    const isValid = rules.every((rule) => isValidRuleStructure(rule));
    
    if (!isValid) {
      logger.warn("One or more rules are invalid");
    }
    
    return isValid;
  } catch (error) {
    logger.error("Error validating rules", error);
    return false;
  }
}