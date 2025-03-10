import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService, configService } from '../../src-ts/services/config-service.js';
import { Config, Rule } from '../../src-ts/types/index.js';

describe('ConfigService', () => {
  let mockState: any;
  let mockEnv: any;
  
  beforeEach(() => {
    // Mock console methods to avoid unnecessary logs
    console.debug = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Mock the Durable Object state
    mockState = {
      storage: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      }
    };
    
    // Mock the environment
    mockEnv = {
      CONFIG_QUEUE: {
        send: vi.fn()
      }
    };
    
    // Initialize the config service with mocks
    configService.setState(mockState, mockEnv);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('getConfig', () => {
    it('should return cached config if available and fresh', async () => {
      // Set up cached config via a private property hack
      (configService as any).cachedConfig = { rules: [{ id: 'test' }] };
      (configService as any).lastConfigFetch = Date.now();
      
      const config = await configService.getConfig();
      
      expect(config).toEqual({ rules: [{ id: 'test' }] });
      expect(mockState.storage.get).not.toHaveBeenCalled();
    });
    
    it('should fetch from storage if cache is not available', async () => {
      // Clear the cache
      (configService as any).cachedConfig = null;
      (configService as any).lastConfigFetch = 0;
      
      // Mock storage response
      mockState.storage.get.mockResolvedValue(JSON.stringify([{ id: 'test2' }]));
      
      const config = await configService.getConfig();
      
      expect(config).toEqual({ rules: [{ id: 'test2' }] });
      expect(mockState.storage.get).toHaveBeenCalledWith('rules');
    });
    
    it('should handle empty rules', async () => {
      // Clear the cache
      (configService as any).cachedConfig = null;
      (configService as any).lastConfigFetch = 0;
      
      // Mock empty storage response
      mockState.storage.get.mockResolvedValue(null);
      
      const config = await configService.getConfig();
      
      expect(config).toEqual({ rules: [] });
      expect(mockState.storage.get).toHaveBeenCalledWith('rules');
    });
  });
  
  describe('getRule', () => {
    it('should return a rule if it exists', async () => {
      const mockRule = { id: 'rule1', name: 'Test Rule' } as Rule;
      
      // Mock getConfig to return a specific rule
      vi.spyOn(configService, 'getConfig').mockResolvedValue({ 
        rules: [mockRule] 
      });
      
      const rule = await configService.getRule('rule1');
      
      expect(rule).toEqual(mockRule);
      expect(configService.getConfig).toHaveBeenCalled();
    });
    
    it('should return null if rule does not exist', async () => {
      // Mock getConfig to return no matching rule
      vi.spyOn(configService, 'getConfig').mockResolvedValue({ 
        rules: [{ id: 'other-rule' } as Rule] 
      });
      
      const rule = await configService.getRule('rule1');
      
      expect(rule).toBeNull();
      expect(configService.getConfig).toHaveBeenCalled();
    });
  });
  
  describe('notifyConfigUpdate', () => {
    it('should send a message to the queue', async () => {
      await configService.notifyConfigUpdate();
      
      expect(mockEnv.CONFIG_QUEUE.send).toHaveBeenCalledWith({
        type: 'config_update',
        version: expect.any(Number),
        environment: 'production'
      });
    });
    
    it('should not fail if queue is not available', async () => {
      // Remove the queue
      mockEnv.CONFIG_QUEUE = undefined;
      
      await expect(configService.notifyConfigUpdate()).resolves.not.toThrow();
      
      expect(console.warn).toHaveBeenCalled();
    });
  });
  
  describe('invalidateCache', () => {
    it('should clear the cache', () => {
      // Set up the cache
      (configService as any).cachedConfig = { rules: [] };
      (configService as any).lastConfigFetch = Date.now();
      
      configService.invalidateCache();
      
      expect((configService as any).cachedConfig).toBeNull();
      expect((configService as any).lastConfigFetch).toBe(0);
    });
  });
  
  // Add more tests for other methods like addRule, updateRule, etc.
});