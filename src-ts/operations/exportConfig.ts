/**
 * Export Configuration Operation
 * 
 * Handles the export of the entire configuration with rule history
 */
import { backupService } from '../services/backup-service.js';
import { logger, trackPerformance } from '../utils/index.js';

/**
 * Export the entire configuration with all rules and their versions
 * 
 * @returns The exported configuration data
 */
export async function exportConfig() {
  return await trackPerformance('operations.exportConfig', async () => {
    try {
      logger.info('Starting full configuration export');
      
      // Get the complete backup data
      const backupData = await backupService.exportConfig();
      
      // Get a filename for the backup
      const filename = backupService.getBackupFilename();
      
      logger.info('Configuration export successful', { 
        ruleCount: backupData.metadata.ruleCount,
        versionCount: backupData.metadata.versionCount,
        filename
      });
      
      // Return both the data and the suggested filename
      return {
        data: backupData,
        filename
      };
    } catch (error) {
      logger.error('Error in export operation', error);
      throw error;
    }
  });
}