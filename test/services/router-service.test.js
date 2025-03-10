import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routerService } from '../../src/services/router-service.js';
import { HttpStatus, JSON_CONTENT_TYPE } from '../../src/constants/index.js';

describe('RouterService', () => {
  beforeEach(() => {
    // Clear all handlers before each test
    routerService.handlers = new Map();
  });

  it('should register and use a handler for a specific HTTP method', async () => {
    // Create a mock handler that returns a simple response
    const mockHandler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        headers: JSON_CONTENT_TYPE
      })
    );

    // Register the handler for GET requests
    routerService.registerHandler('GET', mockHandler);

    // Create a mock request
    const request = new Request('https://example.com/test', {
      method: 'GET'
    });

    // Route the request
    const response = await routerService.routeRequest(request, {}, {});

    // Check that the handler was called
    expect(mockHandler).toHaveBeenCalledWith(request, {}, {}, '/test');

    // Check the response
    const responseData = await response.json();
    expect(responseData).toEqual({ success: true });
  });

  it('should return a 405 response for unregistered methods', async () => {
    // Create a mock request with an unregistered method
    const request = new Request('https://example.com/test', {
      method: 'PUT'
    });

    // Route the request
    const response = await routerService.routeRequest(request, {}, {});

    // Check the response
    expect(response.status).toBe(HttpStatus.METHOD_NOT_ALLOWED);
    const responseData = await response.json();
    expect(responseData).toEqual({ error: 'Method not allowed' });
  });

  it('should handle errors in handlers', async () => {
    // Create a mock handler that throws an error
    const mockHandler = vi.fn().mockRejectedValue(new Error('Test error'));

    // Register the handler for GET requests
    routerService.registerHandler('GET', mockHandler);

    // Create a mock request
    const request = new Request('https://example.com/test', {
      method: 'GET'
    });

    // Route the request
    const response = await routerService.routeRequest(request, {}, {});

    // Check the response
    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const responseData = await response.json();
    expect(responseData.error).toBe('Internal server error');
    expect(responseData.details).toBe('Test error');
  });
});