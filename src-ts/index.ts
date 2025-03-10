/**
 * Entry point for the config storage service
 */
import { HttpStatus, JSON_CONTENT_TYPE } from './constants/index.js';
import { ConfigStorage } from './core/storage.js';
import { Env } from './types/index.js';
import { logger } from './utils/index.js';

// Import to register handlers
import './handlers/index.js'; 

/**
 * Export the ConfigStorage class for use as a Durable Object
 */
export { ConfigStorage };

/**
 * Worker interface
 */
export interface WorkerInterface {
  fetch(request: Request, env: Env): Promise<Response>;
}

/**
 * Default export for the worker
 */
export default {
  /**
   * Main fetch handler for the worker
   * 
   * @param request - The HTTP request
   * @param env - The environment
   * @returns The HTTP response
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      logger.info('Worker received request', { 
        url: request.url,
        method: request.method
      });
      
      const url = new URL(request.url);
      
      // Special handling for export endpoint at the worker level
      if (url.pathname === '/export') {
        // Import dynamically to avoid circular dependencies
        const { handleExport } = await import('./handlers/index.js');
        return handleExport(request);
      }
      
      // Get the Durable Object ID for the global config storage
      const configStorageId = env.CONFIG_STORAGE.idFromName('global');
      
      // Get the Durable Object instance
      const configStorage = env.CONFIG_STORAGE.get(configStorageId);
      
      // Here you might want to add authentication and authorization checks
      // before allowing access to the ConfigStorage
      
      // Forward the request to the Durable Object
      return await configStorage.fetch(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Error in worker fetch handler', error);
      return new Response(JSON.stringify({ 
        error: 'Server error', 
        details: errorMessage
      }), {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers: JSON_CONTENT_TYPE
      });
    }
  },
} satisfies WorkerInterface;