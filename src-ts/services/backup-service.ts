/**
 * Backup Service
 * 
 * Handles backup and export of configuration data
 */
import { trackPerformance } from '../utils/index.js';
import { logger } from '../utils/logger/index.js';
import { ConfigService, configService } from './config-service-improved.js';
import { Config, Rule, RuleVersion } from '../types/index.js';

/**
 * Full backup data structure including all rules and their versions
 */
export interface BackupData {
  /** Timestamp when the backup was created */
  timestamp: string;
  /** Information about the backup */
  metadata: {
    /** Version of the backup format */
    version: string;
    /** Environment the backup was taken from */
    environment: string;
    /** Number of rules in the backup */
    ruleCount: number;
    /** Total number of rule versions in the backup */
    versionCount: number;
  };
  /** Configuration data */
  config: Config;
  /** Rule versions keyed by rule ID */
  versions: Record<string, RuleVersion[]>;
}

/**
 * Service responsible for backup and export of configuration data
 */
export class BackupService {
  /** The config service instance */
  private configService: ConfigService;

  /**
   * Singleton instance
   */
  private static instance: BackupService;

  /**
   * Get the singleton instance of BackupService
   */
  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Create a new BackupService
   */
  constructor() {
    this.configService = configService;
  }

  /**
   * Export the entire configuration including all rules and their versions
   * 
   * @returns The complete backup data
   */
  async exportConfig(): Promise<BackupData> {
    return await trackPerformance('BackupService.exportConfig', async () => {
      try {
        logger.info('Exporting complete configuration');

        // Get all configuration
        const config = await this.configService.getConfig();
        
        // Get all rule versions
        const versionPromises: Promise<RuleVersion[]>[] = [];
        const rules = config.rules;
        
        // Create a map to hold all versions
        const versions: Record<string, RuleVersion[]> = {};
        
        // Collect versions for each rule in parallel
        for (const rule of rules) {
          versionPromises.push(
            this.configService.getRuleVersions(rule.id).then(result => {
              // Handle the case where getRuleVersions returns a paginated result
              const versionList = Array.isArray(result) ? result : result.versions;
              versions[rule.id] = versionList;
              return versionList;
            })
          );
        }
        
        // Wait for all version fetches to complete
        await Promise.all(versionPromises);
        
        // Count total versions
        let totalVersions = 0;
        Object.values(versions).forEach(versionList => {
          totalVersions += versionList.length;
        });
        
        // Create the backup data
        const backupData: BackupData = {
          timestamp: new Date().toISOString(),
          metadata: {
            version: '1.0',
            environment: this.configService.getEnvironment(),
            ruleCount: rules.length,
            versionCount: totalVersions
          },
          config,
          versions
        };
        
        logger.info('Configuration export completed', {
          ruleCount: rules.length,
          versionCount: totalVersions
        });
        
        return backupData;
      } catch (error) {
        logger.error('Error exporting configuration', error);
        throw error;
      }
    });
  }

  /**
   * Generate a filename for the backup based on current date/time
   * 
   * @returns A filename for the backup
   */
  getBackupFilename(): string {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const timePart = now.toISOString()
      .split('T')[1]
      .replace(/:/g, '-')
      .split('.')[0];
    
    const environment = this.configService.getEnvironment();
    return `rate-limiter-backup_${environment}_${datePart}_${timePart}.json`;
  }
}

/**
 * Singleton instance of BackupService
 */
export const backupService = BackupService.getInstance();