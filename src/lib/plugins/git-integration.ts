import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface GitRepository {
  url: string;
  branch: string;
  token?: string;
  username?: string;
  password?: string;
  sshKey?: string;
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  email: string;
  message: string;
  date: string;
  files: string[];
}

export interface VersionControlConfig {
  repository: GitRepository;
  pluginPath: string;
  versionTagPattern: string; // e.g., 'v{version}'
  migrationPath?: string;
  configPath?: string;
}

export class GitIntegrationService {
  private workingDir: string;
  private config: VersionControlConfig;

  constructor(config: VersionControlConfig, workingDir = '/tmp/git-workspace') {
    this.config = config;
    this.workingDir = workingDir;
  }

  /**
   * Initialize Git repository and clone if needed
   */
  async initialize(): Promise<void> {
    try {
      // Create working directory
      await fs.mkdir(this.workingDir, { recursive: true });

      // Check if repository already exists
      const gitDir = path.join(this.workingDir, '.git');
      const repoExists = await fs.access(gitDir).then(() => true).catch(() => false);

      if (!repoExists) {
        await this.cloneRepository();
      } else {
        await this.updateRepository();
      }
    } catch (error) {
      throw new Error(`Failed to initialize Git repository: ${error}`);
    }
  }

  /**
   * Clone the repository
   */
  private async cloneRepository(): Promise<void> {
    const { repository } = this.config;
    let cloneUrl = repository.url;

    // Handle authentication
    if (repository.token) {
      // GitHub token authentication
      const urlParts = repository.url.replace('https://', '').split('/');
      cloneUrl = `https://${repository.token}@${urlParts.join('/')}`;
    } else if (repository.username && repository.password) {
      // Basic authentication
      const urlParts = repository.url.replace('https://', '').split('/');
      cloneUrl = `https://${repository.username}:${repository.password}@${urlParts.join('/')}`;
    }

    const command = `git clone --branch ${repository.branch} ${cloneUrl} ${this.workingDir}`;
    execSync(command, { stdio: 'inherit' });
  }

  /**
   * Update existing repository
   */
  private async updateRepository(): Promise<void> {
    execSync(`cd ${this.workingDir} && git fetch origin ${this.config.repository.branch}`);
    execSync(`cd ${this.workingDir} && git reset --hard origin/${this.config.repository.branch}`);
  }

