/**
 * POST request handler
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService } from '../services/index.js';
import { Env, Rule } from '../types/index.js';
import { isValidRuleStructure, logger, trackPerformance } from '../utils/index.js';

/**
 * Handle POST requests to add a new rule
 * 
 * @param request - The HTTP request
 * @param state - The Durable Object state
 * @param env - The environment
 * @returns The HTTP response
 */
export async function handlePost(
  request: Request, 
  state: DurableObjectState, 
  env: Env
): Promise<Response> {
  return await trackPerformance('handlePost', async () => {
    try {
      logger.info('Handling POST request');
      
      // Parse the request body
      let rule: Partial<Rule>;
      try {
        rule = await request.json();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error parsing request body', error);
        return new Response(JSON.stringify({
          error: 'Invalid JSON in request body',
          details: errorMessage
        }), {
          status: HttpStatus.BAD_REQUEST,
          headers: JSON_CONTENT_TYPE
        });
      }
      
      logger.debug('Received rule', rule);
      
      // Validate the rule structure
      if (!isValidRuleStructure(rule)) {
        logger.warn('Invalid rule structure received', rule);
        return new Response(JSON.stringify({
          error: 'Invalid rule structure',
          details: 'The rule does not conform to the expected schema'
        }), {
          status: HttpStatus.BAD_REQUEST,
          headers: JSON_CONTENT_TYPE
        });
      }
      
      // Initialize metadata if needed
      if (!rule.createdAt) {
        rule.createdAt = new Date().toISOString();
      }
      
      if (!rule.updatedAt) {
        rule.updatedAt = new Date().toISOString();
      }
      
      // Add the rule using the config service
      try {
        const addedRule = await configService.addRule(rule as Rule);
        
        // Notify subscribers about the update
        await configService.notifyConfigUpdate();
        
        // Return the added rule
        return new Response(JSON.stringify(addedRule), {
          status: HttpStatus.OK,
          headers: JSON_CONTENT_TYPE
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error adding rule', error);
        return new Response(JSON.stringify({
          error: 'Failed to add rule',
          details: errorMessage
        }), {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          headers: JSON_CONTENT_TYPE
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Unexpected error in POST handler', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: errorMessage
      }), {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers: JSON_CONTENT_TYPE
      });
    }
  });
}