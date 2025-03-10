/**
 * Delete rule operation
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService } from '../services/index.js';
import { Env } from '../types/index.js';
import { logger } from '../utils/index.js';

/**
 * Deletes a rule from the config storage
 * 
 * @param state - The Durable Object state
 * @param env - The environment
 * @param ruleId - The ID of the rule to delete
 * @returns A response indicating success or failure
 */
export async function deleteRule(
  state: DurableObjectState, 
  env: Env, 
  ruleId: string
): Promise<Response> {
  try {
    logger.info('Deleting rule', { ruleId });
    
    const deletedRule = await configService.deleteRule(ruleId);
    
    if (!deletedRule) {
      logger.warn('Rule not found', { ruleId });
      return new Response(JSON.stringify({ error: 'Rule not found' }), {
        status: HttpStatus.NOT_FOUND,
        headers: JSON_CONTENT_TYPE
      });
    }
    
    // Notify subscribers about the update
    await configService.notifyConfigUpdate();
    
    return new Response(JSON.stringify({ 
      message: 'Rule deleted', 
      deletedRule 
    }), {
      status: HttpStatus.OK,
      headers: JSON_CONTENT_TYPE
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting rule', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete rule',
      details: errorMessage
    }), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: JSON_CONTENT_TYPE
    });
  }
}