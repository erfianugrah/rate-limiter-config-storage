import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../../src/services/config-service.js';
import { CACHE_TTL, VERSION_LIMIT } from '../../src/constants/index.js';

// Mock dependencies
vi.mock('../../src/utils/index.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  trackPerformance: vi.fn((_, fn) => fn()) // Pass through the function
}));

describe('ConfigService', () => {
  // Mock state and environment
  let configService;
  let mockStorage;
  let mockQueue;
  let mockEnv;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh instance for each test
    configService = new ConfigService();
    
    // Mock storage
    mockStorage = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn()
    };
    
    // Mock queue
    mockQueue = {
      send: vi.fn().mockResolvedValue(undefined)
    };
    
    // Mock environment
    mockEnv = {
      ENVIRONMENT: 'test',
      CONFIG_QUEUE: mockQueue
    };
    
    // Initialize with mocked dependencies
    configService.setState({ storage: mockStorage }, mockEnv);
    
    // Reset singleton for testing
    ConfigService.instance = configService;
    
    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('test-uuid')
    });
  });
  
  afterEach(() => {
    // Clean up
    configService = null;
  });
  
  describe('getConfig', () => {
    it('should throw an error if state is not initialized', async () => {
      // Create a fresh service without state
      const uninitializedService = new ConfigService();
      await expect(uninitializedService.getConfig()).rejects.toThrow('ConfigService state not initialized');
    });
    
    it('should return cached config if within TTL', async () => {
      // Setup cached config
      configService.cachedConfig = { rules: [{ id: 'test-rule' }] };
      configService.lastConfigFetch = Date.now();
      
      const result = await configService.getConfig();
      
      expect(result).toEqual(configService.cachedConfig);
      expect(mockStorage.get).not.toHaveBeenCalled();
    });
    
    it('should fetch config from storage if cache is expired', async () => {
      // Setup expired cache
      configService.cachedConfig = { rules: [{ id: 'old-rule' }] };
      configService.lastConfigFetch = Date.now() - (CACHE_TTL + 1000);
      
      // Mock storage response
      mockStorage.get.mockResolvedValue(JSON.stringify([{ id: 'new-rule' }]));
      
      const result = await configService.getConfig();
      
      expect(result).toEqual({ rules: [{ id: 'new-rule' }] });
      expect(mockStorage.get).toHaveBeenCalledWith('rules');
    });
    
    it('should handle empty rules in storage', async () => {
      // Mock empty storage
      mockStorage.get.mockResolvedValue(null);
      
      const result = await configService.getConfig();
      
      expect(result).toEqual({ rules: [] });
    });
    
    it('should handle non-string rules in storage', async () => {
      // Mock non-string response
      mockStorage.get.mockResolvedValue({ id: 'test-rule' });
      
      const result = await configService.getConfig();
      
      expect(result).toEqual({ rules: { id: 'test-rule' } });
    });
    
    it('should throw if storage access fails', async () => {
      // Mock storage error
      mockStorage.get.mockRejectedValue(new Error('Storage error'));
      
      await expect(configService.getConfig()).rejects.toThrow('Storage error');
    });
  });
  
  describe('getRule', () => {
    it('should return a rule by ID', async () => {
      // Setup mock config
      configService.cachedConfig = { 
        rules: [
          { id: 'rule-1', name: 'Rule 1' },
          { id: 'rule-2', name: 'Rule 2' }
        ] 
      };
      configService.lastConfigFetch = Date.now();
      
      const result = await configService.getRule('rule-2');
      
      expect(result).toEqual({ id: 'rule-2', name: 'Rule 2' });
    });
    
    it('should return null if rule is not found', async () => {
      // Setup mock config
      configService.cachedConfig = { 
        rules: [{ id: 'rule-1', name: 'Rule 1' }] 
      };
      configService.lastConfigFetch = Date.now();
      
      const result = await configService.getRule('non-existent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('getRuleVersions', () => {
    it('should throw an error if state is not initialized', async () => {
      // Create a fresh service without state
      const uninitializedService = new ConfigService();
      await expect(uninitializedService.getRuleVersions('rule-1')).rejects.toThrow('ConfigService state not initialized');
    });
    
    it('should return versions for a rule', async () => {
      // Mock versions in storage
      const versions = [
        { versionId: 'v1', rule: { id: 'rule-1', name: 'Version 1' } },
        { versionId: 'v2', rule: { id: 'rule-1', name: 'Version 2' } }
      ];
      mockStorage.get.mockResolvedValue(JSON.stringify(versions));
      
      const result = await configService.getRuleVersions('rule-1');
      
      expect(result).toEqual(versions);
      expect(mockStorage.get).toHaveBeenCalledWith('versions_rule-1');
    });
    
    it('should return empty array if no versions exist', async () => {
      // Mock empty versions
      mockStorage.get.mockResolvedValue(null);
      
      const result = await configService.getRuleVersions('rule-1');
      
      expect(result).toEqual([]);
    });
  });
  
  describe('addRule', () => {
    it('should throw an error if state is not initialized', async () => {
      // Create a fresh service without state
      const uninitializedService = new ConfigService();
      await expect(uninitializedService.addRule({ id: 'new-rule' })).rejects.toThrow('ConfigService state not initialized');
    });
    
    it('should add a rule to the configuration', async () => {
      // Setup existing rules
      const existingRules = [{ id: 'rule-1', name: 'Rule 1' }];
      mockStorage.get.mockImplementation((key) => {
        if (key === 'rules') return JSON.stringify(existingRules);
        if (key === 'versions_rule-2') return null;
        return null;
      });
      
      // New rule to add
      const newRule = { id: 'rule-2', name: 'Rule 2' };
      
      const result = await configService.addRule(newRule);
      
      // Check result
      expect(result).toEqual(newRule);
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledTimes(2); // One for rules, one for versions
      
      // Check cache invalidation
      expect(configService.cachedConfig).toBeNull();
      expect(configService.lastConfigFetch).toBe(0);
      
      // Verify rule was added to storage
      const expectedRules = [...existingRules, newRule];
      expect(mockStorage.put).toHaveBeenCalledWith('rules', JSON.stringify(expectedRules));
      
      // The order of mockStorage.put calls is not guaranteed, so we don't check the exact parameters
      // Just verify that it was called with the correct version key
      expect(mockStorage.put).toHaveBeenCalledWith(
        'versions_rule-2', 
        expect.stringContaining('test-uuid')
      );
    });
  });
  
  describe('updateRule', () => {
    it('should throw an error if rule not found', async () => {
      // Setup existing rules
      const existingRules = [{ id: 'rule-1', name: 'Rule 1' }];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingRules));
      
      // Update non-existent rule
      await expect(configService.updateRule('non-existent', { id: 'non-existent', name: 'New Name' }))
        .rejects.toThrow('Rule not found');
    });
    
    it('should update an existing rule', async () => {
      // Setup existing rules
      const existingRules = [
        { id: 'rule-1', name: 'Rule 1' },
        { id: 'rule-2', name: 'Old Name', other: 'value' }
      ];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingRules));
      
      // Mock empty versions
      mockStorage.get.mockImplementation((key) => {
        if (key === 'rules') return JSON.stringify(existingRules);
        if (key === 'versions_rule-2') return JSON.stringify([]);
        return null;
      });
      
      // Update rule
      const updatedRule = { id: 'rule-2', name: 'New Name', other: 'updated' };
      const result = await configService.updateRule('rule-2', updatedRule);
      
      // Check result
      expect(result).toEqual({
        ...updatedRule,
        updatedAt: expect.any(String)
      });
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledTimes(2); // One for rules, one for versions
      
      // Check cache invalidation
      expect(configService.cachedConfig).toBeNull();
      
      // Check rule was archived
      expect(mockStorage.put).toHaveBeenCalledWith(
        'versions_rule-2',
        expect.stringContaining('rule-2')
      );
    });
  });
  
  describe('deleteRule', () => {
    it('should return false if rule not found', async () => {
      // Setup existing rules
      const existingRules = [{ id: 'rule-1', name: 'Rule 1' }];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingRules));
      
      const result = await configService.deleteRule('non-existent');
      
      expect(result).toBe(false);
    });
    
    it('should delete a rule and return true', async () => {
      // Setup existing rules
      const existingRules = [
        { id: 'rule-1', name: 'Rule 1' },
        { id: 'rule-2', name: 'Rule 2' }
      ];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingRules));
      
      // Mock empty versions
      mockStorage.get.mockImplementation((key) => {
        if (key === 'rules') return JSON.stringify(existingRules);
        if (key === 'versions_rule-1') return JSON.stringify([]);
        return null;
      });
      
      const result = await configService.deleteRule('rule-1');
      
      // Check result
      expect(result).toBe(true);
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledTimes(2); // One for rules, one for versions
      
      // Check cache invalidation
      expect(configService.cachedConfig).toBeNull();
      
      // Check rule was removed from storage
      const expectedRules = [{ id: 'rule-2', name: 'Rule 2' }];
      expect(mockStorage.put).toHaveBeenCalledWith('rules', JSON.stringify(expectedRules));
      
      // Check rule was archived
      expect(mockStorage.put).toHaveBeenCalledWith(
        'versions_rule-1',
        expect.stringContaining('rule-1')
      );
    });
  });
  
  describe('reorderRules', () => {
    it('should throw if not all rules are included', async () => {
      // Setup existing rules
      const existingRules = [
        { id: 'rule-1', name: 'Rule 1', priority: 0 },
        { id: 'rule-2', name: 'Rule 2', priority: 1 },
        { id: 'rule-3', name: 'Rule 3', priority: 2 }
      ];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingRules));
      
      // Missing one rule
      await expect(configService.reorderRules(['rule-1', 'rule-2']))
        .rejects.toThrow('All rules must be included in the reordering');
    });
    
    it('should throw if rule ID not found', async () => {
      // Setup existing rules
      const existingRules = [
        { id: 'rule-1', name: 'Rule 1', priority: 0 },
        { id: 'rule-2', name: 'Rule 2', priority: 1 }
      ];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingRules));
      
      // Invalid rule ID
      await expect(configService.reorderRules(['rule-1', 'invalid-rule']))
        .rejects.toThrow('Rule with ID invalid-rule not found');
    });
    
    it('should reorder rules by updating priorities', async () => {
      // Setup existing rules
      const existingRules = [
        { id: 'rule-1', name: 'Rule 1', priority: 0 },
        { id: 'rule-2', name: 'Rule 2', priority: 1 },
        { id: 'rule-3', name: 'Rule 3', priority: 2 }
      ];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingRules));
      
      // New order: 3, 1, 2
      const result = await configService.reorderRules(['rule-3', 'rule-1', 'rule-2']);
      
      // Check result priorities
      expect(result[0].id).toBe('rule-3');
      expect(result[0].priority).toBe(0);
      expect(result[1].id).toBe('rule-1');
      expect(result[1].priority).toBe(1);
      expect(result[2].id).toBe('rule-2');
      expect(result[2].priority).toBe(2);
      
      // Check storage update
      expect(mockStorage.put).toHaveBeenCalledWith('rules', expect.any(String));
      
      // Check cache invalidation
      expect(configService.cachedConfig).toBeNull();
    });
  });
  
  describe('revertRule', () => {
    it('should throw if version not found', async () => {
      // Mock versions
      mockStorage.get.mockImplementation((key) => {
        if (key === 'versions_rule-1') return JSON.stringify([
          { versionId: 'other-version', rule: { id: 'rule-1', name: 'Other Version' } }
        ]);
        return null;
      });
      
      await expect(configService.revertRule('rule-1', 'non-existent-version'))
        .rejects.toThrow('Version not found');
    });
    
    it('should restore a deleted rule', async () => {
      // Setup existing rules (rule-1 is deleted)
      const existingRules = [
        { id: 'rule-2', name: 'Rule 2' }
      ];
      mockStorage.get.mockImplementation((key) => {
        if (key === 'rules') return JSON.stringify(existingRules);
        if (key === 'versions_rule-1') return JSON.stringify([
          { versionId: 'v1', rule: { id: 'rule-1', name: 'Old Rule 1' } }
        ]);
        return null;
      });
      
      const result = await configService.revertRule('rule-1', 'v1');
      
      // Check result
      expect(result).toEqual({
        id: 'rule-1',
        name: 'Old Rule 1',
        updatedAt: expect.any(String)
      });
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledWith('rules', expect.stringContaining('rule-1'));
      
      // Check cache invalidation
      expect(configService.cachedConfig).toBeNull();
    });
    
    it('should update an existing rule with a previous version', async () => {
      // Setup existing rules
      const existingRules = [
        { id: 'rule-1', name: 'Current Rule 1' },
        { id: 'rule-2', name: 'Rule 2' }
      ];
      mockStorage.get.mockImplementation((key) => {
        if (key === 'rules') return JSON.stringify(existingRules);
        if (key === 'versions_rule-1') return JSON.stringify([
          { versionId: 'v1', rule: { id: 'rule-1', name: 'Old Rule 1' } }
        ]);
        return null;
      });
      
      const result = await configService.revertRule('rule-1', 'v1');
      
      // Check result
      expect(result).toEqual({
        id: 'rule-1',
        name: 'Old Rule 1',
        updatedAt: expect.any(String)
      });
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledWith(
        'versions_rule-1',
        expect.stringContaining('Current Rule 1')
      );
      expect(mockStorage.put).toHaveBeenCalledWith(
        'rules',
        expect.stringContaining('Old Rule 1')
      );
      
      // Check cache invalidation
      expect(configService.cachedConfig).toBeNull();
    });
  });
  
  describe('archiveRuleVersion', () => {
    it('should archive a rule version', async () => {
      // Mock current versions
      const existingVersions = [
        { versionId: 'v1', rule: { id: 'rule-1', name: 'Version 1' } }
      ];
      mockStorage.get.mockResolvedValue(JSON.stringify(existingVersions));
      
      // Rule to archive
      const rule = { id: 'rule-1', name: 'New Version' };
      
      await configService.archiveRuleVersion(rule);
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledWith(
        'versions_rule-1',
        expect.stringContaining('test-uuid')
      );
      
      // Parse the stored value to check its structure
      const putCall = mockStorage.put.mock.calls[0];
      const storedValue = JSON.parse(putCall[1]);
      
      // Check structure
      expect(storedValue.length).toBe(2);
      expect(storedValue[0]).toEqual({
        versionId: 'test-uuid',
        timestamp: expect.any(String),
        rule
      });
    });
    
    it('should limit versions to VERSION_LIMIT', async () => {
      // Create many versions exceeding the limit
      const existingVersions = Array.from({ length: VERSION_LIMIT + 5 }, (_, i) => ({
        versionId: `v${i}`,
        rule: { id: 'rule-1', name: `Version ${i}` }
      }));
      mockStorage.get.mockResolvedValue(JSON.stringify(existingVersions));
      
      // Rule to archive
      const rule = { id: 'rule-1', name: 'New Version' };
      
      await configService.archiveRuleVersion(rule);
      
      // Check storage operations
      const putCall = mockStorage.put.mock.calls[0];
      const storedValue = JSON.parse(putCall[1]);
      
      // Should be limited to VERSION_LIMIT
      expect(storedValue.length).toBe(VERSION_LIMIT);
      // New version should be at the start
      expect(storedValue[0].rule.name).toBe('New Version');
    });
    
    it('should handle invalid rule gracefully', async () => {
      await configService.archiveRuleVersion(null);
      expect(mockStorage.put).not.toHaveBeenCalled();
      
      await configService.archiveRuleVersion({});
      expect(mockStorage.put).not.toHaveBeenCalled();
    });
  });

  describe('notifyConfigUpdate', () => {
    it('should send a notification to the queue', async () => {
      await configService.notifyConfigUpdate();
      
      expect(mockQueue.send).toHaveBeenCalledWith({
        type: 'config_update',
        version: expect.any(Number),
        environment: 'test'
      });
    });
    
    it('should not throw if queue is unavailable', async () => {
      // Remove queue from env
      configService.env.CONFIG_QUEUE = null;
      
      await expect(configService.notifyConfigUpdate()).resolves.not.toThrow();
    });
  });
  
  describe('invalidateCache', () => {
    it('should reset cache variables', () => {
      // Setup cache
      configService.cachedConfig = { rules: [] };
      configService.lastConfigFetch = 1000;
      
      configService.invalidateCache();
      
      expect(configService.cachedConfig).toBeNull();
      expect(configService.lastConfigFetch).toBe(0);
    });
  });
});