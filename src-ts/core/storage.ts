/**
 * Core storage module for the config storage service
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { configService, routerService } from '../services/index.js';
import { Env } from '../types/index.js';
import { logger, trackPerformance } from '../utils/index.js';

/**
 * ConfigStorage class that manages configuration data in Durable Objects
 */
export class ConfigStorage {
  /**
   * State and environment
   */
  private state: DurableObjectState;
  private env: Env;

  /**
   * Method to handle fetch requests
   */
  fetch: (request: Request) => Promise<Response>;

  /**
   * Constructor for ConfigStorage
   * 
   * @param state - The Durable Object state
   * @param env - The environment
   */
  constructor(state: DurableObjectState, env: Env) {
    logger.info('Initializing ConfigStorage');
    
    this.state = state;
    this.env = env;
    
    // Initialize services
    configService.setState(state, env);
    
    // Bind the fetch method to this instance
    this.fetch = this.handleRequest.bind(this);
    
    // Run migration asynchronously
    this.runMigration().catch(error => {
      logger.error('Error during migration', error);
    });
  }

  /**
   * Run migration from old storage format to new format
   * This is a one-time operation that happens when the service starts
   */
  private async runMigration(): Promise<void> {
    logger.info('Running migration check');
    try {
      const migrationResult = await configService.migrateFromOldFormat();
      if (migrationResult) {
        logger.info('Migration completed successfully or was not needed');
      } else {
        logger.warn('Migration failed or was incomplete');
      }
    } catch (error) {
      logger.error('Error during migration', error);
    }
  }

  /**
   * Handle incoming HTTP requests
   * 
   * @param request - The HTTP request
   * @returns The HTTP response
   */
  async handleRequest(request: Request): Promise<Response> {
    return await trackPerformance('ConfigStorage.handleRequest', async () => {
      try {
        logger.info('Received request', { 
          method: request.method, 
          url: request.url 
        });
        
        // Route the request to the appropriate handler
        return await routerService.routeRequest(request, this.state, this.env);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logger.error('Unhandled error in request handler', error);
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