/**
 * CLI Service Types
 * Developer command-line interface for portal interactions
 */

// ============================================================================
// CLI Command Types
// ============================================================================

export interface CLICommand {
  name: string;
  description: string;
  category: CLICommandCategory;
  aliases?: string[];
  arguments?: CLIArgument[];
  options?: CLIOption[];
  examples?: CLIExample[];
  subcommands?: CLICommand[];
  handler: string; // Handler function reference
  requiresAuth?: boolean;
  requiresProject?: boolean;
  hidden?: boolean;
}

export type CLICommandCategory =
  | 'catalog'
  | 'templates'
  | 'actions'
  | 'analytics'
  | 'auth'
  | 'config'
  | 'scaffold'
  | 'deploy'
  | 'logs'
  | 'debug'
  | 'plugin';

export interface CLIArgument {
  name: string;
  description: string;
  type: CLIValueType;
  required?: boolean;
  default?: any;
  choices?: string[];
  variadic?: boolean;
}

export interface CLIOption {
  name: string;
  short?: string;
  description: string;
  type: CLIValueType;
  required?: boolean;
  default?: any;
  choices?: string[];
  env?: string; // Environment variable fallback
}

export type CLIValueType = 'string' | 'number' | 'boolean' | 'array' | 'json';

export interface CLIExample {
  description: string;
  command: string;
  output?: string;
}

// ============================================================================
// CLI Configuration Types
// ============================================================================

export interface CLIConfig {
  version: string;
  apiUrl: string;
  token?: string;
  organization?: string;
  project?: string;
  outputFormat: OutputFormat;
  color: boolean;
  verbose: boolean;
  timeout: number;
  retries: number;
}

export type OutputFormat = 'table' | 'json' | 'yaml' | 'csv' | 'plain';

export interface CLIContext {
  config: CLIConfig;
  cwd: string;
  isInteractive: boolean;
  spinner?: CLISpinner;
  logger: CLILogger;
}

export interface CLISpinner {
  start: (message: string) => void;
  stop: () => void;
  succeed: (message?: string) => void;
  fail: (message?: string) => void;
  warn: (message?: string) => void;
  info: (message?: string) => void;
}

export interface CLILogger {
  log: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
  table: (data: any[], columns?: string[]) => void;
  json: (data: any) => void;
}

// ============================================================================
// CLI Result Types
// ============================================================================

export interface CLIResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: CLIError;
  warnings?: string[];
}

export interface CLIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  suggestion?: string;
  docsUrl?: string;
}

// ============================================================================
// CLI Plugin Types
// ============================================================================

export interface CLIPlugin {
  name: string;
  version: string;
  description: string;
  commands: CLICommand[];
  hooks?: CLIHook[];
  config?: CLIPluginConfig;
}

export interface CLIHook {
  event: CLIHookEvent;
  handler: string;
}

export type CLIHookEvent =
  | 'prerun'
  | 'postrun'
  | 'init'
  | 'login'
  | 'logout'
  | 'error';

export interface CLIPluginConfig {
  settings?: Record<string, any>;
  requiredEnvVars?: string[];
  dependencies?: string[];
}

// ============================================================================
// CLI Session Types
// ============================================================================

export interface CLISession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  organization?: string;
  permissions: string[];
}

