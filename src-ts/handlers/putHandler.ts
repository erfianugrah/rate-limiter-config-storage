/**
 * PUT request handler
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { reorderRules, revertRule, updateRule } from '../operations/index.js';
import { Env, Rule } from '../types/index.js';
import { logger, trackPerformance } from '../utils/index.js';

/**
 * Handle PUT requests to update rules
 * 
 * @param request - The HTTP request
 * @param state - The Durable Object state
 * @param env - The environment
 * @param path - The request path
 * @returns The HTTP response
 */
export async function handlePut(
  request: Request, 
  state: DurableObjectState, 
  env: Env,
  path: string
): Promise<Response> {
  return await trackPerformance('handlePut', async () => {
    try {
      logger.info('Handling PUT request', { path });

      // Ensure path is a string
      if (typeof path !== 'string') {
        logger.error('Invalid path type', { type: typeof path });
        return new Response(JSON.stringify({ error: 'Invalid path' }), {
          status: HttpStatus.BAD_REQUEST,
          headers: JSON_CONTENT_TYPE
        });
      }

      // Reorder rules
      if (path === '/config/reorder') {
        logger.info('Reordering rules');
        
        try {
          const { rules } = await request.json() as { rules: Rule[] };
          return reorderRules(state, env, rules);
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
      } 
      // Handle rule operations
      else if (path.startsWith('/rules/')) {
        const parts = path.split('/');
        const ruleId = parts[2];
        
        // Revert rule to previous version
        if (parts[3] === 'revert') {
          logger.info('Reverting rule', { ruleId });
          
          try {
            const { targetVersion } = await request.json() as { targetVersion: string };
            return revertRule(state, env, ruleId, targetVersion);
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
        } 
        // Update rule
        else {
          logger.info('Updating rule', { ruleId });
          
          try {
            const rule = await request.json() as Rule;
            return updateRule(state, env, ruleId, rule);
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
        }
      }

      logger.warn('PUT request not found', { path });
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: HttpStatus.NOT_FOUND,
        headers: JSON_CONTENT_TYPE
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Unexpected error in PUT handler', error);
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