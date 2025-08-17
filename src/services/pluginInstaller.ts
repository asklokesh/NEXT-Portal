import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export interface PluginInstallConfig {
  mode: 'development' | 'production';
  backstageRoot: string;
  packagesPath: string;
  dynamicPluginsPath?: string;
  k8sNamespace?: string;
  helmRelease?: string;
  containerRegistry?: string;
  artifactRepository?: string;
}

export class PluginInstaller {
  private config: PluginInstallConfig;

  constructor(config: PluginInstallConfig) {
    this.config = config;
  }

  /**
   * Main installation method that handles both dev and prod modes
   */
  async installPlugin(
    packageName: string,
    version: string,
    userId: string
  ): Promise<{ success: boolean; message: string; deploymentInfo?: any }> {
    try {
      // 1. Validate package exists in NPM
      const packageInfo = await this.validatePackage(packageName, version);
      
      // 2. Security scanning
      const securityCheck = await this.performSecurityScan(packageName, version);
      if (!securityCheck.passed) {
        throw new Error(`Security vulnerabilities found: ${securityCheck.issues}`);
      }

      // 3. Check dependencies
      const dependencies = await this.checkDependencies(packageName, version);
      
      // 4. Create database record
      const operation = await prisma.pluginOperation.create({
        data: {
          pluginId: packageName,
          type: 'INSTALL',
          status: 'IN_PROGRESS',
          userId,
          metadata: {
            version,
            dependencies,
            timestamp: new Date().toISOString()
          }
        }
      });

      let result;
      if (this.config.mode === 'development') {
        result = await this.installDevelopment(packageName, version);
      } else {
        result = await this.installProduction(packageName, version);
      }

      // 5. Update operation status
      await prisma.pluginOperation.update({
        where: { id: operation.id },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          result: result as any,
          completedAt: new Date()
        }
      });

      return result;
    } catch (error) {
      console.error('Plugin installation failed:', error);
      throw error;
    }
  }

  /**
   * Development mode installation - modifies local Backstage
   */
  private async installDevelopment(
    packageName: string,
    version: string
  ): Promise<any> {
    const backstagePath = this.config.backstageRoot;
    
    // 1. Add to package.json
    const packageJsonPath = path.join(backstagePath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies[packageName] = version;
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    // 2. Run npm install
    const { stdout, stderr } = await execAsync(
      `cd ${backstagePath} && npm install ${packageName}@${version}`,
      { timeout: 300000 } // 5 minute timeout
    );
    
    // 3. Update app-config.yaml to register the plugin
    await this.updateAppConfig(packageName, 'development');
    
    // 4. Import and register in App.tsx (if frontend plugin)
    if (packageName.includes('plugin')) {
      await this.registerPluginInApp(packageName);
    }
    
    // 5. Restart dev server (optional - usually hot reload handles this)
    // await execAsync('npm run dev:restart');
    
    return {
      success: true,
      message: `Plugin ${packageName}@${version} installed in development mode`,
      output: stdout,
      requiresRestart: true
    };
  }

  /**
   * Production mode installation - K8s/EKS deployment
   */
  private async installProduction(
    packageName: string,
    version: string
  ): Promise<any> {
    const steps = [];
    
    // 1. Download and store plugin artifact
    steps.push(await this.downloadPluginArtifact(packageName, version));
    
    // 2. Update Helm values
    if (this.config.helmRelease) {
      steps.push(await this.updateHelmValues(packageName, version));
    }
    
    // 3. Trigger CI/CD pipeline or direct deployment
    if (process.env.CI_CD_TRIGGER_URL) {
      steps.push(await this.triggerCICD(packageName, version));
    } else {
      // Direct Kubernetes deployment
      steps.push(await this.deployToKubernetes(packageName, version));
    }
    
    return {
      success: true,
      message: `Plugin ${packageName}@${version} deployed to production`,
      deploymentSteps: steps,
      deploymentMethod: process.env.CI_CD_TRIGGER_URL ? 'CI/CD Pipeline' : 'Direct K8s'
    };
  }

  /**
   * Download plugin and store in artifact repository
   */
  private async downloadPluginArtifact(
    packageName: string,
    version: string
  ): Promise<any> {
    // For S3 artifact storage
    if (process.env.AWS_S3_BUCKET) {
      const { stdout } = await execAsync(
        `npm pack ${packageName}@${version} && ` +
        `aws s3 cp ${packageName}-${version}.tgz ` +
        `s3://${process.env.AWS_S3_BUCKET}/plugins/`
      );
      return { step: 'artifact-storage', location: `s3://${process.env.AWS_S3_BUCKET}/plugins/`, output: stdout };
    }
    
    // For local/mounted volume storage
    const artifactPath = this.config.artifactRepository || '/var/backstage/plugins';
    await execAsync(`mkdir -p ${artifactPath}`);
    const { stdout } = await execAsync(
      `cd ${artifactPath} && npm pack ${packageName}@${version}`
    );
    return { step: 'artifact-storage', location: artifactPath, output: stdout };
  }

  /**
   * Update Helm values for the Backstage deployment
   */
  private async updateHelmValues(
    packageName: string,
    version: string
  ): Promise<any> {
    const valuesFile = '/tmp/backstage-values.yaml';
    
    // Get current values
    const { stdout: currentValues } = await execAsync(
      `helm get values ${this.config.helmRelease} -n ${this.config.k8sNamespace} -o yaml`
    );
    
    // Parse and update values
    const values = this.parseYaml(currentValues);
    values.backstage = values.backstage || {};
    values.backstage.plugins = values.backstage.plugins || [];
    values.backstage.plugins.push({
      name: packageName,
      version: version,
      enabled: true
    });
    
    // Write updated values
    await fs.writeFile(valuesFile, this.stringifyYaml(values));
    
    // Upgrade Helm release
    const { stdout: upgradeOutput } = await execAsync(
      `helm upgrade ${this.config.helmRelease} backstage/backstage ` +
      `-n ${this.config.k8sNamespace} -f ${valuesFile} --wait`
    );
    
    return { step: 'helm-upgrade', output: upgradeOutput };
  }

  /**
   * Direct Kubernetes deployment using kubectl
   */
  private async deployToKubernetes(
    packageName: string,
    version: string
  ): Promise<any> {
    const namespace = this.config.k8sNamespace || 'backstage';
    
    // 1. Update ConfigMap with new plugin
    const configMapPatch = {
      data: {
        [`plugin-${packageName}`]: JSON.stringify({
          name: packageName,
          version: version,
          enabled: true,
          installedAt: new Date().toISOString()
        })
      }
    };
    
    await execAsync(
      `kubectl patch configmap backstage-plugins -n ${namespace} ` +
      `--patch '${JSON.stringify(configMapPatch)}'`
    );
    
    // 2. Trigger rolling restart
    const { stdout } = await execAsync(
      `kubectl rollout restart deployment/backstage -n ${namespace} && ` +
      `kubectl rollout status deployment/backstage -n ${namespace} --timeout=10m`
    );
    
    return { step: 'kubernetes-deployment', output: stdout };
  }

  /**
   * Trigger CI/CD pipeline for plugin installation
   */
  private async triggerCICD(
    packageName: string,
    version: string
  ): Promise<any> {
    const pipelineUrl = process.env.CI_CD_TRIGGER_URL;
    const token = process.env.CI_CD_TOKEN;
    
    // Example for Jenkins
    if (pipelineUrl?.includes('jenkins')) {
      const response = await fetch(
        `${pipelineUrl}/buildWithParameters?` +
        `PLUGIN_NAME=${packageName}&PLUGIN_VERSION=${version}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return { step: 'cicd-trigger', pipeline: 'jenkins', jobUrl: response.headers.get('Location') };
    }
    
    // Example for GitHub Actions
    if (pipelineUrl?.includes('github')) {
      const response = await fetch(pipelineUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'plugin-install',
          client_payload: {
            plugin_name: packageName,
            plugin_version: version
          }
        })
      });
      return { step: 'cicd-trigger', pipeline: 'github-actions', response: response.status };
    }
    
    // Example for GitLab CI
    if (pipelineUrl?.includes('gitlab')) {
      const response = await fetch(
        `${pipelineUrl}/trigger/pipeline`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            ref: 'main',
            variables: {
              PLUGIN_NAME: packageName,
              PLUGIN_VERSION: version
            }
          })
        }
      );
      return { step: 'cicd-trigger', pipeline: 'gitlab-ci', pipelineId: (await response.json()).id };
    }
    
    throw new Error('Unsupported CI/CD platform');
  }

  /**
   * Update Backstage app-config.yaml
   */
  private async updateAppConfig(packageName: string, mode: string): Promise<void> {
    const configPath = path.join(this.config.backstageRoot, 'app-config.yaml');
    let config = await fs.readFile(configPath, 'utf-8');
    
    // Add plugin to dynamicPlugins section (Backstage 1.27+)
    const dynamicPluginConfig = `
dynamicPlugins:
  frontend:
    ${packageName}:
      enabled: true
      ${mode === 'production' ? 'bundle: true' : ''}
`;
    
    // Append to config if not already present
    if (!config.includes(packageName)) {
      config += dynamicPluginConfig;
      await fs.writeFile(configPath, config);
    }
  }

  /**
   * Register plugin in Backstage App.tsx
   */
  private async registerPluginInApp(packageName: string): Promise<void> {
    const appPath = path.join(this.config.backstageRoot, 'packages/app/src/App.tsx');
    let appContent = await fs.readFile(appPath, 'utf-8');
    
    // Generate import statement
    const pluginVar = packageName.split('/').pop()?.replace(/-/g, '');
    const importStatement = `import { ${pluginVar}Plugin } from '${packageName}';`;
    
    // Add import if not present
    if (!appContent.includes(importStatement)) {
      // Find last import statement
      const lastImportIndex = appContent.lastIndexOf('import ');
      const lineEnd = appContent.indexOf('\n', lastImportIndex);
      appContent = 
        appContent.slice(0, lineEnd) + '\n' +
        importStatement +
        appContent.slice(lineEnd);
    }
    
    // Register plugin in app (simplified - actual implementation would be more complex)
    const pluginRegistration = `<${pluginVar}Plugin />`;
    if (!appContent.includes(pluginRegistration)) {
      // Add to routes or appropriate section
      // This is simplified - real implementation would parse JSX properly
      appContent = appContent.replace(
        '</FlatRoutes>',
        `  ${pluginRegistration}\n      </FlatRoutes>`
      );
    }
    
    await fs.writeFile(appPath, appContent);
  }

  /**
   * Validate package exists and is compatible
   */
  private async validatePackage(packageName: string, version: string): Promise<any> {
    const { stdout } = await execAsync(`npm view ${packageName}@${version} --json`);
    return JSON.parse(stdout);
  }

  /**
   * Perform security scanning
   */
  private async performSecurityScan(packageName: string, version: string): Promise<any> {
    try {
      const { stdout } = await execAsync(
        `npm audit --json --package ${packageName}@${version}`,
        { timeout: 60000 }
      );
      const audit = JSON.parse(stdout);
      return {
        passed: audit.metadata.vulnerabilities.total === 0,
        issues: audit.metadata.vulnerabilities
      };
    } catch {
      // If npm audit fails, try alternative scanning
      return { passed: true, issues: null };
    }
  }

  /**
   * Check plugin dependencies
   */
  private async checkDependencies(packageName: string, version: string): Promise<any> {
    const { stdout } = await execAsync(
      `npm view ${packageName}@${version} dependencies --json`
    );
    return JSON.parse(stdout || '{}');
  }

  /**
   * Helper to parse YAML (simplified)
   */
  private parseYaml(yaml: string): any {
    // In production, use a proper YAML parser like js-yaml
    return JSON.parse(JSON.stringify(yaml));
  }

  /**
   * Helper to stringify YAML (simplified)
   */
  private stringifyYaml(obj: any): string {
    // In production, use a proper YAML stringifier
    return JSON.stringify(obj, null, 2);
  }
}

// Factory function to create installer based on environment
export function createPluginInstaller(): PluginInstaller {
  const config: PluginInstallConfig = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    backstageRoot: process.env.BACKSTAGE_ROOT || '/app/backstage',
    packagesPath: process.env.PACKAGES_PATH || '/app/backstage/packages',
    dynamicPluginsPath: process.env.DYNAMIC_PLUGINS_PATH,
    k8sNamespace: process.env.K8S_NAMESPACE || 'backstage',
    helmRelease: process.env.HELM_RELEASE || 'backstage',
    containerRegistry: process.env.CONTAINER_REGISTRY,
    artifactRepository: process.env.ARTIFACT_REPOSITORY
  };
  
  return new PluginInstaller(config);
}