/**
 * Register all handlers with the router service
 */
import { routerService } from '../services/index.js';
import { handleGet } from './getHandler.js';
import { handlePost } from './postHandler.js';
import { handlePut } from './putHandler.js';
import { handleDelete } from './deleteHandler.js';
import { handleExport } from './exportHandler.js';

// Register handlers
routerService.registerHandler('GET', handleGet);
routerService.registerHandler('POST', handlePost);
routerService.registerHandler('PUT', handlePut);
routerService.registerHandler('DELETE', handleDelete);

// Export handler exports
export { handleExport };