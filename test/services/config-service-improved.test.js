import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../../src/services/config-service-improved.js';
import { CACHE_TTL, VERSION_LIMIT } from '../../src/constants/index.js';

// Constants from config-service-improved.js
const RULE_PREFIX = 'rule_';
const RULE_IDS_KEY = 'rule_ids';
const VERSION_PREFIX = 'versions_';

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

describe('ConfigService (Improved)', () => {
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
      delete: vi.fn().mockResolvedValue(undefined)
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
    
    it('should return empty rules if no rule IDs', async () => {
      // Mock empty rule IDs
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return '[]';
        return null;
      });
      
      const result = await configService.getConfig();
      
      expect(result).toEqual({ rules: [] });
      expect(mockStorage.get).toHaveBeenCalledWith(RULE_IDS_KEY);
    });
    
    it('should fetch and combine individual rules', async () => {
      // Mock rule IDs
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2']);
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify({ id: 'rule1', name: 'Rule 1', priority: 1 });
        if (key === `${RULE_PREFIX}rule2`) return JSON.stringify({ id: 'rule2', name: 'Rule 2', priority: 0 });
        return null;
      });
      
      const result = await configService.getConfig();
      
      // Should be sorted by priority
      expect(result).toEqual({ 
        rules: [
          { id: 'rule2', name: 'Rule 2', priority: 0 },
          { id: 'rule1', name: 'Rule 1', priority: 1 }
        ] 
      });
      
      // Should fetch rule IDs and each rule
      expect(mockStorage.get).toHaveBeenCalledWith(RULE_IDS_KEY);
      expect(mockStorage.get).toHaveBeenCalledWith(`${RULE_PREFIX}rule1`);
      expect(mockStorage.get).toHaveBeenCalledWith(`${RULE_PREFIX}rule2`);
    });
    
    it('should handle missing rules gracefully', async () => {
      // Mock rule IDs with one missing rule
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2']);
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify({ id: 'rule1', name: 'Rule 1' });
        if (key === `${RULE_PREFIX}rule2`) return null; // Missing rule
        return null;
      });
      
      const result = await configService.getConfig();
      
      expect(result).toEqual({ 
        rules: [{ id: 'rule1', name: 'Rule 1' }] 
      });
    });
    
    it('should handle invalid JSON gracefully', async () => {
      // Mock rule IDs with one invalid rule
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2']);
        if (key === `${RULE_PREFIX}rule1`) return '{"id": "rule1", "name": "Rule 1"}';
        if (key === `${RULE_PREFIX}rule2`) return '{invalid json}'; // Invalid JSON
        return null;
      });
      
      const result = await configService.getConfig();
      
      expect(result).toEqual({ 
        rules: [{ id: 'rule1', name: 'Rule 1' }] 
      });
    });
  });
  
  describe('getRule', () => {
    it('should get rule directly from storage', async () => {
      // Mock rule in storage
      mockStorage.get.mockImplementation((key) => {
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify({ id: 'rule1', name: 'Rule 1' });
        return null;
      });
      
      const result = await configService.getRule('rule1');
      
      expect(result).toEqual({ id: 'rule1', name: 'Rule 1' });
      expect(mockStorage.get).toHaveBeenCalledWith(`${RULE_PREFIX}rule1`);
      expect(mockStorage.get).not.toHaveBeenCalledWith(RULE_IDS_KEY); // Shouldn't check full config
    });
    
    it('should use cached config if available', async () => {
      // Mock cached config
      configService.cachedConfig = { 
        rules: [
          { id: 'rule1', name: 'Rule 1' },
          { id: 'rule2', name: 'Rule 2' }
        ] 
      };
      configService.lastConfigFetch = Date.now();
      
      // No rule in direct storage
      mockStorage.get.mockResolvedValue(null);
      
      const result = await configService.getRule('rule1');
      
      expect(result).toEqual({ id: 'rule1', name: 'Rule 1' });
      expect(mockStorage.get).toHaveBeenCalledWith(`${RULE_PREFIX}rule1`);
      expect(mockStorage.get).not.toHaveBeenCalledWith(RULE_IDS_KEY); // Shouldn't check full config
    });
    
    it('should fall back to fetching full config', async () => {
      // No cached config
      configService.cachedConfig = null;
      
      // Mock storage with multiple rules
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2']);
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify({ id: 'rule1', name: 'Rule 1' });
        if (key === `${RULE_PREFIX}rule2`) return JSON.stringify({ id: 'rule2', name: 'Rule 2' });
        return null;
      });
      
      const result = await configService.getRule('rule2');
      
      expect(result).toEqual({ id: 'rule2', name: 'Rule 2' });
    });
    
    it('should return null if rule not found', async () => {
      // No cached config
      configService.cachedConfig = null;
      
      // Mock storage with no matching rule
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1']);
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify({ id: 'rule1', name: 'Rule 1' });
        return null;
      });
      
      const result = await configService.getRule('non-existent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('addRule', () => {
    it('should add a rule to the configuration', async () => {
      // Setup empty rule IDs
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify([]);
        if (key === `${VERSION_PREFIX}new-rule`) return null;
        return null;
      });
      
      // New rule to add with all required fields
      const newRule = { 
        id: 'new-rule', 
        name: 'New Rule',
        description: 'Test description',
        rateLimit: { limit: 100, period: 60 },
        fingerprint: { parameters: ['ip'] },
        initialMatch: {
          conditions: [{ field: 'path', operator: 'equals', value: '/test' }],
          action: { type: 'block' }
        },
        elseIfActions: []
      };
      
      const result = await configService.addRule(newRule);
      
      // Check result (now includes timestamps)
      expect(result).toMatchObject({
        id: 'new-rule', 
        name: 'New Rule',
        description: 'Test description',
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledWith(
        RULE_IDS_KEY, 
        JSON.stringify(['new-rule'])
      );
      
      // Storage should include timestamps now
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${RULE_PREFIX}new-rule`, 
        expect.stringContaining('"createdAt"')
      );
      
      // Check version archived
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${VERSION_PREFIX}new-rule`,
        expect.stringContaining('test-uuid')
      );
      
      // Check notification sent
      expect(mockQueue.send).toHaveBeenCalled();
      
      // Check cache invalidated
      expect(configService.cachedConfig).toBeNull();
    });
    
    it('should throw error if rule ID already exists', async () => {
      // Setup rule IDs with existing ID
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['existing-rule']);
        return null;
      });
      
      // New rule with duplicate ID
      const newRule = { 
        id: 'existing-rule', 
        name: 'Duplicate Rule',
        description: 'Test description',
        rateLimit: { limit: 100, period: 60 },
        fingerprint: { parameters: ['ip'] },
        initialMatch: {
          conditions: [{ field: 'path', operator: 'equals', value: '/test' }],
          action: { type: 'block' }
        },
        elseIfActions: []
      };
      
      await expect(configService.addRule(newRule))
        .rejects.toThrow('Rule ID "existing-rule" already exists');
      
      // Should not store the rule
      expect(mockStorage.put).not.toHaveBeenCalledWith(
        `${RULE_PREFIX}existing-rule`, 
        expect.any(String)
      );
    });
  });
  
  describe('updateRule', () => {
    it('should update an existing rule', async () => {
      // Setup existing rule with all required fields
      const existingRule = { 
        id: 'rule1', 
        name: 'Old Name',
        description: 'Old description',
        createdAt: '2023-01-01T00:00:00Z',
        rateLimit: { limit: 100, period: 60 },
        fingerprint: { parameters: ['ip'] },
        initialMatch: {
          conditions: [{ field: 'path', operator: 'equals', value: '/test' }],
          action: { type: 'block' }
        },
        elseIfActions: []
      };
      
      mockStorage.get.mockImplementation((key) => {
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify(existingRule);
        if (key === `${VERSION_PREFIX}rule1`) return JSON.stringify([]);
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1']);
        return null;
      });
      
      // Updated rule data with all required fields
      const updatedRule = { 
        id: 'rule1', 
        name: 'New Name',
        description: 'New description',
        rateLimit: { limit: 120, period: 60 },
        fingerprint: { parameters: ['ip'] },
        initialMatch: {
          conditions: [{ field: 'path', operator: 'equals', value: '/test' }],
          action: { type: 'block' }
        },
        elseIfActions: []
      };
      
      const result = await configService.updateRule('rule1', updatedRule);
      
      // Check result contains updatedAt and preserved createdAt
      expect(result).toMatchObject({
        id: 'rule1',
        name: 'New Name',
        description: 'New description',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: expect.any(String)
      });
      
      // Check storage operations
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${RULE_PREFIX}rule1`, 
        expect.stringContaining('New Name')
      );
      
      // Check version archived
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${VERSION_PREFIX}rule1`,
        expect.stringContaining('Old Name')
      );
      
      // Check notification sent
      expect(mockQueue.send).toHaveBeenCalled();
      
      // Check cache invalidated
      expect(configService.cachedConfig).toBeNull();
    });
    
    it('should throw error if rule does not exist', async () => {
      // Mock non-existent rule
      mockStorage.get.mockResolvedValue(null);
      
      await expect(configService.updateRule('non-existent', { id: 'non-existent', name: 'New Name' }))
        .rejects.toThrow('Rule not found');
        
      // Shouldn't update storage
      expect(mockStorage.put).not.toHaveBeenCalledWith(
        `${RULE_PREFIX}non-existent`, 
        expect.any(String)
      );
    });
  });
  
  describe('deleteRule', () => {
    it('should delete an existing rule', async () => {
      // Setup existing rule
      mockStorage.get.mockImplementation((key) => {
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify({ id: 'rule1', name: 'Rule to Delete' });
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2']);
        if (key === `${VERSION_PREFIX}rule1`) return JSON.stringify([]);
        return null;
      });
      
      const result = await configService.deleteRule('rule1');
      
      // Check result
      expect(result).toBe(true);
      
      // Check storage operations
      expect(mockStorage.delete).toHaveBeenCalledWith(`${RULE_PREFIX}rule1`);
      
      // Check rule ID removed
      expect(mockStorage.put).toHaveBeenCalledWith(
        RULE_IDS_KEY,
        JSON.stringify(['rule2'])
      );
      
      // Check version archived
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${VERSION_PREFIX}rule1`,
        expect.stringContaining('Rule to Delete')
      );
      
      // Check notification sent
      expect(mockQueue.send).toHaveBeenCalled();
      
      // Check cache invalidated
      expect(configService.cachedConfig).toBeNull();
    });
    
    it('should return false if rule does not exist', async () => {
      // Mock non-existent rule
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1']);
        return null;
      });
      
      const result = await configService.deleteRule('non-existent');
      
      // Check result
      expect(result).toBe(false);
      
      // Shouldn't delete anything
      expect(mockStorage.delete).not.toHaveBeenCalled();
      expect(mockStorage.put).not.toHaveBeenCalledWith(RULE_IDS_KEY, expect.any(String));
    });
  });
  
  describe('reorderRules', () => {
    it('should reorder rules by updating priorities', async () => {
      // Setup existing rules
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2', 'rule3']);
        if (key === `${RULE_PREFIX}rule1`) return JSON.stringify({ id: 'rule1', name: 'Rule 1', priority: 0 });
        if (key === `${RULE_PREFIX}rule2`) return JSON.stringify({ id: 'rule2', name: 'Rule 2', priority: 1 });
        if (key === `${RULE_PREFIX}rule3`) return JSON.stringify({ id: 'rule3', name: 'Rule 3', priority: 2 });
        return null;
      });
      
      // New order: rule3, rule1, rule2
      const result = await configService.reorderRules(['rule3', 'rule1', 'rule2']);
      
      // Check priorities updated
      expect(result[0].id).toBe('rule3');
      expect(result[0].priority).toBe(0);
      expect(result[1].id).toBe('rule1');
      expect(result[1].priority).toBe(1);
      expect(result[2].id).toBe('rule2');
      expect(result[2].priority).toBe(2);
      
      // Check all rules updated
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${RULE_PREFIX}rule1`,
        expect.stringContaining('"priority":1')
      );
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${RULE_PREFIX}rule2`,
        expect.stringContaining('"priority":2')
      );
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${RULE_PREFIX}rule3`,
        expect.stringContaining('"priority":0')
      );
      
      // Check notification sent
      expect(mockQueue.send).toHaveBeenCalled();
      
      // Check cache invalidated
      expect(configService.cachedConfig).toBeNull();
    });
    
    it('should throw if rule ID not found', async () => {
      // Setup existing rules
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2']);
        return null;
      });
      
      // Include non-existent rule
      await expect(configService.reorderRules(['rule1', 'non-existent']))
        .rejects.toThrow('Rule with ID non-existent not found');
        
      // Shouldn't update anything
      expect(mockStorage.put).not.toHaveBeenCalledWith(`${RULE_PREFIX}rule1`, expect.any(String));
    });
    
    it('should throw if not all rules included', async () => {
      // Setup existing rules
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1', 'rule2', 'rule3']);
        return null;
      });
      
      // Missing rule3
      await expect(configService.reorderRules(['rule1', 'rule2']))
        .rejects.toThrow('All rules must be included in the reordering');
        
      // Shouldn't update anything
      expect(mockStorage.put).not.toHaveBeenCalledWith(`${RULE_PREFIX}rule1`, expect.any(String));
    });
  });
  
  describe('migrateFromOldFormat', () => {
    it('should skip migration if already migrated', async () => {
      // Mock existing rule_ids
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return JSON.stringify(['rule1']);
        return null;
      });
      
      const result = await configService.migrateFromOldFormat();
      
      expect(result).toBe(true);
      // Shouldn't try to get old rules
      expect(mockStorage.get).not.toHaveBeenCalledWith('rules');
    });
    
    it('should initialize empty storage if no old rules exist', async () => {
      // Mock no existing rule_ids and no old rules
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return null;
        if (key === 'rules') return null;
        return null;
      });
      
      const result = await configService.migrateFromOldFormat();
      
      expect(result).toBe(true);
      expect(mockStorage.put).toHaveBeenCalledWith(RULE_IDS_KEY, '[]');
    });
    
    it('should migrate rules from old format to new format', async () => {
      // Mock no existing rule_ids but has old rules
      const oldRules = [
        { id: 'rule1', name: 'Rule 1' },
        { id: 'rule2', name: 'Rule 2' }
      ];
      
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return null;
        if (key === 'rules') return JSON.stringify(oldRules);
        if (key === 'versions_rule1') return JSON.stringify([{ versionId: 'v1', rule: oldRules[0] }]);
        if (key === 'versions_rule2') return null;
        return null;
      });
      
      const result = await configService.migrateFromOldFormat();
      
      expect(result).toBe(true);
      
      // Should store rule IDs
      expect(mockStorage.put).toHaveBeenCalledWith(
        RULE_IDS_KEY,
        JSON.stringify(['rule1', 'rule2'])
      );
      
      // Should store individual rules
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${RULE_PREFIX}rule1`,
        JSON.stringify({ id: 'rule1', name: 'Rule 1' })
      );
      
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${RULE_PREFIX}rule2`,
        JSON.stringify({ id: 'rule2', name: 'Rule 2' })
      );
      
      // Should migrate versions
      expect(mockStorage.put).toHaveBeenCalledWith(
        `${VERSION_PREFIX}rule1`,
        expect.stringContaining('v1')
      );
    });
    
    it('should handle invalid old rules format gracefully', async () => {
      // Mock no existing rule_ids but old rules is not an array
      mockStorage.get.mockImplementation((key) => {
        if (key === RULE_IDS_KEY) return null;
        if (key === 'rules') return JSON.stringify({ notAnArray: true });
        return null;
      });
      
      const result = await configService.migrateFromOldFormat();
      
      expect(result).toBe(false);
      // Shouldn't try to store anything
      expect(mockStorage.put).not.toHaveBeenCalledWith(RULE_IDS_KEY, expect.any(String));
    });
  });
});