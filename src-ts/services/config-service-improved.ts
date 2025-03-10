/**
 * Config Service (Improved version with individual rule storage)
 *
 * Handles all interactions with the config storage
 */
import { DEFAULT_ENVIRONMENT, CACHE_TTL, VERSION_LIMIT } from '../constants/index.js';
import { logger, trackPerformance } from '../utils/index.js';
import { validateRule, validateRules, logValidationResult } from '../utils/validation/enhanced-validation.js';
import { Rule, RuleVersion, DurableObjectState, Environment } from '../types/index.js';

// Constants for storage keys
const RULE_PREFIX = 'rule_';
const RULE_IDS_KEY = 'rule_ids';
const VERSION_PREFIX = 'versions_';

/**
 * Class responsible for managing configuration storage
 */
export class ConfigService {
    /**
     * The Durable Object state
     */
    state: DurableObjectState | null = null;

    /**
     * Environment bindings
     */
    env: Environment | null = null;

    /**
     * Cached configuration
     */
    cachedConfig: { rules: Rule[] } | null = null;

    /**
     * Timestamp of the last config fetch
     */
    lastConfigFetch = 0;

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
    setState(state: DurableObjectState, env: Environment): void {
        this.state = state;
        this.env = env;
        logger.info('ConfigService initialized');
    }

    /**
     * Get the current environment
     *
     * @returns The current environment
     */
    getEnvironment(): string {
        return this.env?.ENVIRONMENT || DEFAULT_ENVIRONMENT;
    }

