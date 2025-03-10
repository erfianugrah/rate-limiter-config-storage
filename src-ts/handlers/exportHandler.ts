/**
 * Export handler
 * 
 * Handles requests to export the configuration
 */
import { HttpStatus, JSON_CONTENT_TYPE } from '../constants/index.js';
import { exportConfig } from '../operations/exportConfig.js';
import { logger } from '../utils/index.js';

/**
 * Handle export request
 * 
 * @param request - The request object
 * @returns Response with the exported data
 */
export async function handleExport(request: Request): Promise<Response> {
  try {
    // Export the configuration
    const { data, filename } = await exportConfig();
    
    // Format the JSON with spacing for better readability
    const jsonData = JSON.stringify(data, null, 2);
    
    // Create response with appropriate headers for file download
    const response = new Response(jsonData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
    return response;
  } catch (error) {
    logger.error('Error handling export request', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to export configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}