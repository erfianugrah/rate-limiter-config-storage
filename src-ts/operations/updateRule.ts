/**
 * Update rule operation
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService } from '../services/index.js';
import { Env, Rule } from '../types/index.js';
import { isValidRuleStructure, logger } from '../utils/index.js';

/**
 * Updates an existing rule with new data
 * 
 * @param state - The Durable Object state
 * @param env - The environment
 * @param ruleId - The ID of the rule to update
 * @param updatedRule - The updated rule data
 * @returns A response indicating success or failure
 */
export async function updateRule(
  state: DurableObjectState, 
  env: Env, 
  ruleId: string, 
  updatedRule: Partial<Rule>
): Promise<Response> {
  try {
    logger.info('Updating rule', { ruleId });
    logger.debug('Updated rule data', updatedRule);
    
    // Validate the rule structure
    if (!isValidRuleStructure(updatedRule)) {
      logger.warn('Invalid rule structure received', updatedRule);
      return new Response(JSON.stringify({
        error: 'Invalid rule structure',
        details: 'The rule does not conform to the expected schema'
      }), {
        status: HttpStatus.BAD_REQUEST,
        headers: JSON_CONTENT_TYPE
      });
    }
    
    try {
      // Get current rule first to ensure it exists and merge with updates
      const currentRule = await configService.getRule(ruleId);
      
      if (!currentRule) {
        logger.warn('Rule not found', { ruleId });
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: HttpStatus.NOT_FOUND,
          headers: JSON_CONTENT_TYPE
        });
      }
      
      // Merge the current rule with updates to ensure we have a complete rule
      const completeRule: Rule = {
        ...currentRule,
        ...updatedRule,
        id: ruleId, // Ensure ID doesn't change
      };
      
      // Update the rule
      const newRule = await configService.updateRule(ruleId, completeRule);
      
      // Notify subscribers about the update
      await configService.notifyConfigUpdate();
      
      return new Response(JSON.stringify({ 
        message: 'Rule updated', 
        rule: newRule 
      }), {
        status: HttpStatus.OK,
        headers: JSON_CONTENT_TYPE
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Rule not found') {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: HttpStatus.NOT_FOUND,
          headers: JSON_CONTENT_TYPE
        });
      }
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating rule', error);
    return new Response(JSON.stringify({
      error: 'Failed to update rule',
      details: errorMessage
    }), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: JSON_CONTENT_TYPE
    });
  }
}