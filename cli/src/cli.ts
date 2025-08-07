#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import updateNotifier from 'update-notifier';
import { readFileSync } from 'fs';
import { join } from 'path';

import { ConfigManager } from './config/config-manager';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';

// Import commands
import { authCommand } from './commands/auth';
import { configCommand } from './commands/config';
import { pluginsCommand } from './commands/plugins';
import { workflowsCommand } from './commands/workflows';
import { searchCommand } from './commands/search';
import { healthCommand } from './commands/health';
import { metricsCommand } from './commands/metrics';
import { notificationsCommand } from './commands/notifications';
import { tenantsCommand } from './commands/tenants';
import { devCommand } from './commands/dev';
import { initCommand } from './commands/init';

// Get package info
const packagePath = join(__dirname, '../package.json');
const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'));

// Initialize logger and error handler
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

// Check for updates
updateNotifier({ pkg: packageInfo }).notify();

const program = new Command();

// Configure CLI
program
  .name('backstage-cli')
  .alias('bsdp')
  .description('Command-line interface for Backstage Developer Portal')
  .version(packageInfo.version)
  .option('-v, --verbose', 'enable verbose logging')
  .option('--debug', 'enable debug logging')
  .option('-c, --config <path>', 'path to config file')
  .hook('preAction', async (thisCommand) => {
    const options = thisCommand.opts();
    
    // Set log level
    if (options.debug) {
      logger.setLevel('debug');
    } else if (options.verbose) {
      logger.setLevel('info');
    }
    
    // Load configuration
    const configManager = ConfigManager.getInstance();
    if (options.config) {
      await configManager.loadConfig(options.config);
    } else {
      await configManager.loadDefaultConfig();
    }
    
    logger.debug('CLI initialized with options:', options);
  })
  .hook('postAction', () => {
    // Cleanup after command execution
    logger.debug('Command execution completed');
  });

// Add commands
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(authCommand);
program.addCommand(pluginsCommand);
program.addCommand(workflowsCommand);
program.addCommand(searchCommand);
program.addCommand(healthCommand);
program.addCommand(metricsCommand);
program.addCommand(notificationsCommand);
program.addCommand(tenantsCommand);
program.addCommand(devCommand);

// Add help examples
program.addHelpText('after', `
Examples:
  ${chalk.green('$ backstage-cli init')}                    Initialize CLI configuration
  ${chalk.green('$ backstage-cli auth login')}             Authenticate with portal
  ${chalk.green('$ backstage-cli plugins list')}           List available plugins
  ${chalk.green('$ backstage-cli plugins install catalog')} Install catalog plugin
  ${chalk.green('$ backstage-cli workflows list')}         List workflows
  ${chalk.green('$ backstage-cli health')}                 Check system health
  ${chalk.green('$ backstage-cli search "api docs"')}      Search portal resources
  ${chalk.green('$ backstage-cli dev serve')}              Start development server

For more help on a specific command:
  ${chalk.green('$ backstage-cli <command> --help')}
`);

// Handle unknown commands
program.on('command:*', (operands) => {
  logger.error(`Unknown command: ${operands[0]}`);
  logger.info(`Run '${program.name()} --help' to see available commands.`);
  process.exitCode = 1;
});

// Global error handling
process.on('uncaughtException', (error) => {
  errorHandler.handleError(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  errorHandler.handleError(new Error(`Unhandled promise rejection: ${reason}`));
  process.exit(1);
});

// Show banner for help command
const originalHelpInformation = program.helpInformation.bind(program);
program.helpInformation = function() {
  const banner = boxen(
    chalk.bold.blue('Backstage Developer Portal CLI\n') +
    chalk.gray(`v${packageInfo.version}\n`) +
    chalk.yellow('Manage your developer portal from the command line'),
    {
      padding: 1,
      borderColor: 'blue',
      borderStyle: 'round'
    }
  );
  
  return banner + '\n\n' + originalHelpInformation();
};

// Parse command line arguments
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    errorHandler.handleError(error as Error);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}

export { program };