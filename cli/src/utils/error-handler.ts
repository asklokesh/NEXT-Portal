import chalk from 'chalk';

export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'CLIError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleError(error: any): never {
  if (error instanceof CLIError) {
    console.error(chalk.red('Error:'), error.message);
    
    if (error.code) {
      console.error(chalk.gray(`  Code: ${error.code}`));
    }
    
    if (error.statusCode) {
      console.error(chalk.gray(`  Status: ${error.statusCode}`));
    }
    
    process.exit(1);
  }
  
  if (error.response) {
    // Axios error
    const status = error.response.status;
    const data = error.response.data;
    
    console.error(chalk.red('API Error:'), error.message);
    console.error(chalk.gray(`  Status: ${status}`));
    
    if (data && data.message) {
      console.error(chalk.gray(`  Message: ${data.message}`));
    }
    
    if (data && data.errors) {
      console.error(chalk.gray('  Details:'));
      data.errors.forEach((err: any) => {
        console.error(chalk.gray(`    - ${err.message || err}`));
      });
    }
    
    process.exit(1);
  }
  
  if (error.code === 'ECONNREFUSED') {
    console.error(chalk.red('Connection Error:'), 'Unable to connect to the server');
    console.error(chalk.gray('  Please check:'));
    console.error(chalk.gray('    - Server is running'));
    console.error(chalk.gray('    - Base URL is correct'));
    console.error(chalk.gray('    - Network connectivity'));
    process.exit(1);
  }
  
  if (error.code === 'ENOTFOUND') {
    console.error(chalk.red('DNS Error:'), 'Host not found');
    console.error(chalk.gray('  Please check the base URL in your configuration'));
    process.exit(1);
  }
  
  if (error.code === 'ETIMEDOUT') {
    console.error(chalk.red('Timeout Error:'), 'Request timed out');
    console.error(chalk.gray('  Try increasing the timeout in your configuration'));
    process.exit(1);
  }
  
  // Generic error
  console.error(chalk.red('Unexpected Error:'), error.message);
  
  if (process.env.DEBUG) {
    console.error(chalk.gray('\nStack trace:'));
    console.error(chalk.gray(error.stack));
  } else {
    console.error(chalk.gray('\nRun with DEBUG=1 for more details'));
  }
  
  process.exit(1);
}
