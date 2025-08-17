/**
 * ESLint Security Configuration
 * Security-focused rules for enterprise applications
 */

module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:security/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  plugins: [
    'security',
    'no-secrets',
    '@typescript-eslint'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Security Rules
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'error',
    'security/detect-object-injection': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',

    // Secret Detection
    'no-secrets/no-secrets': ['error', {
      'tolerance': 4.2,
      'additionalRegexes': {
        'JWT Token': 'eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*',
        'Database URL': '(postgresql|mysql|mongodb)://[^\\s]*',
        'API Key': '(api[_-]?key|apikey)[\\s]*[=:][\\s]*[\'"`]?[A-Za-z0-9_\\-]{16,}[\'"`]?',
        'Secret Key': '(secret[_-]?key|secretkey)[\\s]*[=:][\\s]*[\'"`]?[A-Za-z0-9_\\-]{16,}[\'"`]?',
        'Private Key': '-----BEGIN [A-Z]+ PRIVATE KEY-----'
      }
    }],

    // TypeScript Security Rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',

    // General Security Best Practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'no-with': 'error',
    'strict': ['error', 'global'],

    // Prevent dangerous patterns
    'no-console': ['warn', { 
      allow: ['warn', 'error'] 
    }],
    'no-debugger': 'error',
    'no-alert': 'error',

    // Input validation
    'prefer-regex-literals': 'error',
    'no-control-regex': 'error',
    'no-invalid-regexp': 'error',

    // Async security
    'require-await': 'error',
    'no-return-await': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-floating-promises': 'error',

    // Resource management
    'no-unreachable': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],

    // SQL injection prevention
    'security/detect-sql-injection': 'error'
  },
  overrides: [
    {
      // Security rules for API routes
      files: ['src/app/api/**/*.ts', 'pages/api/**/*.ts'],
      rules: {
        'security/detect-object-injection': 'error',
        'security/detect-possible-timing-attacks': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        'no-secrets/no-secrets': 'error'
      }
    },
    {
      // Stricter rules for authentication/authorization
      files: ['**/auth/**/*.ts', '**/middleware/**/*.ts', '**/security/**/*.ts'],
      rules: {
        'security/detect-possible-timing-attacks': 'error',
        'security/detect-object-injection': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        'no-secrets/no-secrets': 'error',
        '@typescript-eslint/strict-boolean-expressions': 'error'
      }
    },
    {
      // Database and ORM files
      files: ['**/lib/db/**/*.ts', '**/prisma/**/*.ts'],
      rules: {
        'security/detect-sql-injection': 'error',
        'security/detect-non-literal-fs-filename': 'error',
        '@typescript-eslint/no-explicit-any': 'error'
      }
    },
    {
      // Test files - more lenient
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
      rules: {
        'security/detect-object-injection': 'warn',
        'no-secrets/no-secrets': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'security/detect-non-literal-require': 'off'
      }
    }
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '*.config.js',
    '*.config.ts'
  ]
};