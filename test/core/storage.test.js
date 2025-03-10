import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigStorage } from '../../src/core/storage.js';
import { HttpStatus } from '../../src/constants/index.js';

// Mock dependencies
vi.mock('../../src/services/index.js', () => ({
  configService: {
    setState: vi.fn(),
    migrateFromOldFormat: vi.fn().mockResolvedValue(true)
  },
  routerService: {
    routeRequest: vi.fn()
  }
}));

// Import mocked services
import { configService, routerService } from '../../src/services/index.js';

vi.mock('../../src/utils/index.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  trackPerformance: vi.fn((_, fn) => fn()) // Pass through the function
}));

describe('ConfigStorage', () => {
  let configStorage;
  let mockState;
  let mockEnv;
  let mockRequest;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock state
    mockState = {
      storage: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };
    
    // Mock environment
    mockEnv = {
      ENVIRONMENT: 'test'
    };
    
    // Mock request
    mockRequest = new Request('https://example.com/test', {
      method: 'GET'
    });
    
    // Create instance
    configStorage = new ConfigStorage(mockState, mockEnv);
  });
  
  it('should initialize services and attempt migration', () => {
    expect(configService.setState).toHaveBeenCalledWith(mockState, mockEnv);
    // Migration should have been started (but as it's async, we can't check completion)
  });
  
  it('should route requests to the router service', async () => {
    // Mock successful routing
    routerService.routeRequest.mockResolvedValue(new Response('Success', { status: 200 }));
    
    const response = await configStorage.handleRequest(mockRequest);
    
    expect(routerService.routeRequest).toHaveBeenCalledWith(mockRequest, mockState, mockEnv);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Success');
  });
  
  it('should handle errors gracefully', async () => {
    // Mock routing error
    routerService.routeRequest.mockRejectedValue(new Error('Test error'));
    
    const response = await configStorage.handleRequest(mockRequest);
    
    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const responseData = await response.json();
    expect(responseData.error).toBe('Internal server error');
    expect(responseData.details).toBe('Test error');
  });
});