#!/usr/bin/env tsx

/**
 * Production Database Setup Script
 * 
 * This script sets up the enterprise database for production deployment:
 * - Validates environment configuration
 * - Runs schema migrations with optimized indexes
 * - Configures connection pooling and monitoring
 * - Sets up backup and recovery systems
 * - Performs validation and performance testing
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getDatabaseManager } from '../src/lib/database/connection';
import { migrationManager } from '../src/lib/database/migrations';
import { databaseMonitor } from '../src/lib/database/monitoring';
import { createBackupManager } from '../src/lib/database/backup';
import { db } from '../src/lib/database/client';

interface SetupConfig {
  environment: 'development' | 'staging' | 'production';
  skipMigrations: boolean;
  skipIndexes: boolean;
  skipBackup: boolean;
  verbose: boolean;
}

class DatabaseSetup {
  constructor(private config: SetupConfig) {}

  async run(): Promise<void> {
    console.log('🚀 Starting enterprise database setup');
    console.log(`📋 Environment: ${this.config.environment}`);
    console.log(`⚙️ Configuration: ${JSON.stringify(this.config, null, 2)}`);

    try {
      // Step 1: Validate environment and prerequisites
      await this.validateEnvironment();

      // Step 2: Test database connectivity
      await this.testConnectivity();

      // Step 3: Run database migrations
      if (!this.config.skipMigrations) {
        await this.runMigrations();
      }

      // Step 4: Create optimized indexes
      if (!this.config.skipIndexes) {
        await this.createIndexes();
      }

      // Step 5: Set up monitoring
      await this.setupMonitoring();

      // Step 6: Set up backup system
      if (!this.config.skipBackup) {
        await this.setupBackups();
      }

      // Step 7: Validate setup
      await this.validateSetup();

      // Step 8: Generate setup report
      await this.generateReport();

      console.log('✅ Database setup completed successfully!');
      console.log('🎯 Your enterprise database is ready for production');

    } catch (error) {
      console.error('❌ Database setup failed:', error);
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating environment configuration...');

    // Check required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'NODE_ENV'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate DATABASE_URL format
    try {
      const dbUrl = new URL(process.env.DATABASE_URL!);
      console.log(`✅ Database URL format valid (${dbUrl.hostname}:${dbUrl.port})`);
    } catch {
      throw new Error('Invalid DATABASE_URL format');
    }

    // Check if prisma schema exists
    const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
    if (!existsSync(schemaPath)) {
      throw new Error('Prisma schema file not found at prisma/schema.prisma');
    }

    // Check if this is production environment
    if (this.config.environment === 'production') {
      console.log('⚠️ Production environment detected - extra validations will be performed');
      
      // Check for production-specific environment variables
      const productionVars = [
        'DB_POOL_MIN',
        'DB_POOL_MAX',
        'BACKUP_ENABLED'
      ];
      
      const missingProdVars = productionVars.filter(varName => !process.env[varName]);
      if (missingProdVars.length > 0) {
        console.warn(`⚠️ Recommended production variables not set: ${missingProdVars.join(', ')}`);
      }
    }

    console.log('✅ Environment validation completed');
  }

  private async testConnectivity(): Promise<void> {
    console.log('🔌 Testing database connectivity...');

    const dbManager = getDatabaseManager();
    
    try {
      const isHealthy = await db.healthCheck();
      if (!isHealthy) {
        throw new Error('Database health check failed');
      }

      const metrics = dbManager.getMetrics();
      console.log(`✅ Database connected successfully`);
      console.log(`📊 Connection pool: ${metrics.activeConnections} active, ${metrics.idleConnections} idle`);
      
    } catch (error) {
      throw new Error(`Database connectivity test failed: ${(error as Error).message}`);
    }
  }

  private async runMigrations(): Promise<void> {
    console.log('📦 Running database migrations...');

    try {
      // Generate Prisma client first
      console.log('🔧 Generating Prisma client...');
      execSync('npx prisma generate', { 
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd()
      });

      // Run migrations based on environment
      if (this.config.environment === 'production') {
        console.log('🚀 Running production migrations...');
        execSync('npx prisma migrate deploy', { 
          stdio: this.config.verbose ? 'inherit' : 'pipe',
          cwd: process.cwd()
        });
      } else {
        console.log('🔧 Pushing development schema...');
        execSync('npx prisma db push', { 
          stdio: this.config.verbose ? 'inherit' : 'pipe',
          cwd: process.cwd()
        });
      }

      console.log('✅ Database migrations completed');
    } catch (error) {
      throw new Error(`Migration failed: ${(error as Error).message}`);
    }
  }

  private async createIndexes(): Promise<void> {
    console.log('📊 Creating enterprise-optimized indexes...');

    try {
      await migrationManager.createEnterpriseIndexes();
      console.log('✅ Enterprise indexes created successfully');
    } catch (error) {
      throw new Error(`Index creation failed: ${(error as Error).message}`);
    }
  }

  private async setupMonitoring(): Promise<void> {
    console.log('📈 Setting up database monitoring...');

    try {
      databaseMonitor.start();
      
      // Wait a few seconds for initial metrics
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const healthStatus = databaseMonitor.getHealthStatus();
      console.log(`✅ Monitoring active - Status: ${healthStatus.status}`);
      
    } catch (error) {
      console.error('⚠️ Monitoring setup failed:', error);
      // Don't fail the entire setup for monitoring issues
    }
  }

  private async setupBackups(): Promise<void> {
    console.log('💾 Setting up backup system...');

    try {
      const backupManager = createBackupManager();
      
      if (this.config.environment === 'production') {
        console.log('🔄 Creating initial production backup...');
        await backupManager.createFullBackup();
      }
      
      console.log('✅ Backup system configured');
      
    } catch (error) {
      if (this.config.environment === 'production') {
        throw new Error(`Backup setup failed: ${(error as Error).message}`);
      } else {
        console.warn('⚠️ Backup setup failed (non-production):', error);
      }
    }
  }

  private async validateSetup(): Promise<void> {
    console.log('🔍 Validating database setup...');

    try {
      // Test basic operations
      const testQueries = [
        () => db.count('user', {}),
        () => db.count('plugin', {}),
        () => db.count('service', {})
      ];

      for (const query of testQueries) {
        try {
          await query();
        } catch (error) {
          throw new Error(`Query validation failed: ${(error as Error).message}`);
        }
      }

      // Check schema integrity
      const report = await migrationManager.generateMigrationReport();
      console.log(`📋 Tables: ${report.tables.length}`);
      console.log(`📊 Indexes: ${report.indexes.length}`);
      console.log(`⚡ Index usage: ${report.performance.indexUsage}%`);
      console.log(`💾 Cache hit ratio: ${report.performance.cacheHitRatio}%`);

      if (report.performance.cacheHitRatio < 80) {
        console.warn('⚠️ Low cache hit ratio - consider increasing shared_buffers');
      }

      if (report.performance.indexUsage < 50) {
        console.warn('⚠️ Low index usage - review query patterns');
      }

      console.log('✅ Database setup validation passed');
      
    } catch (error) {
      throw new Error(`Setup validation failed: ${(error as Error).message}`);
    }
  }

  private async generateReport(): Promise<void> {
    console.log('📊 Generating setup report...');

    try {
      const report = await migrationManager.generateMigrationReport();
      const healthStatus = databaseMonitor.getHealthStatus();
      const dbManager = getDatabaseManager();
      const metrics = dbManager.getMetrics();

      console.log('\n=== DATABASE SETUP REPORT ===');
      console.log(`Environment: ${this.config.environment}`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`Status: ${healthStatus.status}`);
      console.log(`Uptime: ${Math.round(healthStatus.uptime / 1000)}s`);
      
      console.log('\n--- SCHEMA ---');
      console.log(`Tables: ${report.tables.length}`);
      console.log(`Indexes: ${report.indexes.length}`);
      
      console.log('\n--- CONNECTIONS ---');
      console.log(`Total: ${metrics.totalConnections}`);
      console.log(`Active: ${metrics.activeConnections}`);
      console.log(`Idle: ${metrics.idleConnections}`);
      console.log(`Waiting: ${metrics.waitingConnections}`);
      
      console.log('\n--- PERFORMANCE ---');
      console.log(`Average Query Time: ${metrics.averageQueryTime}ms`);
      console.log(`Total Queries: ${metrics.totalQueries}`);
      console.log(`Failed Queries: ${metrics.failedQueries}`);
      console.log(`Slow Queries: ${metrics.slowQueries}`);
      console.log(`Index Usage: ${report.performance.indexUsage}%`);
      console.log(`Cache Hit Ratio: ${report.performance.cacheHitRatio}%`);
      
      if (healthStatus.alerts.length > 0) {
        console.log('\n--- ALERTS ---');
        healthStatus.alerts.forEach(alert => {
          console.log(`${alert.severity.toUpperCase()}: ${alert.message}`);
        });
      }

      if (healthStatus.issues.length > 0) {
        console.log('\n--- ISSUES ---');
        healthStatus.issues.forEach(issue => {
          console.log(`${issue.severity.toUpperCase()}: ${issue.description}`);
        });
      }

      console.log('\n--- RECOMMENDATIONS ---');
      if (report.performance.cacheHitRatio < 90) {
        console.log('- Consider increasing shared_buffers for better cache performance');
      }
      if (report.performance.indexUsage < 70) {
        console.log('- Review query patterns and consider additional indexes');
      }
      if (metrics.slowQueries > 0) {
        console.log('- Monitor and optimize slow queries');
      }
      if (this.config.environment === 'production' && !process.env.BACKUP_ENABLED) {
        console.log('- Enable automated backups for production');
      }
      
      console.log('\n=== END REPORT ===\n');

    } catch (error) {
      console.warn('⚠️ Report generation failed:', error);
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  const config: SetupConfig = {
    environment: (process.env.NODE_ENV as any) || 'development',
    skipMigrations: args.includes('--skip-migrations'),
    skipIndexes: args.includes('--skip-indexes'),
    skipBackup: args.includes('--skip-backup'),
    verbose: args.includes('--verbose')
  };

  // Override environment if specified
  if (args.includes('--production')) {
    config.environment = 'production';
  } else if (args.includes('--staging')) {
    config.environment = 'staging';
  } else if (args.includes('--development')) {
    config.environment = 'development';
  }

  const setup = new DatabaseSetup(config);
  await setup.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

export { DatabaseSetup };