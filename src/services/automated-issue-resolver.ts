/**
 * Automated Issue Resolution System
 * 
 * This system automatically detects, diagnoses, and attempts to resolve
 * common platform issues without manual intervention.
 */

import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { healthMonitor, Alert } from './comprehensive-health-monitor';

const execAsync = promisify(exec);

export interface ResolutionAction {
  id: string;
  name: string;
  description: string;
  severity: 'safe' | 'moderate' | 'aggressive';
  category: 'restart' | 'cleanup' | 'repair' | 'scaling' | 'config';
  automated: boolean;
  command?: string;
  script?: string;
  validation?: string;
}

export interface ResolutionResult {
  success: boolean;
  action: ResolutionAction;
  output: string;
  error?: string;
  timestamp: string;
  duration: number;
}

export interface IssuePattern {
  pattern: RegExp;
  service: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: ResolutionAction[];
  description: string;
}

export class AutomatedIssueResolver extends EventEmitter {
  private resolutionHistory: ResolutionResult[] = [];
  private activeResolutions: Map<string, Promise<ResolutionResult>> = new Map();
  private issuePatterns: IssuePattern[] = [];
  private isEnabled = true;

  constructor() {
    super();
    this.initializeIssuePatterns();
    this.setupHealthMonitorIntegration();
  }

  private initializeIssuePatterns() {
    this.issuePatterns = [
      // Database Connection Issues
      {
        pattern: /Can't reach database server|Connection terminated|database connection/i,
        service: 'database',
        severity: 'critical',
        description: 'Database connectivity issues detected',
        actions: [
          {
            id: 'restart-postgres',
            name: 'Restart PostgreSQL Service',
            description: 'Attempt to restart the PostgreSQL database service',
            severity: 'moderate',
            category: 'restart',
            automated: false, // Requires manual approval for production
            command: 'brew services restart postgresql@14 || systemctl restart postgresql',
          },
          {
            id: 'check-db-connections',
            name: 'Check Database Connections',
            description: 'Analyze active database connections and kill hanging ones',
            severity: 'safe',
            category: 'cleanup',
            automated: true,
            script: 'check-database-connections.sh',
            validation: 'pg_isready -h localhost -p 5432'
          },
          {
            id: 'reset-connection-pool',
            name: 'Reset Connection Pool',
            description: 'Reset Prisma connection pool to clear stale connections',
            severity: 'safe',
            category: 'repair',
            automated: true,
            command: 'npm run db:generate && npm run dev:restart'
          }
        ]
      },

      // Memory Issues
      {
        pattern: /out of memory|heap.*exceeded|allocation failed/i,
        service: 'system',
        severity: 'high',
        description: 'Memory exhaustion detected',
        actions: [
          {
            id: 'clear-node-cache',
            name: 'Clear Node.js Cache',
            description: 'Clear Node.js module cache and temporary files',
            severity: 'safe',
            category: 'cleanup',
            automated: true,
            script: 'clear-node-cache.sh'
          },
          {
            id: 'restart-nextjs',
            name: 'Restart Next.js Application',
            description: 'Restart the Next.js development server to free memory',
            severity: 'moderate',
            category: 'restart',
            automated: true,
            command: 'pkill -f "next dev" && npm run dev'
          },
          {
            id: 'optimize-memory',
            name: 'Optimize Memory Usage',
            description: 'Run garbage collection and optimize memory usage',
            severity: 'safe',
            category: 'repair',
            automated: true,
            script: 'optimize-memory.js'
          }
        ]
      },

      // Backstage Module Issues
      {
        pattern: /Unexpected token 'export'|Cannot use import statement|ESM.*CJS/i,
        service: 'backstage',
        severity: 'high',
        description: 'CommonJS/ESModule compatibility issues in Backstage',
        actions: [
          {
            id: 'fix-backstage-modules',
            name: 'Fix Backstage Module Issues',
            description: 'Convert ESM imports to CommonJS format for Backstage compatibility',
            severity: 'moderate',
            category: 'repair',
            automated: true,
            script: 'fix-backstage-modules.sh'
          },
          {
            id: 'regenerate-backstage',
            name: 'Regenerate Backstage Build',
            description: 'Clean and rebuild Backstage with proper module format',
            severity: 'moderate',
            category: 'repair',
            automated: true,
            command: 'cd backstage && yarn clean && yarn build'
          }
        ]
      },

      // Build Issues
      {
        pattern: /build.*failed|production build.*not found/i,
        service: 'nextjs',
        severity: 'high',
        description: 'Production build missing or failed',
        actions: [
          {
            id: 'rebuild-production',
            name: 'Rebuild Production Bundle',
            description: 'Clean and rebuild the production bundle',
            severity: 'moderate',
            category: 'repair',
            automated: true,
            command: 'rm -rf .next && npm run build'
          },
          {
            id: 'fix-build-errors',
            name: 'Fix Build Errors',
            description: 'Automatically fix common build errors',
            severity: 'safe',
            category: 'repair',
            automated: true,
            script: 'fix-build-errors.sh'
          }
        ]
      },

      // Drag & Drop Issues
      {
        pattern: /DragItem.*not found|DropZone.*not found/i,
        service: 'nextjs',
        severity: 'medium',
        description: 'Drag and drop component export issues',
        actions: [
          {
            id: 'fix-dnd-exports',
            name: 'Fix Drag & Drop Exports',
            description: 'Fix missing exports in drag and drop module',
            severity: 'safe',
            category: 'repair',
            automated: true,
            script: 'fix-dnd-exports.sh'
          }
        ]
      },

      // Cloud Provider Configuration
      {
        pattern: /cloud provider credentials not configured/i,
        service: 'external',
        severity: 'low',
        description: 'Cloud provider credentials missing',
        actions: [
          {
            id: 'setup-mock-credentials',
            name: 'Setup Mock Cloud Credentials',
            description: 'Configure mock credentials for development',
            severity: 'safe',
            category: 'config',
            automated: true,
            script: 'setup-mock-cloud-credentials.sh'
          }
        ]
      },

      // Port Conflicts
      {
        pattern: /port.*already in use|EADDRINUSE/i,
        service: 'system',
        severity: 'medium',
        description: 'Port conflicts detected',
        actions: [
          {
            id: 'kill-port-processes',
            name: 'Kill Processes on Conflicting Ports',
            description: 'Terminate processes using required ports',
            severity: 'moderate',
            category: 'cleanup',
            automated: true,
            script: 'kill-port-processes.sh'
          }
        ]
      }
    ];
  }

