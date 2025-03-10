/**
 * Router Service
 * 
 * Handles routing of HTTP requests to the appropriate handlers
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { logger, trackPerformance } from '../utils/index.js';
import { Env } from '../types/index.js';

/**
 * Handler function type
 */
export type RequestHandler = (
  request: Request, 
  state: DurableObjectState, 
  env: Env, 
  path: string
) => Promise<Response>;

/**
 * Service for routing HTTP requests to the appropriate handlers
 */
export class RouterService {
  /**
   * Map of HTTP methods to handlers
   */
  public handlers = new Map<string, RequestHandler>();
  
  /**
   * Singleton instance
   */
  private static instance: RouterService;

  /**
   * Get the singleton instance of RouterService
   */
  static getInstance(): RouterService {
    if (!RouterService.instance) {
      RouterService.instance = new RouterService();
    }
    return RouterService.instance;
  }

  /**
   * Register a handler for a specific HTTP method
   * 
   * @param method - The HTTP method
   * @param handler - The handler function
   */
  registerHandler(method: string, handler: RequestHandler): void {
    this.handlers.set(method.toUpperCase(), handler);
    logger.debug(`Registered handler for ${method}`);
  }

  /**
   * Route a request to the appropriate handler
   * 
   * @param request - The HTTP request
   * @param state - The Durable Object state
   * @param env - The environment
   * @returns The HTTP response
   */
  async routeRequest(
    request: Request, 
    state: DurableObjectState, 
    env: Env
  ): Promise<Response> {
    return await trackPerformance('RouterService.routeRequest', async () => {
      try {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method.toUpperCase();

        logger.info(`Routing ${method} request`, { path });

        const handler = this.handlers.get(method);
        
        if (!handler) {
          logger.warn(`No handler registered for ${method}`);
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: HttpStatus.METHOD_NOT_ALLOWED,
            headers: JSON_CONTENT_TYPE
          });
        }

        return await handler(request, state, env, path);
      } catch (error) {
        logger.error('Error routing request', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
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
}

/**
 * Singleton instance of RouterService
 */
export const routerService = RouterService.getInstance();