    /**
     * Get the entire configuration with optional pagination
     *
     * @param pagination - Optional pagination parameters
     * @returns The paginated or full configuration object with rules
     */
    async getConfig(pagination?: PaginationParams): Promise<{ rules: Rule[] } | PaginatedRules> {
        return await trackPerformance('ConfigService.getConfig', async () => {
            if (!this.state) {
                throw new Error('ConfigService state not initialized');
            }

            const now = Date.now();
            
            try {
                // First, get all rule IDs regardless of pagination
                // This helps us refresh the cache and determine the total count
                let ruleIds = await this.state.storage.get(RULE_IDS_KEY) as string | null;
                if (ruleIds === null || ruleIds === undefined || ruleIds === '') {
                    logger.info('No rule IDs found in storage, initializing empty array');
                    ruleIds = '[]';
                }
                
                let parsedRuleIds = JSON.parse(ruleIds) as string[];
                
                // If there are no rules yet, handle pagination with empty results
                if (!parsedRuleIds.length) {
                    logger.debug('No rules found');
                    
                    if (pagination) {
                        return {
                            rules: [],
                            pagination: {
                                currentPage: pagination.page,
                                pageSize: pagination.limit,
                                totalItems: 0,
                                totalPages: 0,
                                hasNextPage: false,
                                hasPrevPage: false
                            }
                        };
                    }
                    
                    this.cachedConfig = { rules: [] };
                    this.lastConfigFetch = now;
                    return this.cachedConfig;
                }
                
                // Return from cache if available and not paginated request
                if (!pagination && this.cachedConfig && (now - this.lastConfigFetch < CACHE_TTL)) {
                    logger.debug('Using cached config');
                    return this.cachedConfig;
                }
                
                logger.info('Fetching config from storage');
                
                // If we have pagination, apply it to the rule IDs
                let selectedRuleIds = parsedRuleIds;
                let paginationMeta: PaginationMeta | null = null;
                
                if (pagination) {
                    const { page, limit } = pagination;
                    const totalItems = parsedRuleIds.length;
                    const totalPages = Math.ceil(totalItems / limit);
                    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
                    const startIndex = (currentPage - 1) * limit;
                    const endIndex = Math.min(startIndex + limit, totalItems);
                    
                    selectedRuleIds = parsedRuleIds.slice(startIndex, endIndex);
                    
                    paginationMeta = {
                        currentPage,
                        pageSize: limit,
                        totalItems,
                        totalPages,
                        hasNextPage: currentPage < totalPages,
                        hasPrevPage: currentPage > 1
                    };
                    
                    logger.debug('Applying pagination', { 
                        page: currentPage, 
                        limit, 
                        totalItems,
                        selectedItems: selectedRuleIds.length
                    });
                }
                
                // Fetch selected rules in parallel for better performance
                const rulePromises = selectedRuleIds.map(id => 
                    this.state!.storage.get(`${RULE_PREFIX}${id}`)
                );
                
                const ruleResults = await Promise.all(rulePromises);
                
                // Parse all rules
                const rules = ruleResults
                    .map(rule => {
                        if (!rule) return null;
                        try {
                            return JSON.parse(rule as string) as Rule;
                        } catch (e) {
                            logger.error('Error parsing rule', e);
                            return null;
                        }
                    })
                    .filter(rule => rule !== null) as Rule[];
                
                logger.debug('Fetched rules', { count: rules.length });
                
                // Sort by priority
                rules.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
                
                // If we're not paginating, update the cache
                if (!pagination) {
                    this.cachedConfig = { rules };
                    this.lastConfigFetch = now;
                    return this.cachedConfig;
                }
                
                // Return paginated response
                return {
                    rules,
                    pagination: paginationMeta!
                };
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
            if (!this.state) {
                throw new Error('ConfigService state not initialized');
            }
            
            try {
                logger.info('Getting rule', { ruleId });
                
                // Try to get directly from storage first for efficiency
                const ruleJson = await this.state.storage.get(`${RULE_PREFIX}${ruleId}`) as string | null;
                
                if (ruleJson) {
                    const rule = JSON.parse(ruleJson) as Rule;
                    logger.debug('Rule found in direct storage', { ruleId });
                    return rule;
                }
                
                // Fallback to checking the cached config
                if (this.cachedConfig) {
                    const rule = this.cachedConfig.rules.find(r => r.id === ruleId);
                    if (rule) {
                        logger.debug('Rule found in cache', { ruleId });
                        return rule;
                    }
                }
                
                // If not found in direct storage or cache, check full config
                const config = await this.getConfig();
                const rule = config.rules.find(r => r.id === ruleId);
                
                if (rule) {
                    logger.debug('Rule found in full config', { ruleId });
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
     * Get versions of a specific rule with optional pagination
     *
     * @param ruleId - The ID of the rule to get versions for
     * @param pagination - Optional pagination parameters
     * @returns The versions of the rule, either as a complete array or paginated
     */
    async getRuleVersions(ruleId: string, pagination?: PaginationParams): Promise<RuleVersion[] | PaginatedVersions> {
        return await trackPerformance('ConfigService.getRuleVersions', async () => {
            if (!this.state) {
                throw new Error('ConfigService state not initialized');
            }
            
            try {
                logger.info('Getting rule versions', { ruleId });
                const versionsStr = await this.state.storage.get(`${VERSION_PREFIX}${ruleId}`) as string | null;
                const allVersions = JSON.parse(versionsStr || '[]') as RuleVersion[];
                
                // If no pagination requested, return all versions
                if (!pagination) {
                    logger.debug('Rule versions', { ruleId, count: allVersions.length });
                    return allVersions;
                }
                
                // Calculate pagination metadata
                const { page, limit } = pagination;
                const totalItems = allVersions.length;
                const totalPages = Math.ceil(totalItems / limit);
                const currentPage = Math.max(1, Math.min(page, totalPages || 1));
                const startIndex = (currentPage - 1) * limit;
                const endIndex = Math.min(startIndex + limit, totalItems);
                
                // Get the versions for this page
                const paginatedVersions = allVersions.slice(startIndex, endIndex);
                
                const paginationMeta: PaginationMeta = {
                    currentPage,
                    pageSize: limit,
                    totalItems,
                    totalPages,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1
                };
                
                logger.debug('Rule versions paginated', { 
                    ruleId, 
                    page: currentPage,
                    limit,
                    totalItems,
                    returnedItems: paginatedVersions.length
                });
                
                return {
                    versions: paginatedVersions,
                    pagination: paginationMeta
                };
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
                
                // Get all rule IDs
                let ruleIdsStr = await this.state.storage.get(RULE_IDS_KEY) as string | null;
                const ruleIds = JSON.parse(ruleIdsStr || '[]') as string[];
                
                // Validate the rule
                const validationResult = validateRule(rule, ruleIds);
                if (!validationResult.valid) {
                    logValidationResult(validationResult);
                    throw new Error(`Invalid rule: ${validationResult.errors[0].message}`);
                }
                
                // Log any warnings
                if (validationResult.warnings.length > 0) {
                    logValidationResult(validationResult);
                }
                
                // Add createdAt timestamp if not present
                if (!rule.createdAt) {
                    rule.createdAt = new Date().toISOString();
                }
                
                // Add updatedAt timestamp
                rule.updatedAt = new Date().toISOString();
                
                // Add rule ID to the list
                ruleIds.push(rule.id);
                
                // Store rule and update rule IDs list in transaction
                await this.state.storage.put(RULE_IDS_KEY, JSON.stringify(ruleIds));
                await this.state.storage.put(`${RULE_PREFIX}${rule.id}`, JSON.stringify(rule));
                
                // Archive the rule as a new version
                await this.archiveRuleVersion(rule);
                
                // Notify about the update
                await this.notifyConfigUpdate();
                
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
                
                // Check if rule exists first
                const currentRuleJson = await this.state.storage.get(`${RULE_PREFIX}${ruleId}`) as string | null;
                if (!currentRuleJson) {
                    logger.warn('Rule not found for update', { ruleId });
                    throw new Error('Rule not found');
                }
                
                const currentRule = JSON.parse(currentRuleJson) as Rule;
                
                // Get all rule IDs for validation
                let ruleIdsStr = await this.state.storage.get(RULE_IDS_KEY) as string | null;
                const ruleIds = JSON.parse(ruleIdsStr || '[]') as string[];
                
                // Validate the updated rule (exempting the current ID from uniqueness check)
                const validationResult = validateRule(updatedRule, ruleIds, ruleId);
                if (!validationResult.valid) {
                    logValidationResult(validationResult);
                    throw new Error(`Invalid rule: ${validationResult.errors[0].message}`);
                }
                
                // Log any warnings
                if (validationResult.warnings.length > 0) {
                    logValidationResult(validationResult);
                }
                
                // Store the current version in history
                await this.archiveRuleVersion(currentRule);
                
                // Preserve createdAt from the current rule
                const finalRule: Rule = {
                    ...updatedRule,
                    createdAt: currentRule.createdAt,
                    updatedAt: new Date().toISOString()
                };
                
                // Store the updated rule
                await this.state.storage.put(`${RULE_PREFIX}${ruleId}`, JSON.stringify(finalRule));
                
                // Notify about the update
                await this.notifyConfigUpdate();
                
                // Invalidate the cache
                this.invalidateCache();
                
                logger.info('Rule updated successfully', { ruleId });
                return finalRule;
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
                
                // Check if rule exists
                const ruleJson = await this.state.storage.get(`${RULE_PREFIX}${ruleId}`) as string | null;
                if (!ruleJson) {
                    logger.warn('Rule not found for deletion', { ruleId });
                    return false;
                }
                
                // Archive the rule being deleted
                const rule = JSON.parse(ruleJson) as Rule;
                await this.archiveRuleVersion(rule);
                
                // Get all rule IDs
                let ruleIdsStr = await this.state.storage.get(RULE_IDS_KEY) as string | null;
                let ruleIds = JSON.parse(ruleIdsStr || '[]') as string[];
                
                // Remove rule ID from list
                ruleIds = ruleIds.filter(id => id !== ruleId);
                
                // Update rule IDs and delete the rule
                await this.state.storage.put(RULE_IDS_KEY, JSON.stringify(ruleIds));
                await this.state.storage.delete(`${RULE_PREFIX}${ruleId}`);
                
                // Notify about the update
                await this.notifyConfigUpdate();
                
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
                
                // Get all current rule IDs
                let currentRuleIdsStr = await this.state.storage.get(RULE_IDS_KEY) as string | null;
                let currentRuleIds = JSON.parse(currentRuleIdsStr || '[]') as string[];
                
                // Validate that all provided ruleIds exist
                for (const ruleId of ruleIds) {
                    if (!currentRuleIds.includes(ruleId)) {
                        logger.warn('Rule not found for reordering', { ruleId });
                        throw new Error(`Rule with ID ${ruleId} not found`);
                    }
                }
                
                // Check if all rules are included in the reordering
                if (ruleIds.length !== currentRuleIds.length) {
                    logger.warn('Not all rules included in reordering', {
                        providedCount: ruleIds.length,
                        totalCount: currentRuleIds.length
                    });
                    throw new Error('All rules must be included in the reordering');
                }
                
                // Fetch all rules in parallel
                const rulePromises = ruleIds.map(async (id) => {
                    const ruleJson = await this.state!.storage.get(`${RULE_PREFIX}${id}`) as string | null;
                    return ruleJson ? JSON.parse(ruleJson) as Rule : null;
                });
                
                const rules = (await Promise.all(rulePromises)).filter(rule => rule !== null) as Rule[];
                
                // Update priorities and timestamps
                const updates = [];
                for (let i = 0; i < rules.length; i++) {
                    const rule = rules[i];
                    const updatedRule: Rule = {
                        ...rule,
                        priority: i,
                        updatedAt: new Date().toISOString()
                    };
                    
                    updates.push(
                        this.state.storage.put(`${RULE_PREFIX}${rule.id}`, JSON.stringify(updatedRule))
                    );
                    
                    // Replace the rule in our array with the updated one
                    rules[i] = updatedRule;
                }
                
                // Execute all updates in parallel
                await Promise.all(updates);
                
                // Notify about the update
                await this.notifyConfigUpdate();
                
                // Invalidate the cache
                this.invalidateCache();
                
                logger.info('Rules reordered successfully');
                return rules;
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
                
                // Check if rule still exists
                const ruleJson = await this.state.storage.get(`${RULE_PREFIX}${ruleId}`) as string | null;
                
                if (!ruleJson) {
                    // Rule doesn't exist anymore, add it back
                    // First, add to rule IDs
                    let ruleIdsStr = await this.state.storage.get(RULE_IDS_KEY) as string | null;
                    let ruleIds = JSON.parse(ruleIdsStr || '[]') as string[];
                    
                    // Only add if not already in the list
                    if (!ruleIds.includes(ruleId)) {
                        ruleIds.push(ruleId);
                        await this.state.storage.put(RULE_IDS_KEY, JSON.stringify(ruleIds));
                    }
                    
                    // Then restore the rule
                    const restoredRule: Rule = {
                        ...version.rule,
                        updatedAt: new Date().toISOString()
                    };
                    
                    await this.state.storage.put(`${RULE_PREFIX}${ruleId}`, JSON.stringify(restoredRule));
                    
                    // Notify about the update
                    await this.notifyConfigUpdate();
                    
                    // Invalidate the cache
                    this.invalidateCache();
                    
                    logger.info('Rule restored successfully', { ruleId });
                    return restoredRule;
                } else {
                    // Rule exists, update it with the version data
                    // First, archive the current version
                    const currentRule = JSON.parse(ruleJson) as Rule;
                    await this.archiveRuleVersion(currentRule);
                    
                    // Update with the version data
                    const updatedRule: Rule = {
                        ...version.rule,
                        updatedAt: new Date().toISOString()
                    };
                    
                    await this.state.storage.put(`${RULE_PREFIX}${ruleId}`, JSON.stringify(updatedRule));
                    
                    // Notify about the update
                    await this.notifyConfigUpdate();
                    
                    // Invalidate the cache
                    this.invalidateCache();
                    
                    logger.info('Rule reverted successfully', { ruleId, versionId });
                    return updatedRule;
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
                await this.state.storage.put(`${VERSION_PREFIX}${ruleId}`, JSON.stringify(versions));
                
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
            const message = {
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
    
    /**
     * Migrate data from the old storage format (single blob) to the new format (individual rules)
     * This is a one-time migration operation.
     * 
     * @returns True if migration was successful
     */
    async migrateFromOldFormat(): Promise<boolean> {
        return await trackPerformance('ConfigService.migrateFromOldFormat', async () => {
            if (!this.state) {
                throw new Error('ConfigService state not initialized');
            }
            
            try {
                logger.info('Starting migration from old storage format');
                
                // Check if we've already migrated by checking for rule_ids key
                const ruleIdsStr = await this.state.storage.get(RULE_IDS_KEY) as string | null;
                if (ruleIdsStr) {
                    logger.info('Migration already completed (rule_ids exists)');
                    return true;
                }
                
                // Get the old format rules blob
                const oldRulesStr = await this.state.storage.get('rules') as string | null;
                if (!oldRulesStr) {
                    logger.info('No old rules found, initializing empty storage');
                    await this.state.storage.put(RULE_IDS_KEY, '[]');
                    return true;
                }
                
                const oldRules = JSON.parse(oldRulesStr) as Rule[];
                logger.info(`Migrating ${oldRules.length} rules to new format`);
                
                if (!Array.isArray(oldRules)) {
                    logger.warn('Old rules is not an array, aborting migration');
                    return false;
                }
                
                // Extract all rule IDs
                const ruleIds = oldRules.map(rule => rule.id);
                
                // Store each rule individually and also get versions
                const storePromises = [];
                
                for (const rule of oldRules) {
                    if (!rule.id) {
                        logger.warn('Skipping rule without ID during migration', { rule });
                        continue;
                    }
                    
                    // Store the rule
                    storePromises.push(
                        this.state.storage.put(`${RULE_PREFIX}${rule.id}`, JSON.stringify(rule))
                    );
                    
                    // Also migrate the versions if they exist
                    storePromises.push(
                        (async () => {
                            if (this.state) {
                                const versionsStr = await this.state.storage.get(`versions_${rule.id}`) as string | null;
                                if (versionsStr) {
                                    return this.state.storage.put(
                                        `${VERSION_PREFIX}${rule.id}`, 
                                        versionsStr
                                    );
                                }
                            }
                        })()
                    );
                }
                
                // Add the rule IDs list
                storePromises.push(
                    this.state.storage.put(RULE_IDS_KEY, JSON.stringify(ruleIds))
                );
                
                // Execute all operations in parallel
                await Promise.all(storePromises);
                
                logger.info('Migration completed successfully');
                return true;
            } catch (error) {
                logger.error('Error during migration', error);
                return false;
            }
        });
    }
}

/**
 * Singleton instance of ConfigService
 */
export const configService = ConfigService.getInstance();