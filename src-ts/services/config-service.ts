/**
 * Config Service
 * 
 * Handles all interactions with the config storage
 */
import { CACHE_TTL, DEFAULT_ENVIRONMENT, Environment, VERSION_LIMIT } from '../constants/index.js';
import { Config, ConfigUpdateMessage, Env, Rule, RuleVersion } from '../types/index.js';
import { logger, trackPerformance } from '../utils/index.js';

/**
 * Class responsible for managing configuration storage
 */
export class ConfigService {
  /**
   * The Durable Object state
   */
  private state?: DurableObjectState;
  
  /**
   * Environment bindings
   */
  private env?: Env;
  
  /**
   * Cached configuration
   */
  private cachedConfig: Config | null = null;
  
  /**
   * Timestamp of the last config fetch
   */
  private lastConfigFetch = 0;
  
  /**
   * Singleton instance
   */
  private static instance: ConfigService;

  /**
   * Get the singleton instance of ConfigService
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Set the Durable Object state for the service
   * 
   * @param state - The Durable Object state
   * @param env - The environment
   */
  setState(state: DurableObjectState, env: Env): void {
    this.state = state;
    this.env = env;
    logger.info('ConfigService initialized');
  }

  /**
   * Get the current environment
   * 
   * @returns The current environment
   */
  getEnvironment(): Environment {
    return (this.env?.ENVIRONMENT as Environment) || DEFAULT_ENVIRONMENT;
  }

