/**
 * GET request handler
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService } from '../services/index.js';
import { Env } from '../types/index.js';
import { logger, trackPerformance } from '../utils/index.js';

/**
 * Handle GET requests
 * 
 * @param request - The HTTP request
 * @param state - The Durable Object state
 * @param env - The environment
 * @param path - The request path
 * @returns The HTTP response
 */
export async function handleGet(
  request: Request, 
  state: DurableObjectState, 
  env: Env, 
  path: string
): Promise<Response> {
  return await trackPerformance('handleGet', async () => {
    logger.info('Handling GET request', { path });

    // Ensure path is a string
    if (typeof path !== 'string') {
      logger.error('Invalid path type', { type: typeof path });
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: HttpStatus.BAD_REQUEST,
        headers: JSON_CONTENT_TYPE
      });
    }

    // Route the request based on the path
    if (path === '/config') {
      try {
        // Parse pagination parameters if they exist
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        
        // Validate pagination parameters
        const validPage = !isNaN(page) && page > 0 ? page : 1;
        const validLimit = !isNaN(limit) && limit > 0 && limit <= 100 ? limit : 10;
        
        // Check if pagination is requested
        const hasPaginationParams = url.searchParams.has('page') || url.searchParams.has('limit');
        
        if (hasPaginationParams) {
          const paginatedConfig = await configService.getConfig({ page: validPage, limit: validLimit });
          return new Response(JSON.stringify(paginatedConfig), {
            headers: JSON_CONTENT_TYPE
          });
        } else {
          // No pagination requested, get all rules
          const config = await configService.getConfig();
          return new Response(JSON.stringify(config), {
            headers: JSON_CONTENT_TYPE
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error getting config', error);
        return new Response(JSON.stringify({
          error: 'Failed to retrieve config',
          details: errorMessage
        }), {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          headers: JSON_CONTENT_TYPE
        });
      }
    } else if (path.startsWith('/rules/')) {
      const ruleId = path.split('/')[2];
      
      try {
        const rule = await configService.getRule(ruleId);
        
        if (rule) {
          return new Response(JSON.stringify(rule), {
            headers: JSON_CONTENT_TYPE
          });
        }
        
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: HttpStatus.NOT_FOUND,
          headers: JSON_CONTENT_TYPE
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error getting rule', error);
        return new Response(JSON.stringify({
          error: 'Failed to retrieve rule',
          details: errorMessage
        }), {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          headers: JSON_CONTENT_TYPE
        });
      }
    } else if (path.startsWith('/versions/')) {
      const ruleId = path.split('/')[2];
      
      try {
        // Parse pagination parameters if they exist
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        
        // Validate pagination parameters
        const validPage = !isNaN(page) && page > 0 ? page : 1;
        const validLimit = !isNaN(limit) && limit > 0 && limit <= 100 ? limit : 10;
        
        // Check if pagination is requested
        const hasPaginationParams = url.searchParams.has('page') || url.searchParams.has('limit');
        
        if (hasPaginationParams) {
          const result = await configService.getRuleVersions(ruleId, { page: validPage, limit: validLimit });
          
          // Check if we got a paginated result or an empty array
          if ('versions' in result && result.versions.length > 0) {
            return new Response(JSON.stringify(result), {
              headers: JSON_CONTENT_TYPE
            });
          } else if ('versions' in result) {
            return new Response(JSON.stringify({ error: 'No versions found' }), {
              status: HttpStatus.NOT_FOUND,
              headers: JSON_CONTENT_TYPE
            });
          }
        } else {
          const versions = await configService.getRuleVersions(ruleId);
          
          if (Array.isArray(versions) && versions.length > 0) {
            return new Response(JSON.stringify({ versions }), {
              headers: JSON_CONTENT_TYPE
            });
          }
        }
        
        return new Response(JSON.stringify({ error: 'No versions found' }), {
          status: HttpStatus.NOT_FOUND,
          headers: JSON_CONTENT_TYPE
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error getting rule versions', error);
        return new Response(JSON.stringify({
          error: 'Failed to retrieve rule versions',
          details: errorMessage
        }), {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          headers: JSON_CONTENT_TYPE
        });
      }
    }

    logger.warn('GET request not found', { path });
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: HttpStatus.NOT_FOUND,
      headers: JSON_CONTENT_TYPE
    });
  });
}