export interface CLIAuthResult {
  session: CLISession;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// ============================================================================
// Predefined Commands
// ============================================================================

export const CLI_COMMANDS: CLICommand[] = [
  // Catalog commands
  {
    name: 'catalog',
    description: 'Manage software catalog entities',
    category: 'catalog',
    subcommands: [
      {
        name: 'list',
        description: 'List catalog entities',
        category: 'catalog',
        options: [
          { name: 'kind', short: 'k', description: 'Filter by entity kind', type: 'string' },
          { name: 'owner', short: 'o', description: 'Filter by owner', type: 'string' },
          { name: 'tag', short: 't', description: 'Filter by tag', type: 'array' },
          { name: 'limit', short: 'l', description: 'Maximum results', type: 'number', default: 20 },
          { name: 'format', short: 'f', description: 'Output format', type: 'string', choices: ['table', 'json', 'yaml'] },
        ],
        examples: [
          { description: 'List all components', command: 'portal catalog list -k Component' },
          { description: 'List APIs owned by platform team', command: 'portal catalog list -k API -o group:platform-team' },
        ],
        handler: 'catalogList',
        requiresAuth: true,
      },
      {
        name: 'get',
        description: 'Get details of an entity',
        category: 'catalog',
        arguments: [
          { name: 'ref', description: 'Entity reference (kind:namespace/name)', type: 'string', required: true },
        ],
        options: [
          { name: 'format', short: 'f', description: 'Output format', type: 'string', default: 'yaml' },
          { name: 'relations', short: 'r', description: 'Include relations', type: 'boolean' },
        ],
        examples: [
          { description: 'Get a component', command: 'portal catalog get Component:default/api-gateway' },
        ],
        handler: 'catalogGet',
        requiresAuth: true,
      },
      {
        name: 'register',
        description: 'Register an entity from a catalog-info.yaml',
        category: 'catalog',
        arguments: [
          { name: 'location', description: 'URL or file path to catalog-info.yaml', type: 'string', required: true },
        ],
        options: [
          { name: 'dry-run', description: 'Preview without registering', type: 'boolean' },
        ],
        handler: 'catalogRegister',
        requiresAuth: true,
      },
    ],
    handler: 'catalog',
    requiresAuth: true,
  },

  // Template commands
  {
    name: 'template',
    description: 'Work with software templates',
    category: 'templates',
    aliases: ['tmpl', 'scaffold'],
    subcommands: [
      {
        name: 'list',
        description: 'List available templates',
        category: 'templates',
        options: [
          { name: 'category', short: 'c', description: 'Filter by category', type: 'string' },
          { name: 'golden-path', short: 'g', description: 'Show only golden path templates', type: 'boolean' },
        ],
        handler: 'templateList',
        requiresAuth: true,
      },
      {
        name: 'run',
        description: 'Execute a template',
        category: 'templates',
        arguments: [
          { name: 'template', description: 'Template name or ref', type: 'string', required: true },
        ],
        options: [
          { name: 'values', short: 'v', description: 'Template values as JSON or file path', type: 'string' },
          { name: 'interactive', short: 'i', description: 'Run in interactive mode', type: 'boolean', default: true },
          { name: 'dry-run', description: 'Preview without executing', type: 'boolean' },
          { name: 'output', short: 'o', description: 'Output directory', type: 'string' },
        ],
        examples: [
          { description: 'Run template interactively', command: 'portal template run nodejs-service' },
          { description: 'Run with values file', command: 'portal template run nodejs-service -v ./values.json' },
        ],
        handler: 'templateRun',
        requiresAuth: true,
      },
    ],
    handler: 'template',
    requiresAuth: true,
  },

  // Action commands
  {
    name: 'action',
    description: 'Execute self-service actions',
    category: 'actions',
    aliases: ['act'],
    subcommands: [
      {
        name: 'list',
        description: 'List available actions',
        category: 'actions',
        options: [
          { name: 'category', short: 'c', description: 'Filter by category', type: 'string' },
          { name: 'entity', short: 'e', description: 'Actions for a specific entity', type: 'string' },
        ],
        handler: 'actionList',
        requiresAuth: true,
      },
      {
        name: 'run',
        description: 'Execute an action',
        category: 'actions',
        arguments: [
          { name: 'action', description: 'Action ID or name', type: 'string', required: true },
        ],
        options: [
          { name: 'entity', short: 'e', description: 'Target entity ref', type: 'string' },
          { name: 'params', short: 'p', description: 'Action parameters as JSON', type: 'string' },
          { name: 'reason', short: 'r', description: 'Reason for execution', type: 'string' },
          { name: 'wait', short: 'w', description: 'Wait for completion', type: 'boolean', default: true },
        ],
        examples: [
          { description: 'Deploy to production', command: 'portal action run deploy -e Component:default/api-gateway -p \'{"environment":"production"}\'' },
        ],
        handler: 'actionRun',
        requiresAuth: true,
      },
      {
        name: 'status',
        description: 'Check action execution status',
        category: 'actions',
        arguments: [
          { name: 'execution-id', description: 'Execution ID', type: 'string', required: true },
        ],
        handler: 'actionStatus',
        requiresAuth: true,
      },
    ],
    handler: 'action',
    requiresAuth: true,
  },

  // Auth commands
  {
    name: 'login',
    description: 'Authenticate with the portal',
    category: 'auth',
    options: [
      { name: 'token', short: 't', description: 'API token', type: 'string' },
      { name: 'sso', description: 'Use SSO authentication', type: 'boolean' },
      { name: 'browser', short: 'b', description: 'Open browser for auth', type: 'boolean', default: true },
    ],
    handler: 'login',
    requiresAuth: false,
  },
  {
    name: 'logout',
    description: 'Log out from the portal',
    category: 'auth',
    handler: 'logout',
    requiresAuth: false,
  },
  {
    name: 'whoami',
    description: 'Show current user info',
    category: 'auth',
    handler: 'whoami',
    requiresAuth: true,
  },

  // Config commands
  {
    name: 'config',
    description: 'Manage CLI configuration',
    category: 'config',
    subcommands: [
      {
        name: 'get',
        description: 'Get a config value',
        category: 'config',
        arguments: [{ name: 'key', description: 'Config key', type: 'string' }],
        handler: 'configGet',
        requiresAuth: false,
      },
      {
        name: 'set',
        description: 'Set a config value',
        category: 'config',
        arguments: [
          { name: 'key', description: 'Config key', type: 'string', required: true },
          { name: 'value', description: 'Config value', type: 'string', required: true },
        ],
        handler: 'configSet',
        requiresAuth: false,
      },
      {
        name: 'list',
        description: 'List all config values',
        category: 'config',
        handler: 'configList',
        requiresAuth: false,
      },
    ],
    handler: 'config',
    requiresAuth: false,
  },

  // Scaffold command
  {
    name: 'init',
    description: 'Initialize a new project with portal configuration',
    category: 'scaffold',
    options: [
      { name: 'template', short: 't', description: 'Base template to use', type: 'string' },
      { name: 'name', short: 'n', description: 'Project name', type: 'string' },
      { name: 'owner', short: 'o', description: 'Owner reference', type: 'string' },
      { name: 'tags', description: 'Comma-separated tags', type: 'string' },
    ],
    handler: 'init',
    requiresAuth: true,
  },

  // Analytics commands
  {
    name: 'analytics',
    description: 'View analytics and metrics',
    category: 'analytics',
    aliases: ['metrics', 'stats'],
    subcommands: [
      {
        name: 'dora',
        description: 'View DORA metrics',
        category: 'analytics',
        options: [
          { name: 'team', short: 't', description: 'Team ID', type: 'string' },
          { name: 'service', short: 's', description: 'Service ID', type: 'string' },
          { name: 'period', short: 'p', description: 'Time period', type: 'string', default: 'month', choices: ['week', 'month', 'quarter'] },
        ],
        handler: 'analyticsDora',
        requiresAuth: true,
      },
      {
        name: 'cost',
        description: 'View cost analytics',
        category: 'analytics',
        options: [
          { name: 'team', short: 't', description: 'Team ID', type: 'string' },
          { name: 'service', short: 's', description: 'Service ID', type: 'string' },
          { name: 'period', short: 'p', description: 'Time period', type: 'string', default: 'month' },
        ],
        handler: 'analyticsCost',
        requiresAuth: true,
      },
    ],
    handler: 'analytics',
    requiresAuth: true,
  },

  // Logs command
  {
    name: 'logs',
    description: 'View logs for an entity',
    category: 'logs',
    arguments: [
      { name: 'entity', description: 'Entity reference', type: 'string', required: true },
    ],
    options: [
      { name: 'follow', short: 'f', description: 'Follow log output', type: 'boolean' },
      { name: 'tail', short: 'n', description: 'Number of lines', type: 'number', default: 100 },
      { name: 'since', description: 'Show logs since duration (e.g., 1h, 30m)', type: 'string' },
      { name: 'container', short: 'c', description: 'Container name', type: 'string' },
    ],
    handler: 'logs',
    requiresAuth: true,
  },

  // Plugin command
  {
    name: 'plugin',
    description: 'Manage CLI plugins',
    category: 'plugin',
    subcommands: [
      {
        name: 'list',
        description: 'List installed plugins',
        category: 'plugin',
        handler: 'pluginList',
        requiresAuth: false,
      },
      {
        name: 'install',
        description: 'Install a plugin',
        category: 'plugin',
        arguments: [{ name: 'name', description: 'Plugin name or package', type: 'string', required: true }],
        handler: 'pluginInstall',
        requiresAuth: false,
      },
      {
        name: 'remove',
        description: 'Remove a plugin',
        category: 'plugin',
        arguments: [{ name: 'name', description: 'Plugin name', type: 'string', required: true }],
        handler: 'pluginRemove',
        requiresAuth: false,
      },
    ],
    handler: 'plugin',
    requiresAuth: false,
  },
];
