/**
 * DELETE request handler
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { deleteRule } from '../operations/deleteRule.js';
import { Env } from '../types/index.js';
import { logger, trackPerformance } from '../utils/index.js';

/**
 * Handle DELETE requests to remove a rule
 * 
 * @param request - The HTTP request
 * @param state - The Durable Object state
 * @param env - The environment
 * @param path - The request path
 * @returns The HTTP response
 */
export async function handleDelete(
  request: Request, 
  state: DurableObjectState, 
  env: Env,
  path: string
): Promise<Response> {
  return await trackPerformance('handleDelete', async () => {
    try {
      logger.info('Handling DELETE request', { path });

      // Ensure path is a string
      if (typeof path !== 'string') {
        logger.error('Invalid path type', { type: typeof path });
        return new Response(JSON.stringify({ error: 'Invalid path' }), {
          status: HttpStatus.BAD_REQUEST,
          headers: JSON_CONTENT_TYPE
        });
      }

      if (path.startsWith('/rules/')) {
        const ruleId = path.split('/')[2];
        logger.info('Deleting rule', { ruleId });
        
        return deleteRule(state, env, ruleId);
      }

      logger.warn('DELETE request not found', { path });
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: HttpStatus.NOT_FOUND,
        headers: JSON_CONTENT_TYPE
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Unexpected error in DELETE handler', error);
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