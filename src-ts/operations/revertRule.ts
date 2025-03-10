/**
 * Revert rule operation
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService } from '../services/index.js';
import { Env, Rule } from '../types/index.js';
import { logger } from '../utils/index.js';

/**
 * Reverts a rule to a specified version
 * 
 * @param state - The Durable Object state
 * @param env - The environment
 * @param ruleId - The ID of the rule to revert
 * @param targetVersion - The version to revert to
 * @returns A response indicating success or failure
 */
export async function revertRule(
  state: DurableObjectState, 
  env: Env, 
  ruleId: string, 
  targetVersion: string
): Promise<Response> {
  try {
    logger.info('Reverting rule', { ruleId, targetVersion });
    
    const revertedRule = await configService.revertRule(ruleId, targetVersion);
    
    if (!revertedRule) {
      logger.warn('Rule or target version not found', { ruleId, targetVersion });
      return new Response(JSON.stringify({ 
        error: 'Rule or target version not found' 
      }), {
        status: HttpStatus.NOT_FOUND,
        headers: JSON_CONTENT_TYPE
      });
    }
    
    // Notify subscribers about the update
    await configService.notifyConfigUpdate();
    
    return new Response(JSON.stringify({ 
      message: 'Rule reverted', 
      rule: revertedRule 
    }), {
      status: HttpStatus.OK,
      headers: JSON_CONTENT_TYPE
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error reverting rule', error);
    return new Response(JSON.stringify({
      error: 'Failed to revert rule',
      details: errorMessage
    }), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: JSON_CONTENT_TYPE
    });
  }
}