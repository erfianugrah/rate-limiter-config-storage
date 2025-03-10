/**
 * Reorder rules operation
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService } from '../services/index.js';
import { Env, Rule } from '../types/index.js';
import { isValidRuleStructure, logger } from '../utils/index.js';

/**
 * Reorders the rules based on the provided updated rules array
 * 
 * @param state - The Durable Object state
 * @param env - The environment
 * @param updatedRules - The array of rules with updated order
 * @returns A response indicating success or failure
 */
export async function reorderRules(
  state: DurableObjectState, 
  env: Env, 
  updatedRules: Rule[]
): Promise<Response> {
  try {
    logger.info('Reordering rules', { ruleCount: updatedRules.length });
    
    if (!Array.isArray(updatedRules)) {
      throw new Error('Invalid input: updatedRules must be an array');
    }
    
    // Validate each rule in the array
    for (const rule of updatedRules) {
      if (!isValidRuleStructure(rule)) {
        throw new Error('Invalid rule structure in the updated rules');
      }
    }
    
    // Extract rule IDs for reordering
    const ruleIds = updatedRules.map(rule => rule.id);
    const reorderedRules = await configService.reorderRules(ruleIds);
    
    // Notify subscribers about the update
    await configService.notifyConfigUpdate();
    
    return new Response(JSON.stringify({ 
      message: 'Rules reordered', 
      rules: reorderedRules 
    }), {
      status: HttpStatus.OK,
      headers: JSON_CONTENT_TYPE
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error reordering rules', error);
    return new Response(JSON.stringify({
      error: 'Failed to reorder rules',
      details: errorMessage
    }), {
      status: HttpStatus.BAD_REQUEST,
      headers: JSON_CONTENT_TYPE
    });
  }
}