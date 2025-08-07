import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

import { ConfigManager } from '../config/config-manager';
import { Logger } from '../utils/logger';
import { createBackstageClient } from '@backstage-idp/sdk-typescript';

const logger = Logger.getInstance();

export const initCommand = new Command('init')
  .description('Initialize CLI configuration')
  .option('-f, --force', 'overwrite existing configuration')
  .option('--global', 'create global configuration')
  .option('--local', 'create local configuration (default)')
  .action(async (options) => {
    console.log(chalk.bold.blue('Backstage CLI Setup'));
    console.log('');
    
    const configManager = ConfigManager.getInstance();
    const currentConfig = configManager.getAll();
    
    // Check if config already exists
    const configPath = options.global 
      ? join(require('os').homedir(), '.backstage-cli.yaml')
      : join(process.cwd(), '.backstage-cli.yaml');
      
    if (existsSync(configPath) && !options.force) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: `Configuration file already exists at ${configPath}. Overwrite?`,
        default: false
      }]);
      
      if (!overwrite) {
        logger.info('Setup cancelled');
        return;
      }
    }
    
    // Gather configuration
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseURL',
        message: 'Portal API base URL:',
        default: currentConfig.baseURL,
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'list',
        name: 'authMethod',
        message: 'Authentication method:',
        choices: [
          { name: 'API Key', value: 'apiKey' },
          { name: 'Bearer Token', value: 'bearerToken' },
          { name: 'Skip for now', value: 'skip' }
        ]
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key:',
        when: (answers) => answers.authMethod === 'apiKey',
        validate: (input) => input.length > 0 || 'API key cannot be empty'
      },
      {
        type: 'password', 
        name: 'bearerToken',
        message: 'Bearer Token:',
        when: (answers) => answers.authMethod === 'bearerToken',
        validate: (input) => input.length > 0 || 'Bearer token cannot be empty'
      },
      {
        type: 'list',
        name: 'format',
        message: 'Default output format:',
        choices: ['table', 'json', 'yaml'],
        default: currentConfig.format
      },
      {
        type: 'number',
        name: 'timeout',
        message: 'Request timeout (ms):',
        default: currentConfig.timeout,
        validate: (input) => input >= 1000 || 'Timeout must be at least 1000ms'
      },
      {
        type: 'number',
        name: 'retries',
        message: 'Number of retries:',
        default: currentConfig.retries,
        validate: (input) => (input >= 0 && input <= 10) || 'Retries must be between 0 and 10'
      },
      {
        type: 'list',
        name: 'logLevel',
        message: 'Log level:',
        choices: ['error', 'warn', 'info', 'debug'],
        default: currentConfig.logLevel
      },
      {
        type: 'confirm',
        name: 'autoUpdate',
        message: 'Enable automatic updates?',
        default: currentConfig.autoUpdate
      },
      {
        type: 'confirm',
        name: 'telemetry',
        message: 'Enable anonymous telemetry?',
        default: currentConfig.telemetry
      }
    ]);
    
    // Test connection if authentication provided
    if (answers.authMethod !== 'skip') {
      const spinner = ora('Testing connection...').start();
      
      try {
        const testConfig = {
          baseURL: answers.baseURL,
          apiKey: answers.apiKey,
          bearerToken: answers.bearerToken,
          timeout: answers.timeout
        };
        
        const client = createBackstageClient(testConfig);
        await client.system.getHealth();
        
        spinner.succeed('Connection test successful');
      } catch (error) {
        spinner.fail('Connection test failed');
        
        const { continueAnyway } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Continue with setup anyway?',
          default: true
        }]);
        
        if (!continueAnyway) {
          logger.info('Setup cancelled');
          return;
        }
      }
    }
    
    // Build configuration
    const newConfig = {
      baseURL: answers.baseURL,
      timeout: answers.timeout,
      retries: answers.retries,
      format: answers.format,
      logLevel: answers.logLevel,
      autoUpdate: answers.autoUpdate,
      telemetry: answers.telemetry,
      editor: currentConfig.editor,
      pager: currentConfig.pager
    };
    
    if (answers.apiKey) {
      newConfig.apiKey = answers.apiKey;
    }
    
    if (answers.bearerToken) {
      newConfig.bearerToken = answers.bearerToken;
    }
    
    // Save configuration
    try {
      configManager.setAll(newConfig);
      
      // Also save to file
      const yaml = require('js-yaml');
      const configContent = yaml.dump(newConfig, { indent: 2 });
      writeFileSync(configPath, configContent, 'utf8');
      
      logger.success(`✓ Configuration saved to ${configPath}`);
      
      // Show summary
      console.log('\n' + chalk.bold('Configuration Summary:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`Portal URL: ${chalk.cyan(newConfig.baseURL)}`);
      console.log(`Auth Method: ${chalk.cyan(answers.authMethod === 'skip' ? 'None' : answers.authMethod)}`);
      console.log(`Output Format: ${chalk.cyan(newConfig.format)}`);
      console.log(`Timeout: ${chalk.cyan(newConfig.timeout + 'ms')}`);
      console.log(`Retries: ${chalk.cyan(newConfig.retries)}`);
      console.log(`Log Level: ${chalk.cyan(newConfig.logLevel)}`);
      console.log(chalk.gray('─'.repeat(40)));
      
      // Show next steps
      console.log('\n' + chalk.bold.green('Setup completed!'));
      console.log('\nNext steps:');
      console.log(`• Run ${chalk.cyan('backstage-cli health')} to check system status`);
      console.log(`• Run ${chalk.cyan('backstage-cli plugins list')} to see available plugins`);
      console.log(`• Run ${chalk.cyan('backstage-cli --help')} to see all available commands`);
      
      if (answers.authMethod === 'skip') {
        console.log(`\n${chalk.yellow('⚠')} You can configure authentication later with:`);
        console.log(`   ${chalk.cyan('backstage-cli config set apiKey <your-key>')}`);
        console.log(`   ${chalk.cyan('backstage-cli config set bearerToken <your-token>')}`);
      }
      
    } catch (error) {
      logger.error('Failed to save configuration:', error.message);
      process.exit(1);
    }
  });