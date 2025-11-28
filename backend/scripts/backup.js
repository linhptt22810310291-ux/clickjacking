'use strict';

/**
 * 💾 DATABASE BACKUP SCRIPT
 * Tự động sao lưu database SQL Server theo lịch
 * 
 * Biện pháp 8: Sao lưu và Phục hồi Dữ liệu (Backup)
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const securityConfig = require('../config/security.config');
const auditLogger = require('../utils/auditLogger');
const logger = require('../utils/logger');

// Load database config
const dbConfig = require('../config/database.json')[process.env.NODE_ENV || 'development'];

// Tạo thư mục backup nếu chưa có
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Tạo tên file backup với timestamp
 */
const generateBackupFileName = (type = 'daily') => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').split('.')[0];
  return `backup_${type}_${timestamp}.bak`;
};

/**
 * Thực hiện backup database SQL Server
 */
const backupDatabase = async (backupType = 'daily') => {
  const backupFileName = generateBackupFileName(backupType);
  const backupFilePath = path.join(backupDir, backupFileName);
  
  try {
    logger.info(`🔄 Starting ${backupType} database backup...`);
    auditLogger.logBackup('started', `${backupType} backup initiated`);
    
    // Kết nối tới SQL Server
    const pool = await sql.connect({
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      server: dbConfig.host,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    });
    
    // Thực hiện backup
    const backupQuery = `
      BACKUP DATABASE [${dbConfig.database}] 
      TO DISK = '${backupFilePath.replace(/\\/g, '/')}'
      WITH FORMAT, INIT, COMPRESSION,
      NAME = '${backupType} Backup - ${new Date().toISOString()}',
      STATS = 10;
    `;
    
    await pool.request().query(backupQuery);
    await pool.close();
    
    // Kiểm tra file backup đã được tạo
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('Backup file was not created');
    }
    
    const stats = fs.statSync(backupFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    logger.info(`✅ Database backup completed successfully`);
    logger.info(`📁 Backup file: ${backupFileName} (${fileSizeMB} MB)`);
    
    auditLogger.logBackup('completed', `${backupType} backup completed: ${backupFileName} (${fileSizeMB} MB)`);
    
    // Mã hóa backup nếu được cấu hình
    if (securityConfig.backup.encryption) {
      await encryptBackup(backupFilePath);
    }
    
    // Cleanup old backups
    await cleanupOldBackups(backupType);
    
    // Upload to cloud nếu được cấu hình
    if (securityConfig.backup.locations.cloud) {
      await uploadToCloud(backupFilePath);
    }
    
    return {
      success: true,
      fileName: backupFileName,
      size: fileSizeMB,
      path: backupFilePath,
    };
    
  } catch (error) {
    logger.error(`❌ Database backup failed: ${error.message}`);
    auditLogger.logBackup('failed', `${backupType} backup failed: ${error.message}`);
    
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Mã hóa file backup (sử dụng OpenSSL hoặc các công cụ khác)
 */
const encryptBackup = async (filePath) => {
  try {
    logger.info(`🔐 Encrypting backup file...`);
    
    // Sử dụng OpenSSL để mã hóa (yêu cầu OpenSSL được cài đặt)
    // const encryptedPath = `${filePath}.enc`;
    // const password = process.env.BACKUP_ENCRYPTION_KEY || 'default-key-change-this';
    // 
    // await execPromise(
    //   `openssl enc -aes-256-cbc -salt -in "${filePath}" -out "${encryptedPath}" -pass pass:${password}`
    // );
    // 
    // // Xóa file gốc sau khi mã hóa
    // fs.unlinkSync(filePath);
    // 
    // logger.info(`✅ Backup encrypted successfully`);
    // return encryptedPath;
    
    // Chú ý: Cần cài đặt OpenSSL và thiết lập BACKUP_ENCRYPTION_KEY trong .env
    logger.warn('⚠️ Backup encryption is enabled but not implemented. Please configure OpenSSL.');
    
  } catch (error) {
    logger.error(`Failed to encrypt backup: ${error.message}`);
  }
};

/**
 * Dọn dẹp các backup cũ theo chính sách retention
 */
const cleanupOldBackups = async (backupType) => {
  try {
    const retention = securityConfig.backup.retention[backupType] || 7;
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith(`backup_${backupType}_`))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);
    
    // Xóa các file backup cũ hơn retention
    const filesToDelete = files.slice(retention);
    
    for (const file of filesToDelete) {
      fs.unlinkSync(file.path);
      logger.info(`🗑️ Deleted old backup: ${file.name}`);
    }
    
    if (filesToDelete.length > 0) {
      logger.info(`Cleaned up ${filesToDelete.length} old backup files`);
    }
    
  } catch (error) {
    logger.error(`Failed to cleanup old backups: ${error.message}`);
  }
};

