#!/usr/bin/env node

/**
 * Automated Maintenance Runner
 * Executes scheduled maintenance tasks based on frequency
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  logPath: process.env.MAINTENANCE_LOG_PATH || './logs/maintenance.log',
  reportPath: process.env.MAINTENANCE_REPORT_PATH || './maintenance-report.json',
  enableNotifications: process.env.MAINTENANCE_NOTIFICATIONS !== 'false',
  dryRun: process.env.MAINTENANCE_DRY_RUN === 'true'
};

// Maintenance task definitions
const maintenanceTasks = {
  daily: [
    {
      name: 'Health Check',
      command: 'node scripts/health-check.js',
      description: 'Verify all services are healthy',
      critical: true,
      timeout: 60000
    },
    {
      name: 'Error Log Review',
      command: 'tail -n 100 logs/application.log | grep -i error',
      description: 'Check for recent errors',
      critical: false,
      timeout: 30000
    },
    {
      name: 'Performance Check',
      command: 'node scripts/smoke-tests.js',
      description: 'Run basic performance tests',
      critical: true,
      timeout: 120000
    }
  ],
  weekly: [
    {
      name: 'Vulnerability Scan',
      command: 'VULN_EXIT_ON_FOUND=false node scripts/vulnerability-scanner.js',
      description: 'Scan dependencies for vulnerabilities',
      critical: false,
      timeout: 300000
    },
    {
      name: 'Database Analysis',
      command: 'npx prisma db execute --stdin < scripts/analyze-tables.sql',
      description: 'Analyze database performance',
      critical: false,
      timeout: 180000,
      skipIfMissing: true
    },
    {
      name: 'Log Rotation',
      command: 'find logs/ -name "*.log" -type f -mtime +7 -exec gzip {} \\;',
      description: 'Compress old log files',
      critical: false,
      timeout: 60000
    }
  ],
  monthly: [
    {
      name: 'Dependency Updates Check',
      command: 'npm outdated',
      description: 'Check for outdated dependencies',
      critical: false,
      timeout: 120000
    },
    {
      name: 'Security Audit',
      command: 'npm audit',
      description: 'Comprehensive security audit',
      critical: false,
      timeout: 180000
    },
    {
      name: 'Backup Verification',
      command: 'ls -la backups/ | tail -5',
      description: 'Verify recent backups exist',
      critical: true,
      timeout: 30000,
      skipIfMissing: true
    }
  ]
};

class MaintenanceRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      warnings: 0
    };
  }

  async runMaintenance(frequency = 'daily') {
    console.log(`🔧 Automated Maintenance Runner - ${frequency.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log(`Frequency: ${frequency}`);
    console.log(`Dry Run: ${config.dryRun}`);
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log('');

    const tasks = maintenanceTasks[frequency];
    if (!tasks || tasks.length === 0) {
      console.log(`❌ No tasks defined for frequency: ${frequency}`);
      return false;
    }

    console.log(`📋 Running ${tasks.length} maintenance tasks...`);
    console.log('');

    // Create logs directory if it doesn't exist
    const logDir = path.dirname(config.logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Run tasks sequentially
    for (const task of tasks) {
      await this.runTask(task);
    }

    await this.generateReport(frequency);
    this.printSummary();
    
    return this.stats.failed === 0;
  }

  async runTask(task) {
    const taskStart = Date.now();
    const result = {
      name: task.name,
      command: task.command,
      description: task.description,
      critical: task.critical,
      status: 'unknown',
      duration: 0,
      output: '',
      error: null,
      timestamp: new Date().toISOString()
    };

    console.log(`🔄 ${task.name}...`);
    
    try {
      // Check if we should skip this task
      if (task.skipIfMissing && this.shouldSkipTask(task)) {
        result.status = 'skipped';
        result.error = 'Required files/conditions not met';
        console.log(`   ⏭️  SKIPPED - ${result.error}`);
        this.stats.skipped++;
        this.results.push(result);
        return;
      }

      if (config.dryRun) {
        result.status = 'dry-run';
        result.output = 'Dry run mode - command not executed';
        console.log(`   🧪 DRY RUN - Would execute: ${task.command}`);
      } else {
        // Execute the task
        const output = await this.executeCommand(task.command, task.timeout);
        result.output = output;
        result.status = 'passed';
        console.log(`   ✅ PASSED (${Math.round((Date.now() - taskStart) / 1000)}s)`);
      }

      this.stats.passed++;

    } catch (error) {
      result.error = error.message;
      result.status = task.critical ? 'failed' : 'warning';
      
      if (task.critical) {
        console.log(`   ❌ FAILED - ${error.message}`);
        this.stats.failed++;
      } else {
        console.log(`   ⚠️  WARNING - ${error.message}`);
        this.stats.warnings++;
      }
    }

    result.duration = Date.now() - taskStart;
    this.results.push(result);
    this.stats.total++;

    // Log to file
    this.logTaskResult(result);
  }

  shouldSkipTask(task) {
    // Check if required files exist for tasks that need them
    if (task.command.includes('scripts/analyze-tables.sql')) {
      return !fs.existsSync('scripts/analyze-tables.sql');
    }
    if (task.command.includes('backups/')) {
      return !fs.existsSync('backups/');
    }
    return false;
  }

  async executeCommand(command, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Command execution failed: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  logTaskResult(result) {
    const logEntry = {
      timestamp: result.timestamp,
      task: result.name,
      status: result.status,
      duration: result.duration,
      critical: result.critical,
      error: result.error
    };

    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(config.logPath, logLine);
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  async generateReport(frequency) {
    const report = {
      frequency,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      config,
      stats: this.stats,
      results: this.results,
      summary: {
        overall_status: this.getOverallStatus(),
        critical_failures: this.results.filter(r => r.status === 'failed' && r.critical).length,
        recommendations: this.generateRecommendations()
      }
    };

    try {
      const reportDir = path.dirname(config.reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📊 Maintenance report: ${config.reportPath}`);
    } catch (error) {
      console.error(`Failed to generate report: ${error.message}`);
    }

    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const criticalFailures = this.results.filter(r => r.status === 'failed' && r.critical);
    const warnings = this.results.filter(r => r.status === 'warning');

    if (criticalFailures.length > 0) {
      recommendations.push({
        priority: 'immediate',
        action: 'Fix critical maintenance failures',
        description: `${criticalFailures.length} critical maintenance tasks failed`,
        tasks: criticalFailures.map(f => f.name)
      });
    }

    if (warnings.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review maintenance warnings',
        description: `${warnings.length} maintenance tasks completed with warnings`,
        tasks: warnings.map(w => w.name)
      });
    }

    const skippedTasks = this.results.filter(r => r.status === 'skipped');
    if (skippedTasks.length > 0) {
      recommendations.push({
        priority: 'low',
        action: 'Review skipped maintenance tasks',
        description: 'Some tasks were skipped due to missing prerequisites',
        tasks: skippedTasks.map(s => s.name)
      });
    }

    return recommendations;
  }

  getOverallStatus() {
    const criticalFailures = this.results.filter(r => r.status === 'failed' && r.critical).length;
    
    if (criticalFailures > 0) return 'CRITICAL';
    if (this.stats.failed > 0) return 'FAILED';
    if (this.stats.warnings > 0) return 'WARNING';
    return 'SUCCESS';
  }

  printSummary() {
    console.log('');
    console.log('📊 Maintenance Summary');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.stats.passed}/${this.stats.total}`);
    console.log(`⚠️  Warnings: ${this.stats.warnings}/${this.stats.total}`);
    console.log(`❌ Failed: ${this.stats.failed}/${this.stats.total}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}/${this.stats.total}`);
    
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('');

    const overallStatus = this.getOverallStatus();
    const statusIcon = this.getStatusIcon(overallStatus);
    console.log(`${statusIcon} Overall Status: ${overallStatus}`);
    console.log('='.repeat(60));

    // Show critical failures
    const criticalFailures = this.results.filter(r => r.status === 'failed' && r.critical);
    if (criticalFailures.length > 0) {
      console.log('');
      console.log('🚨 Critical Failures:');
      criticalFailures.forEach(failure => {
        console.log(`   - ${failure.name}: ${failure.error}`);
      });
    }

    // Show warnings
    const warnings = this.results.filter(r => r.status === 'warning');
    if (warnings.length > 0) {
      console.log('');
      console.log('⚠️  Warnings:');
      warnings.forEach(warning => {
        console.log(`   - ${warning.name}: ${warning.error}`);
      });
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'SUCCESS': return '✅';
      case 'WARNING': return '⚠️';
      case 'FAILED': return '❌';
      case 'CRITICAL': return '🔥';
      default: return '❓';
    }
  }
}

// CLI execution
if (require.main === module) {
  const frequency = process.argv[2] || 'daily';
  
  if (!maintenanceTasks[frequency]) {
    console.error(`❌ Invalid frequency: ${frequency}`);
    console.error(`Available frequencies: ${Object.keys(maintenanceTasks).join(', ')}`);
    process.exit(1);
  }

  const runner = new MaintenanceRunner();
  runner.runMaintenance(frequency)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Maintenance runner failed:', error.message);
      process.exit(1);
    });
}

module.exports = { MaintenanceRunner, maintenanceTasks };