  /**
   * Get commit history for a plugin
   */
  async getCommitHistory(pluginPath?: string, limit = 50): Promise<GitCommitInfo[]> {
    await this.initialize();

    const targetPath = pluginPath || this.config.pluginPath;
    const command = `cd ${this.workingDir} && git log --format="%H|%an|%ae|%s|%ci" -n ${limit} ${targetPath ? `-- ${targetPath}` : ''}`;
    
    try {
      const output = execSync(command, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      
      const commits: GitCommitInfo[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const [hash, author, email, message, date] = line.split('|');
        
        // Get files changed in this commit
        const filesCommand = `cd ${this.workingDir} && git diff-tree --no-commit-id --name-only -r ${hash}`;
        const filesOutput = execSync(filesCommand, { encoding: 'utf8' });
        const files = filesOutput.trim().split('\n').filter(f => f.trim());

        commits.push({
          hash,
          author,
          email,
          message,
          date,
          files
        });
      }

      return commits;
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error}`);
    }
  }

  /**
   * Get diff between two commits
   */
  async getDiff(fromCommit: string, toCommit: string, filePath?: string): Promise<string> {
    await this.initialize();

    const targetPath = filePath || this.config.pluginPath;
    const command = `cd ${this.workingDir} && git diff ${fromCommit}..${toCommit} ${targetPath ? `-- ${targetPath}` : ''}`;
    
    try {
      return execSync(command, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Failed to get diff: ${error}`);
    }
  }

  /**
   * Create and push a new version tag
   */
  async createVersionTag(version: string, message?: string): Promise<string> {
    await this.initialize();

    const tagName = this.config.versionTagPattern.replace('{version}', version);
    const tagMessage = message || `Version ${version}`;

    try {
      // Create tag
      execSync(`cd ${this.workingDir} && git tag -a ${tagName} -m "${tagMessage}"`, { stdio: 'inherit' });
      
      // Push tag
      execSync(`cd ${this.workingDir} && git push origin ${tagName}`, { stdio: 'inherit' });

      // Get tag commit hash
      const commitHash = execSync(`cd ${this.workingDir} && git rev-list -n 1 ${tagName}`, { encoding: 'utf8' }).trim();

      return commitHash;
    } catch (error) {
      throw new Error(`Failed to create version tag: ${error}`);
    }
  }

  /**
   * Get all version tags
   */
  async getVersionTags(): Promise<Array<{ tag: string; version: string; commit: string; date: string }>> {
    await this.initialize();

    try {
      const command = `cd ${this.workingDir} && git for-each-ref --sort=-creatordate --format="%(refname:short)|%(objectname)|%(creatordate:iso)" refs/tags`;
      const output = execSync(command, { encoding: 'utf8' });
      
      const tags = output.trim().split('\n').map(line => {
        if (!line.trim()) return null;
        
        const [tag, commit, date] = line.split('|');
        const version = this.extractVersionFromTag(tag);
        
        return version ? { tag, version, commit, date } : null;
      }).filter(Boolean);

      return tags as Array<{ tag: string; version: string; commit: string; date: string }>;
    } catch (error) {
      throw new Error(`Failed to get version tags: ${error}`);
    }
  }

  /**
   * Checkout specific commit or tag
   */
  async checkout(ref: string): Promise<void> {
    await this.initialize();

    try {
      execSync(`cd ${this.workingDir} && git checkout ${ref}`, { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to checkout ${ref}: ${error}`);
    }
  }

  /**
   * Get file content at specific commit
   */
  async getFileAtCommit(filePath: string, commit: string): Promise<string> {
    await this.initialize();

    try {
      return execSync(`cd ${this.workingDir} && git show ${commit}:${filePath}`, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Failed to get file content at commit: ${error}`);
    }
  }

  /**
   * Create migration scripts from Git diff
   */
  async generateMigrationFromDiff(fromCommit: string, toCommit: string): Promise<{
    upScript: string;
    downScript: string;
    changes: Array<{ type: 'added' | 'modified' | 'deleted'; file: string; content?: string }>;
  }> {
    await this.initialize();

    try {
      // Get list of changed files
      const diffCommand = `cd ${this.workingDir} && git diff --name-status ${fromCommit}..${toCommit}`;
      const diffOutput = execSync(diffCommand, { encoding: 'utf8' });
      
      const changes: Array<{ type: 'added' | 'modified' | 'deleted'; file: string; content?: string }> = [];
      const upScriptParts: string[] = [];
      const downScriptParts: string[] = [];

      for (const line of diffOutput.trim().split('\n')) {
        if (!line.trim()) continue;
        
        const [status, filePath] = line.split('\t');
        let changeType: 'added' | 'modified' | 'deleted';

        switch (status) {
          case 'A':
            changeType = 'added';
            break;
          case 'M':
            changeType = 'modified';
            break;
          case 'D':
            changeType = 'deleted';
            break;
          default:
            continue;
        }

        let content = '';
        try {
          if (changeType !== 'deleted') {
            content = await this.getFileAtCommit(filePath, toCommit);
          }
        } catch (error) {
          // File might not exist in target commit
        }

        changes.push({ type: changeType, file: filePath, content });

        // Generate migration script parts
        if (this.isMigrationFile(filePath)) {
          upScriptParts.push(this.generateUpMigration(changeType, filePath, content));
          downScriptParts.unshift(this.generateDownMigration(changeType, filePath, content));
        }
      }

      return {
        upScript: upScriptParts.join('\n\n'),
        downScript: downScriptParts.join('\n\n'),
        changes
      };
    } catch (error) {
      throw new Error(`Failed to generate migration from diff: ${error}`);
    }
  }

  /**
   * Sync plugin version with Git repository
   */
  async syncPluginVersionWithGit(pluginId: string, version: string): Promise<{
    commit: string;
    tag?: string;
    changes: any[];
    migrations?: { up: string; down: string };
  }> {
    await this.initialize();

    try {
      // Find matching tag for version
      const versionTags = await this.getVersionTags();
      const matchingTag = versionTags.find(t => t.version === version);

      if (!matchingTag) {
        throw new Error(`No Git tag found for version ${version}`);
      }

      // Get current plugin version from database
      const currentVersion = await prisma.pluginVersion.findFirst({
        where: { pluginId, isCurrent: true }
      });

      let changes: any[] = [];
      let migrations: { up: string; down: string } | undefined;

      if (currentVersion && currentVersion.gitCommit) {
        // Get diff between current and target version
        const diff = await this.getDiff(currentVersion.gitCommit, matchingTag.commit);
        const migrationData = await this.generateMigrationFromDiff(currentVersion.gitCommit, matchingTag.commit);
        
        changes = migrationData.changes;
        migrations = {
          up: migrationData.upScript,
          down: migrationData.downScript
        };
      }

      // Update plugin version with Git information
      await prisma.pluginVersion.updateMany({
        where: { pluginId, version },
        data: {
          gitCommit: matchingTag.commit,
          gitBranch: this.config.repository.branch,
          migrationScript: migrations?.up,
          rollbackScript: migrations?.down,
        }
      });

      return {
        commit: matchingTag.commit,
        tag: matchingTag.tag,
        changes,
        migrations
      };
    } catch (error) {
      throw new Error(`Failed to sync plugin version with Git: ${error}`);
    }
  }

  /**
   * Create automated backup from Git state
   */
  async createGitBackup(pluginId: string, commit: string): Promise<{
    backupPath: string;
    metadata: any;
  }> {
    await this.initialize();

    try {
      const backupId = crypto.randomBytes(16).toString('hex');
      const backupPath = `/tmp/git_backup_${backupId}`;
      await fs.mkdir(backupPath, { recursive: true });

      // Checkout specific commit
      await this.checkout(commit);

      // Create archive of plugin directory
      const pluginSourcePath = path.join(this.workingDir, this.config.pluginPath);
      const archivePath = path.join(backupPath, 'plugin_source.tar.gz');
      
      execSync(`tar -czf ${archivePath} -C ${this.workingDir} ${this.config.pluginPath}`);

      // Get commit information
      const commitInfo = await this.getCommitInfo(commit);

      // Create metadata
      const metadata = {
        source: 'git',
        commit,
        branch: this.config.repository.branch,
        commitInfo,
        pluginPath: this.config.pluginPath,
        createdAt: new Date().toISOString()
      };

      // Save metadata
      await fs.writeFile(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      return {
        backupPath: archivePath,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to create Git backup: ${error}`);
    }
  }

  /**
   * Set up Git hooks for automated version management
   */
  async setupGitHooks(): Promise<void> {
    await this.initialize();

    const hooksDir = path.join(this.workingDir, '.git', 'hooks');
    
    // Pre-commit hook
    const preCommitHook = `#!/bin/bash
# Pre-commit hook for plugin version management

# Check if package.json was modified
if git diff --cached --name-only | grep -q "package.json"; then
  echo "Package.json modified, checking version bump..."
  
  # Extract version from package.json
  VERSION=$(node -p "require('./package.json').version")
  
  # Check if version tag already exists
  if git tag -l "v$VERSION" | grep -q "v$VERSION"; then
    echo "Error: Version v$VERSION already exists. Please bump version number."
    exit 1
  fi
  
  echo "Version check passed: v$VERSION"
fi

# Run tests before commit
npm test
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
`;

    // Post-commit hook
    const postCommitHook = `#!/bin/bash
# Post-commit hook for plugin version management

# Check if this commit should create a version
if git diff HEAD~1 --name-only | grep -q "package.json"; then
  VERSION=$(node -p "require('./package.json').version")
  
  # Create version tag
  git tag -a "v$VERSION" -m "Version $VERSION"
  
  echo "Created version tag: v$VERSION"
  
  # Notify webhook about new version
  curl -X POST "${process.env.WEBHOOK_URL}/plugin-version-created" \\
    -H "Content-Type: application/json" \\
    -d "{\\"version\\": \\"$VERSION\\", \\"commit\\": \\"$(git rev-parse HEAD)\\"}"
fi
`;

    // Write hooks
    await fs.writeFile(path.join(hooksDir, 'pre-commit'), preCommitHook);
    await fs.writeFile(path.join(hooksDir, 'post-commit'), postCommitHook);

    // Make hooks executable
    execSync(`chmod +x ${path.join(hooksDir, 'pre-commit')}`);
    execSync(`chmod +x ${path.join(hooksDir, 'post-commit')}`);
  }

  /**
   * Monitor repository for changes
   */
  async startRepositoryMonitoring(callback: (event: { type: string; data: any }) => void): Promise<void> {
    const monitorInterval = setInterval(async () => {
      try {
        await this.updateRepository();
        
        // Check for new commits
        const recentCommits = await this.getCommitHistory(this.config.pluginPath, 5);
        
        // Check if there are new version tags
        const versionTags = await this.getVersionTags();
        
        callback({
          type: 'repository_updated',
          data: {
            latestCommit: recentCommits[0],
            recentCommits,
            latestVersionTag: versionTags[0]
          }
        });
      } catch (error) {
        callback({
          type: 'monitoring_error',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }, 60000); // Check every minute

    // Return cleanup function
    return () => clearInterval(monitorInterval);
  }

  // Private helper methods

  private extractVersionFromTag(tag: string): string | null {
    const pattern = this.config.versionTagPattern.replace('{version}', '(.+)');
    const regex = new RegExp(pattern);
    const match = tag.match(regex);
    return match ? match[1] : null;
  }

  private isMigrationFile(filePath: string): boolean {
    return filePath.includes('/migrations/') || 
           filePath.endsWith('.migration.sql') ||
           filePath.endsWith('.migration.js') ||
           filePath.endsWith('.migration.ts');
  }

  private generateUpMigration(changeType: 'added' | 'modified' | 'deleted', filePath: string, content: string): string {
    switch (changeType) {
      case 'added':
        return `-- Apply ${filePath}\n${content}`;
      case 'modified':
        return `-- Update ${filePath}\n${content}`;
      case 'deleted':
        return `-- Remove ${filePath}\n-- (Manual rollback required)`;
      default:
        return '';
    }
  }

  private generateDownMigration(changeType: 'added' | 'modified' | 'deleted', filePath: string, content: string): string {
    switch (changeType) {
      case 'added':
        return `-- Rollback: Remove ${filePath}\n-- (Manual rollback required)`;
      case 'modified':
        return `-- Rollback: Restore previous ${filePath}\n-- (Manual rollback required)`;
      case 'deleted':
        return `-- Rollback: Restore ${filePath}\n${content}`;
      default:
        return '';
    }
  }

  private async getCommitInfo(commit: string): Promise<GitCommitInfo> {
    const command = `cd ${this.workingDir} && git show --format="%H|%an|%ae|%s|%ci" --name-only ${commit}`;
    const output = execSync(command, { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    
    const [hash, author, email, message, date] = lines[0].split('|');
    const files = lines.slice(1).filter(line => line.trim() && !line.startsWith('commit'));

    return {
      hash,
      author,
      email,
      message,
      date,
      files
    };
  }
}

// Factory function to create Git integration service
export function createGitIntegrationService(config: VersionControlConfig): GitIntegrationService {
  return new GitIntegrationService(config);
}

// Default configuration for common Git providers
export const GitProviders = {
  GitHub: {
    getConfig: (repo: string, branch = 'main', token?: string): Partial<VersionControlConfig> => ({
      repository: {
        url: `https://github.com/${repo}.git`,
        branch,
        token
      },
      versionTagPattern: 'v{version}'
    })
  },
  
  GitLab: {
    getConfig: (repo: string, branch = 'main', token?: string): Partial<VersionControlConfig> => ({
      repository: {
        url: `https://gitlab.com/${repo}.git`,
        branch,
        token
      },
      versionTagPattern: 'v{version}'
    })
  },
  
  Bitbucket: {
    getConfig: (repo: string, branch = 'main', username?: string, password?: string): Partial<VersionControlConfig> => ({
      repository: {
        url: `https://bitbucket.org/${repo}.git`,
        branch,
        username,
        password
      },
      versionTagPattern: 'v{version}'
    })
  }
};

export default GitIntegrationService;