/**
 * Upload backup lên cloud storage
 */
const uploadToCloud = async (filePath) => {
  try {
    // TODO: Implement cloud upload (AWS S3, Azure Blob, Google Cloud Storage)
    // Ví dụ với AWS S3:
    // const AWS = require('aws-sdk');
    // const s3 = new AWS.S3();
    // const fileContent = fs.readFileSync(filePath);
    // const params = {
    //   Bucket: process.env.S3_BUCKET,
    //   Key: path.basename(filePath),
    //   Body: fileContent,
    // };
    // await s3.upload(params).promise();
    
    logger.info('☁️ Cloud upload feature is configured but not implemented yet');
  } catch (error) {
    logger.error(`Failed to upload to cloud: ${error.message}`);
  }
};

/**
 * Khôi phục database từ backup
 */
const restoreDatabase = async (backupFileName) => {
  const backupFilePath = path.join(backupDir, backupFileName);
  
  try {
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFileName}`);
    }
    
    logger.warn(`⚠️ Starting database restore from ${backupFileName}...`);
    auditLogger.log({
      action: 'DATABASE_RESTORE_STARTED',
      details: `Restoring from ${backupFileName}`,
      severity: 'warning',
    });
    
    const pool = await sql.connect({
      user: dbConfig.username,
      password: dbConfig.password,
      database: 'master', // Kết nối tới master để restore
      server: dbConfig.host,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    });
    
    // Set database to single user mode
    await pool.request().query(`
      ALTER DATABASE [${dbConfig.database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    `);
    
    // Restore database
    const restoreQuery = `
      RESTORE DATABASE [${dbConfig.database}] 
      FROM DISK = '${backupFilePath.replace(/\\/g, '/')}'
      WITH REPLACE, STATS = 10;
    `;
    
    await pool.request().query(restoreQuery);
    
    // Set back to multi user mode
    await pool.request().query(`
      ALTER DATABASE [${dbConfig.database}] SET MULTI_USER;
    `);
    
    await pool.close();
    
    logger.info(`✅ Database restored successfully from ${backupFileName}`);
    auditLogger.log({
      action: 'DATABASE_RESTORE_COMPLETED',
      details: `Successfully restored from ${backupFileName}`,
      severity: 'warning',
    });
    
    return { success: true };
    
  } catch (error) {
    logger.error(`❌ Database restore failed: ${error.message}`);
    auditLogger.log({
      action: 'DATABASE_RESTORE_FAILED',
      details: `Failed to restore from ${backupFileName}: ${error.message}`,
      severity: 'error',
    });
    
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Liệt kê tất cả các backup có sẵn
 */
const listBackups = () => {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup_'))
      .map(file => {
        const stats = fs.statSync(path.join(backupDir, file));
        return {
          name: file,
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          created: stats.mtime.toISOString(),
          path: path.join(backupDir, file),
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return files;
  } catch (error) {
    logger.error(`Failed to list backups: ${error.message}`);
    return [];
  }
};

/**
 * Chạy backup theo lịch
 */
const scheduleBackups = () => {
  if (!securityConfig.backup.enabled) {
    logger.info('Backup is disabled in configuration');
    return;
  }
  
  logger.info('📅 Backup scheduler initialized');
  
  // Daily backup - chạy lúc 2 giờ sáng
  const dailyTime = securityConfig.backup.schedule.daily.split(':');
  const dailyHour = parseInt(dailyTime[0]);
  const dailyMinute = parseInt(dailyTime[1]);
  
  const scheduleDailyBackup = () => {
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      dailyHour,
      dailyMinute,
      0
    );
    
    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeout = scheduledTime.getTime() - now.getTime();
    
    setTimeout(() => {
      backupDatabase('daily');
      setInterval(() => {
        backupDatabase('daily');
      }, 24 * 60 * 60 * 1000); // Repeat every 24 hours
    }, timeout);
    
    logger.info(`Daily backup scheduled at ${dailyHour}:${dailyMinute}`);
  };
  
  scheduleDailyBackup();
};

// Export functions
module.exports = {
  backupDatabase,
  restoreDatabase,
  listBackups,
  scheduleBackups,
  cleanupOldBackups,
};

// Chạy scheduler nếu file được execute trực tiếp
if (require.main === module) {
  logger.info('Starting backup scheduler...');
  scheduleBackups();
  
  // Chạy backup ngay lập tức để test
  backupDatabase('manual').then(result => {
    if (result.success) {
      logger.info('Test backup completed successfully');
    } else {
      logger.error('Test backup failed');
    }
  });
}
