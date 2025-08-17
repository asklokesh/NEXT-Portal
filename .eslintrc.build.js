/** 
 * ESLint configuration optimized for build performance and case sensitivity
 * Used during CI/CD builds for faster linting
 */

module.exports = {
  extends: ['./.eslintrc.js'],
  
  // Performance optimizations for builds
  cache: true,
  cacheLocation: '.next/cache/eslint/',
  
  // Focused rules for case sensitivity and critical issues only
  rules: {
    // Case sensitivity enforcement
    'import/no-unresolved': ['error', { 
      caseSensitive: true,
      caseSensitiveStrict: true 
    }],
    
    // Critical import/export issues only
    'import/no-duplicates': 'error',
    'import/no-cycle': 'error',
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'never',
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': false // Enforce case sensitivity
      }
    }],
    
    // Disable non-critical rules for faster builds
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'jsx-a11y/alt-text': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
    
    // Keep only critical React rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  
  // Optimized parser options for speed
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    },
    // Disable type-aware linting for speed (use separate command for full checks)
    project: false
  },
  
  // Ignore patterns for faster linting
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'build/',
    'dist/',
    'coverage/',
    'storybook-static/',
    '**/*.config.js',
    '**/*.config.ts',
    '**/generated/**',
    '**/*.d.ts',
    'backstage/',
    'scripts/',
    'docs/',
    'tests/',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*'
  ]
};