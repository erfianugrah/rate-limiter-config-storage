/**
 * Get rule operations
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService } from '../services/index.js';
import { logger } from '../utils/index.js';

/**
 * Retrieves a specific rule by ID
 * 
 * @param state - The Durable Object state
 * @param ruleId - The ID of the rule to retrieve
 * @returns A response containing the rule or an error
 */
export async function getRule(
  state: DurableObjectState, 
  ruleId: string
): Promise<Response> {
  try {
    logger.info('Getting rule', { ruleId });
    
    const rule = await configService.getRule(ruleId);
    
    if (rule) {
      return new Response(JSON.stringify(rule), {
        headers: JSON_CONTENT_TYPE
      });
    }
    
    logger.warn('Rule not found', { ruleId });
    return new Response(JSON.stringify({ error: 'Rule not found' }), {
      status: HttpStatus.NOT_FOUND,
      headers: JSON_CONTENT_TYPE
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error retrieving rule', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve rule',
      details: errorMessage
    }), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: JSON_CONTENT_TYPE
    });
  }
}

/**
 * Retrieves all versions of a specific rule
 * 
 * @param state - The Durable Object state
 * @param ruleId - The ID of the rule to retrieve versions for
 * @returns A response containing the rule versions or an error
 */
export async function getRuleVersions(
  state: DurableObjectState, 
  ruleId: string
): Promise<Response> {
  try {
    logger.info('Getting rule versions', { ruleId });
    
    const versions = await configService.getRuleVersions(ruleId);
    
    if (versions.length > 0) {
      return new Response(JSON.stringify({ versions }), {
        headers: JSON_CONTENT_TYPE
      });
    }
    
    logger.warn('No versions found', { ruleId });
    return new Response(JSON.stringify({ error: 'No versions found' }), {
      status: HttpStatus.NOT_FOUND,
      headers: JSON_CONTENT_TYPE
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error retrieving rule versions', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve rule versions',
      details: errorMessage
    }), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: JSON_CONTENT_TYPE
    });
  }
}