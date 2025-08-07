const nextJest = require('next/jest');

const createJestConfig = nextJest({
 dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
 setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
 testEnvironment: 'jsdom',
 moduleDirectories: ['node_modules', '<rootDir>/'],
 moduleNameMapper: {
 // Path aliases
 '^@/(.*)$': '<rootDir>/src/$1',
 '^@components/(.*)$': '<rootDir>/src/components/$1',
 '^@services/(.*)$': '<rootDir>/src/services/$1',
 '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
 '^@types/(.*)$': '<rootDir>/src/types/$1',
 '^@utils/(.*)$': '<rootDir>/src/utils/$1',
 '^@lib/(.*)$': '<rootDir>/src/lib/$1',
 '^@config/(.*)$': '<rootDir>/src/config/$1',
 '^@store/(.*)$': '<rootDir>/src/store/$1',
 '^@tests/(.*)$': '<rootDir>/tests/$1',
 
 // Mock static assets
 '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
 '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
 
 // Mock modules that don't work well in Jest
 '^d3$': '<rootDir>/__mocks__/d3Mock.js',
 '^three$': '<rootDir>/__mocks__/threeMock.js',
 '^@tensorflow/tfjs$': '<rootDir>/__mocks__/tensorflowMock.js',
 '^socket.io-client$': '<rootDir>/__mocks__/socketIOMock.js',
 },
 testMatch: [
 '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
 '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
 '<rootDir>/tests/unit/**/*.{js,jsx,ts,tsx}',
 '<rootDir>/tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}',
 ],
 collectCoverageFrom: [
 'src/**/*.{js,jsx,ts,tsx}',
 '!src/**/*.d.ts',
 '!src/**/*.stories.{js,jsx,ts,tsx}',
 '!src/**/*.test.{js,jsx,ts,tsx}',
 '!src/**/*.spec.{js,jsx,ts,tsx}',
 '!src/**/__tests__/**',
 '!src/app/**/page.tsx', // Next.js app directory pages
 '!src/app/**/layout.tsx', // Next.js app directory layouts
 '!src/app/api/**', // Next.js API routes
 '!**/node_modules/**',
 '!**/.next/**',
 '!**/coverage/**',
 ],
 coverageThreshold: {
 global: {
 branches: 80,
 functions: 80,
 lines: 85,
 statements: 85,
 },
 // Specific thresholds for critical components
 'src/lib/plugins/**': {
 branches: 90,
 functions: 90,
 lines: 95,
 statements: 95,
 },
 'src/services/**': {
 branches: 85,
 functions: 85,
 lines: 90,
 statements: 90,
 },
 'src/components/plugins/**': {
 branches: 85,
 functions: 85,
 lines: 90,
 statements: 90,
 },
 },
 coverageReporters: [
 'text',
 'lcov',
 'html',
 'json-summary',
 'cobertura',
 ],
 testPathIgnorePatterns: [
 '<rootDir>/node_modules/',
 '<rootDir>/.next/',
 '<rootDir>/backstage/',
 '<rootDir>/docs/',
 '<rootDir>/tests/e2e/',
 '<rootDir>/tests/performance/',
 '<rootDir>/tests/visual/',
 '<rootDir>/tests/accessibility/',
 ],
 watchPathIgnorePatterns: [
 '<rootDir>/backstage/',
 '<rootDir>/docs/',
 '<rootDir>/tests/e2e/',
 '<rootDir>/tests/performance/',
 ],
 transformIgnorePatterns: [
 'node_modules/(?!((@azure|@aws-sdk|@google-cloud|@tanstack|@radix-ui|lucide-react|@dnd-kit|framer-motion|recharts|reactflow)/.*|.*\\.mjs$))',
 ],
 transform: {
 '^.+\\.(ts|tsx)$': ['ts-jest', {
 tsconfig: {
 jsx: 'react-jsx',
 },
 }],
 '^.+\\.(js|jsx)$': 'babel-jest',
 },
 testEnvironmentOptions: {
 url: 'http://localhost:4400',
 },
 roots: ['<rootDir>/src', '<rootDir>/tests'],
 maxWorkers: '50%',
 testTimeout: 30000,
 verbose: true,
 clearMocks: true,
 restoreMocks: true,
 
 // Advanced Jest configuration
 projects: [
 {
 displayName: 'unit',
 testMatch: ['<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
 },
 {
 displayName: 'integration',
 testMatch: ['<rootDir>/tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'],
 testEnvironment: 'node',
 },
 {
 displayName: 'contracts',
 testMatch: ['<rootDir>/tests/contracts/**/*.{test,spec}.{js,jsx,ts,tsx}'],
 testEnvironment: 'node',
 },
 ],
 
 // Performance monitoring
 detectOpenHandles: true,
 detectLeaks: true,
 
 // Test result processor for enhanced reporting
 reporters: [
 'default',
 ['jest-junit', {
 outputDirectory: 'coverage',
 outputName: 'junit.xml',
 classNameTemplate: '{classname}',
 titleTemplate: '{title}',
 }],
 ],
};

module.exports = createJestConfig(customJestConfig);