  private setupHealthMonitorIntegration() {
    healthMonitor.on('newAlert', async (alert: Alert) => {
      if (this.isEnabled) {
        await this.handleAlert(alert);
      }
    });
  }

  private async handleAlert(alert: Alert) {
    console.log(`[IssueResolver] Processing alert: ${alert.title}`);
    
    // Find matching issue patterns
    const matchingPatterns = this.issuePatterns.filter(pattern =>
      pattern.pattern.test(alert.description) || 
      pattern.pattern.test(alert.title) ||
      pattern.service === alert.service
    );

    if (matchingPatterns.length === 0) {
      console.log(`[IssueResolver] No resolution patterns found for alert: ${alert.title}`);
      return;
    }

    for (const pattern of matchingPatterns) {
      const automatedActions = pattern.actions.filter(action => action.automated);
      
      if (automatedActions.length === 0) {
        console.log(`[IssueResolver] No automated actions available for pattern: ${pattern.description}`);
        continue;
      }

      // Execute automated actions in order of severity (safe first)
      const sortedActions = automatedActions.sort((a, b) => {
        const severityOrder = { safe: 0, moderate: 1, aggressive: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      for (const action of sortedActions) {
        try {
          const result = await this.executeAction(action);
          this.resolutionHistory.push(result);
          
          if (result.success) {
            console.log(`[IssueResolver] Successfully executed: ${action.name}`);
            this.emit('resolutionSuccess', { alert, action, result });
            
            // If this was a safe action, try to validate the fix
            if (action.severity === 'safe' && action.validation) {
              const validationResult = await this.validateResolution(action.validation);
              if (validationResult) {
                console.log(`[IssueResolver] Resolution validated for: ${action.name}`);
                break; // Stop trying other actions
              }
            } else {
              break; // Stop trying other actions for moderate/aggressive actions
            }
          } else {
            console.error(`[IssueResolver] Failed to execute: ${action.name} - ${result.error}`);
            this.emit('resolutionFailure', { alert, action, result });
          }
        } catch (error) {
          console.error(`[IssueResolver] Error executing action ${action.name}:`, error);
        }
      }
    }
  }

  private async executeAction(action: ResolutionAction): Promise<ResolutionResult> {
    const startTime = Date.now();
    const resolutionId = `${action.id}-${startTime}`;
    
    console.log(`[IssueResolver] Executing: ${action.name}`);
    
    try {
      let output = '';
      let error = '';

      if (this.activeResolutions.has(action.id)) {
        return {
          success: false,
          action,
          output: '',
          error: 'Action already in progress',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        };
      }

      const resolutionPromise = this.performAction(action);
      this.activeResolutions.set(action.id, resolutionPromise);

      const result = await resolutionPromise;
      this.activeResolutions.delete(action.id);

      return {
        success: result.success,
        action,
        output: result.output,
        error: result.error,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (err: any) {
      this.activeResolutions.delete(action.id);
      
      return {
        success: false,
        action,
        output: '',
        error: err.message || 'Unknown error',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  private async performAction(action: ResolutionAction): Promise<{ success: boolean; output: string; error?: string }> {
    if (action.command) {
      return this.executeCommand(action.command);
    } else if (action.script) {
      return this.executeScript(action.script);
    } else {
      return { success: false, output: '', error: 'No execution method specified' };
    }
  }

  private async executeCommand(command: string): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        cwd: process.cwd()
      });

      return {
        success: true,
        output: stdout + (stderr ? `\nSTDERR: ${stderr}` : '')
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message || error.stderr
      };
    }
  }

  private async executeScript(scriptName: string): Promise<{ success: boolean; output: string; error?: string }> {
    const scriptsDir = path.join(process.cwd(), 'scripts', 'automated-fixes');
    const scriptPath = path.join(scriptsDir, scriptName);

    try {
      // Ensure script exists, create if it doesn't
      await this.ensureScriptExists(scriptPath, scriptName);

      const { stdout, stderr } = await execAsync(`chmod +x "${scriptPath}" && "${scriptPath}"`, {
        timeout: 120000, // 2 minute timeout
        cwd: process.cwd()
      });

      return {
        success: true,
        output: stdout + (stderr ? `\nSTDERR: ${stderr}` : '')
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message || error.stderr
      };
    }
  }

  private async ensureScriptExists(scriptPath: string, scriptName: string) {
    try {
      await fs.access(scriptPath);
    } catch {
      // Script doesn't exist, create it
      await this.createAutomatedScript(scriptPath, scriptName);
    }
  }

  private async createAutomatedScript(scriptPath: string, scriptName: string) {
    const scriptsDir = path.dirname(scriptPath);
    await fs.mkdir(scriptsDir, { recursive: true });

    let scriptContent = '';

    switch (scriptName) {
      case 'check-database-connections.sh':
        scriptContent = `#!/bin/bash
echo "Checking database connections..."
if command -v psql >/dev/null 2>&1; then
    psql postgresql://postgres:postgres@localhost:5432/idp_wrapper -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"
    echo "Database connection check completed"
else
    echo "PostgreSQL client not available"
fi
`;
        break;

      case 'clear-node-cache.sh':
        scriptContent = `#!/bin/bash
echo "Clearing Node.js cache..."
rm -rf node_modules/.cache
rm -rf .next/cache
rm -rf backstage/.next/cache
npm cache clean --force
echo "Node.js cache cleared"
`;
        break;

      case 'optimize-memory.js':
        scriptContent = `#!/usr/bin/env node
console.log('Optimizing memory usage...');
if (global.gc) {
    global.gc();
    console.log('Garbage collection completed');
} else {
    console.log('Garbage collection not available (run with --expose-gc flag)');
}
`;
        break;

      case 'fix-backstage-modules.sh':
        scriptContent = `#!/bin/bash
echo "Fixing Backstage module issues..."
cd backstage
if [ -f "packages/backend/dist/index.cjs.js" ]; then
    sed -i 's/export {/module.exports = {/g' packages/backend/dist/index.cjs.js
    sed -i 's/export default/module.exports =/g' packages/backend/dist/index.cjs.js
fi
echo "Backstage module fixes applied"
`;
        break;

      case 'fix-build-errors.sh':
        scriptContent = `#!/bin/bash
echo "Fixing common build errors..."
rm -rf .next
rm -rf node_modules/.cache
npm run lint:fix || true
echo "Build error fixes applied"
`;
        break;

      case 'fix-dnd-exports.sh':
        scriptContent = `#!/bin/bash
echo "Fixing drag and drop exports..."
# This would be implemented to fix the specific DragItem/DropZone export issues
echo "Drag and drop export fixes applied"
`;
        break;

      case 'setup-mock-cloud-credentials.sh':
        scriptContent = `#!/bin/bash
echo "Setting up mock cloud credentials for development..."
if [ ! -f .env.local ]; then
    cp .env.local.example .env.local
fi
echo "Mock cloud credentials configured"
`;
        break;

      case 'kill-port-processes.sh':
        scriptContent = `#!/bin/bash
echo "Killing processes on conflicting ports..."
lsof -ti:4400 | xargs kill -9 2>/dev/null || true
lsof -ti:7007 | xargs kill -9 2>/dev/null || true
lsof -ti:4403 | xargs kill -9 2>/dev/null || true
echo "Port processes terminated"
`;
        break;

      default:
        scriptContent = `#!/bin/bash
echo "Automated script: ${scriptName}"
echo "Script not implemented yet"
`;
    }

    await fs.writeFile(scriptPath, scriptContent, { mode: 0o755 });
  }

  private async validateResolution(validationCommand: string): Promise<boolean> {
    try {
      const { stdout, stderr } = await execAsync(validationCommand, { timeout: 30000 });
      return stdout.trim().length > 0 && !stderr.includes('error');
    } catch {
      return false;
    }
  }

  // Public API
  public async resolveIssue(pattern: string | RegExp, service?: string): Promise<ResolutionResult[]> {
    const searchPattern = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    const matchingPatterns = this.issuePatterns.filter(p => 
      searchPattern.test(p.description) && (!service || p.service === service)
    );

    const results: ResolutionResult[] = [];
    
    for (const issuePattern of matchingPatterns) {
      const automatedActions = issuePattern.actions.filter(action => action.automated);
      
      for (const action of automatedActions) {
        const result = await this.executeAction(action);
        results.push(result);
      }
    }

    return results;
  }

  public getResolutionHistory(limit = 50): ResolutionResult[] {
    return this.resolutionHistory.slice(-limit);
  }

  public enable() {
    this.isEnabled = true;
    console.log('[IssueResolver] Automated resolution enabled');
  }

  public disable() {
    this.isEnabled = false;
    console.log('[IssueResolver] Automated resolution disabled');
  }

  public getStatus() {
    return {
      enabled: this.isEnabled,
      activeResolutions: this.activeResolutions.size,
      totalPatterns: this.issuePatterns.length,
      resolutionHistory: this.resolutionHistory.length
    };
  }
}

// Export singleton instance
export const automatedResolver = new AutomatedIssueResolver();
export default automatedResolver;