  /**
   * Get the entire configuration
   * 
   * @returns The configuration object with rules
   */
  async getConfig(): Promise<Config> {
    return await trackPerformance('ConfigService.getConfig', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      const now = Date.now();
      
      // Return fresh cached config if available
      if (this.cachedConfig && (now - this.lastConfigFetch < CACHE_TTL)) {
        logger.debug('Using cached config');
        return this.cachedConfig;
      }
      
      try {
        logger.info('Fetching config from storage');
        let rules = await this.state.storage.get('rules');
        
        if (rules === null || rules === undefined || rules === '') {
          logger.info('No rules found in storage, initializing empty array');
          rules = '[]';
        } else if (typeof rules !== 'string') {
          logger.info('Rules in storage is not a string, stringifying');
          rules = JSON.stringify(rules);
        }
        
        const parsedRules = JSON.parse(rules as string) as Rule[];
        logger.debug('Parsed rules', { count: parsedRules.length });
        
        this.cachedConfig = { rules: parsedRules };
        this.lastConfigFetch = now;
        
        return this.cachedConfig;
      } catch (error) {
        logger.error('Error retrieving config', error);
        throw error;
      }
    });
  }

  /**
   * Get a specific rule by ID
   * 
   * @param ruleId - The ID of the rule to retrieve
   * @returns The rule or null if not found
   */
  async getRule(ruleId: string): Promise<Rule | null> {
    return await trackPerformance('ConfigService.getRule', async () => {
      try {
        logger.info('Getting rule', { ruleId });
        const config = await this.getConfig();
        const rule = config.rules.find(r => r.id === ruleId);
        
        if (rule) {
          logger.debug('Rule found', { ruleId });
          return rule;
        }
        
        logger.warn('Rule not found', { ruleId });
        return null;
      } catch (error) {
        logger.error('Error retrieving rule', error);
        throw error;
      }
    });
  }

  /**
   * Get versions of a specific rule
   * 
   * @param ruleId - The ID of the rule to get versions for
   * @returns The versions of the rule
   */
  async getRuleVersions(ruleId: string): Promise<RuleVersion[]> {
    return await trackPerformance('ConfigService.getRuleVersions', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      try {
        logger.info('Getting rule versions', { ruleId });
        const versionsStr = await this.state.storage.get(`versions_${ruleId}`);
        const versions = JSON.parse(versionsStr as string || '[]') as RuleVersion[];
        
        logger.debug('Rule versions', { ruleId, count: versions.length });
        return versions;
      } catch (error) {
        logger.error('Error retrieving rule versions', error);
        throw error;
      }
    });
  }

  /**
   * Add a new rule to the configuration
   * 
   * @param rule - The rule to add
   * @returns The added rule
   */
  async addRule(rule: Rule): Promise<Rule> {
    return await trackPerformance('ConfigService.addRule', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      try {
        logger.info('Adding rule', { name: rule.name });
        const config = await this.getConfig();
        
        // Add the rule to the config
        config.rules.push(rule);
        
        // Save the updated config
        await this.state.storage.put('rules', JSON.stringify(config.rules));
        
        // Archive the rule as a new version
        await this.archiveRuleVersion(rule);
        
        // Invalidate the cache
        this.invalidateCache();
        
        logger.info('Rule added successfully', { id: rule.id });
        return rule;
      } catch (error) {
        logger.error('Error adding rule', error);
        throw error;
      }
    });
  }

  /**
   * Update an existing rule
   * 
   * @param ruleId - The ID of the rule to update
   * @param updatedRule - The updated rule data
   * @returns The updated rule
   */
  async updateRule(ruleId: string, updatedRule: Rule): Promise<Rule> {
    return await trackPerformance('ConfigService.updateRule', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      try {
        logger.info('Updating rule', { ruleId });
        const config = await this.getConfig();
        
        // Find the rule index
        const index = config.rules.findIndex(r => r.id === ruleId);
        
        if (index === -1) {
          logger.warn('Rule not found for update', { ruleId });
          throw new Error('Rule not found');
        }
        
        // Store the current version in history
        await this.archiveRuleVersion(config.rules[index]);
        
        // Update the rule
        config.rules[index] = {
          ...updatedRule,
          updatedAt: new Date().toISOString()
        };
        
        // Save the updated config
        await this.state.storage.put('rules', JSON.stringify(config.rules));
        
        // Invalidate the cache
        this.invalidateCache();
        
        logger.info('Rule updated successfully', { ruleId });
        return config.rules[index];
      } catch (error) {
        logger.error('Error updating rule', error);
        throw error;
      }
    });
  }

  /**
   * Delete a rule from the configuration
   * 
   * @param ruleId - The ID of the rule to delete
   * @returns Whether the deletion was successful
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    return await trackPerformance('ConfigService.deleteRule', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      try {
        logger.info('Deleting rule', { ruleId });
        const config = await this.getConfig();
        
        // Find the rule
        const index = config.rules.findIndex(r => r.id === ruleId);
        
        if (index === -1) {
          logger.warn('Rule not found for deletion', { ruleId });
          return false;
        }
        
        // Archive the rule being deleted
        await this.archiveRuleVersion(config.rules[index]);
        
        // Remove the rule
        config.rules.splice(index, 1);
        
        // Save the updated config
        await this.state.storage.put('rules', JSON.stringify(config.rules));
        
        // Invalidate the cache
        this.invalidateCache();
        
        logger.info('Rule deleted successfully', { ruleId });
        return true;
      } catch (error) {
        logger.error('Error deleting rule', error);
        throw error;
      }
    });
  }

  /**
   * Reorder rules by changing their priorities
   * 
   * @param ruleIds - Array of rule IDs in the desired order
   * @returns The reordered rules
   */
  async reorderRules(ruleIds: string[]): Promise<Rule[]> {
    return await trackPerformance('ConfigService.reorderRules', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      try {
        logger.info('Reordering rules', { ruleIds });
        const config = await this.getConfig();
        
        // Create a map for efficient lookup
        const ruleMap = new Map(config.rules.map(rule => [rule.id, rule]));
        
        // Validate that all ruleIds exist
        for (const ruleId of ruleIds) {
          if (!ruleMap.has(ruleId)) {
            logger.warn('Rule not found for reordering', { ruleId });
            throw new Error(`Rule with ID ${ruleId} not found`);
          }
        }
        
        // Check if all rules are included in the reordering
        if (ruleIds.length !== config.rules.length) {
          logger.warn('Not all rules included in reordering', { 
            providedCount: ruleIds.length, 
            totalCount: config.rules.length 
          });
          throw new Error('All rules must be included in the reordering');
        }
        
        // Create the reordered list with updated priorities
        const reorderedRules = ruleIds.map((id, index) => {
          const rule = ruleMap.get(id);
          if (!rule) {
            throw new Error(`Rule with ID ${id} not found`);
          }
          
          return {
            ...rule,
            priority: index,
            updatedAt: new Date().toISOString()
          };
        });
        
        // Save the updated config
        await this.state.storage.put('rules', JSON.stringify(reorderedRules));
        
        // Invalidate the cache
        this.invalidateCache();
        
        logger.info('Rules reordered successfully');
        return reorderedRules;
      } catch (error) {
        logger.error('Error reordering rules', error);
        throw error;
      }
    });
  }

  /**
   * Revert a rule to a previous version
   * 
   * @param ruleId - The ID of the rule to revert
   * @param versionId - The version ID to revert to
   * @returns The reverted rule
   */
  async revertRule(ruleId: string, versionId: string): Promise<Rule> {
    return await trackPerformance('ConfigService.revertRule', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      try {
        logger.info('Reverting rule', { ruleId, versionId });
        
        // Get rule versions
        const versions = await this.getRuleVersions(ruleId);
        const version = versions.find(v => v.versionId === versionId);
        
        if (!version) {
          logger.warn('Version not found for revert', { ruleId, versionId });
          throw new Error('Version not found');
        }
        
        // Get current config
        const config = await this.getConfig();
        
        // Check if rule still exists
        const index = config.rules.findIndex(r => r.id === ruleId);
        
        if (index === -1) {
          // Rule doesn't exist anymore, add it back
          const restoredRule = {
            ...version.rule,
            updatedAt: new Date().toISOString()
          };
          
          config.rules.push(restoredRule);
          
          // Save the updated config
          await this.state.storage.put('rules', JSON.stringify(config.rules));
          
          // Invalidate the cache
          this.invalidateCache();
          
          logger.info('Rule restored successfully', { ruleId });
          return restoredRule;
        } else {
          // Rule exists, update it with the version data
          // First, archive the current version
          await this.archiveRuleVersion(config.rules[index]);
          
          // Update with the version data
          config.rules[index] = {
            ...version.rule,
            updatedAt: new Date().toISOString()
          };
          
          // Save the updated config
          await this.state.storage.put('rules', JSON.stringify(config.rules));
          
          // Invalidate the cache
          this.invalidateCache();
          
          logger.info('Rule reverted successfully', { ruleId, versionId });
          return config.rules[index];
        }
      } catch (error) {
        logger.error('Error reverting rule', error);
        throw error;
      }
    });
  }

  /**
   * Archive a rule version for history
   * 
   * @param rule - The rule to archive
   */
  async archiveRuleVersion(rule: Rule): Promise<void> {
    await trackPerformance('ConfigService.archiveRuleVersion', async () => {
      if (!this.state) {
        throw new Error('ConfigService state not initialized');
      }

      try {
        if (!rule || !rule.id) {
          logger.warn('Cannot archive invalid rule', { rule });
          return;
        }
        
        const ruleId = rule.id;
        logger.info('Archiving rule version', { ruleId });
        
        // Get existing versions
        const versions = await this.getRuleVersions(ruleId);
        
        // Create new version object
        const newVersion: RuleVersion = {
          versionId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          rule: { ...rule }
        };
        
        // Add to versions and maintain max limit
        versions.unshift(newVersion);
        if (versions.length > VERSION_LIMIT) {
          versions.splice(VERSION_LIMIT);
        }
        
        // Save updated versions
        await this.state.storage.put(`versions_${ruleId}`, JSON.stringify(versions));
        
        logger.info('Rule version archived', { ruleId, versionId: newVersion.versionId });
      } catch (error) {
        logger.error('Error archiving rule version', error);
        // Don't throw the error to avoid breaking the main operation
      }
    });
  }

  /**
   * Invalidate the cache to force a fresh load next time
   */
  invalidateCache(): void {
    this.cachedConfig = null;
    this.lastConfigFetch = 0;
    logger.debug('Config cache invalidated');
  }

  /**
   * Notify subscribers about config updates
   */
  async notifyConfigUpdate(): Promise<void> {
    try {
      if (!this.env || !this.env.CONFIG_QUEUE) {
        logger.warn('Cannot notify about config update: CONFIG_QUEUE not available');
        return;
      }
      
      const timestamp = Date.now();
      const environment = this.getEnvironment();
      
      const message: ConfigUpdateMessage = {
        type: 'config_update',
        version: timestamp,
        environment
      };
      
      await this.env.CONFIG_QUEUE.send(message);
      
      logger.info('Config update notification sent', { 
        version: timestamp,
        environment 
      });
    } catch (error) {
      logger.error('Error sending config update notification', error);
      // Don't throw to avoid breaking the main operation
    }
  }
}

/**
 * Singleton instance of ConfigService
 */
export const configService = ConfigService.getInstance();