'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Play,
 Square,
 RotateCcw,
 TestTube,
 CheckCircle,
 XCircle,
 AlertTriangle,
 Clock,
 Terminal,
 FileText,
 Settings,
 Download,
 Eye,
 EyeOff,
 Zap,
 Bug,
 Shield,
 Cpu,
 MemoryStick,
 Activity,
 Layers,
 Code,
 Globe,
 Plus
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { useTemplate, useDryRunTemplate } from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity, DryRunResponse } from '@/services/backstage/types/templates';

interface TemplateTestEnvironmentProps {
 templateRef: string;
 className?: string;
}

interface TestCase {
 id: string;
 name: string;
 description: string;
 parameters: Record<string, any>;
 expectedOutput?: {
 files: string[];
 steps: string[];
 validations: string[];
 };
 status: 'pending' | 'running' | 'passed' | 'failed';
 duration?: number;
 error?: string;
 results?: DryRunResponse;
}

interface TestSuite {
 id: string;
 name: string;
 testCases: TestCase[];
 status: 'pending' | 'running' | 'passed' | 'failed' | 'partial';
}

interface PreviewEnvironment {
 id: string;
 name: string;
 status: 'starting' | 'ready' | 'error' | 'stopped';
 url?: string;
 resources: {
 cpu: number;
 memory: number;
 storage: number;
 };
 createdAt: string;
 logs: Array<{
 timestamp: string;
 level: 'info' | 'warn' | 'error';
 message: string;
 }>;
}

const TestCaseCard: React.FC<{
 testCase: TestCase;
 onRun: (testCase: TestCase) => void;
 onView: (testCase: TestCase) => void;
 expanded?: boolean;
 onToggleExpand?: () => void;
}> = ({ testCase, onRun, onView, expanded, onToggleExpand }) => {
 const statusConfig = {
 pending: { color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
 running: { color: 'text-blue-600', bg: 'bg-blue-100', icon: Play },
 passed: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
 failed: { color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
 };

 const config = statusConfig[testCase.status];
 const StatusIcon = config.icon;

 return (
 <div className="border rounded-lg bg-card">
 <div 
 className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
 onClick={onToggleExpand}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={cn('p-2 rounded-full', config.bg)}>
 <StatusIcon className={cn('w-4 h-4', config.color)} />
 </div>
 <div>
 <h4 className="font-medium">{testCase.name}</h4>
 <p className="text-sm text-muted-foreground">{testCase.description}</p>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 {testCase.duration && (
 <span className="text-xs text-muted-foreground">
 {testCase.duration}ms
 </span>
 )}
 <button
 onClick={(e) => {
 e.stopPropagation();
 onRun(testCase);
 }}
 disabled={testCase.status === 'running'}
 className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-accent transition-colors disabled:opacity-50"
 >
 <Play className="w-3 h-3" />
 Run
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onView(testCase);
 }}
 className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-accent transition-colors"
 >
 <Eye className="w-3 h-3" />
 View
 </button>
 </div>
 </div>
 </div>

 {expanded && (
 <div className="border-t p-4 space-y-4">
 {/* Parameters */}
 <div>
 <h5 className="font-medium mb-2">Test Parameters</h5>
 <div className="bg-muted/30 rounded p-3 text-sm">
 <pre className="whitespace-pre-wrap overflow-x-auto">
 {JSON.stringify(testCase.parameters, null, 2)}
 </pre>
 </div>
 </div>

 {/* Expected Output */}
 {testCase.expectedOutput && (
 <div>
 <h5 className="font-medium mb-2">Expected Output</h5>
 <div className="space-y-2 text-sm">
 <div>
 <span className="font-medium">Files:</span>
 <ul className="mt-1 space-y-1">
 {testCase.expectedOutput.files.map((file, index) => (
 <li key={index} className="flex items-center gap-2">
 <FileText className="w-3 h-3" />
 <code className="text-xs">{file}</code>
 </li>
 ))}
 </ul>
 </div>
 
 <div>
 <span className="font-medium">Steps:</span>
 <ul className="mt-1 space-y-1">
 {testCase.expectedOutput.steps.map((step, index) => (
 <li key={index} className="flex items-center gap-2">
 <Zap className="w-3 h-3" />
 <span className="text-xs">{step}</span>
 </li>
 ))}
 </ul>
 </div>
 </div>
 </div>
 )}

 {/* Results */}
 {testCase.results && (
 <div>
 <h5 className="font-medium mb-2">Test Results</h5>
 <div className="space-y-2">
 <div className="text-sm">
 <span className="font-medium">Generated Steps:</span>
 <div className="mt-1 space-y-1">
 {testCase.results.steps.map((step, index) => (
 <div key={index} className="flex items-center gap-2">
 <CheckCircle className="w-3 h-3 text-green-600" />
 <span className="text-xs">{step.name}</span>
 <code className="text-xs text-muted-foreground">{step.action}</code>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Error */}
 {testCase.error && (
 <div className="bg-red-50 border border-red-200 rounded p-3">
 <div className="flex items-center gap-2 font-medium text-red-800 mb-1">
 <Bug className="w-4 h-4" />
 Test Failed
 </div>
 <div className="text-sm text-red-700">{testCase.error}</div>
 </div>
 )}
 </div>
 )}
 </div>
 );
};

const PreviewEnvironmentCard: React.FC<{
 environment: PreviewEnvironment;
 onStart: () => void;
 onStop: () => void;
 onView: () => void;
}> = ({ environment, onStart, onStop, onView }) => {
 const statusConfig = {
 starting: { color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
 ready: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
 error: { color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
 stopped: { color: 'text-gray-600', bg: 'bg-gray-100', icon: Square },
 };

 const config = statusConfig[environment.status];
 const StatusIcon = config.icon;

 return (
 <div className="border rounded-lg bg-card p-4">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className={cn('p-2 rounded-full', config.bg)}>
 <StatusIcon className={cn('w-4 h-4', config.color)} />
 </div>
 <div>
 <h4 className="font-medium">{environment.name}</h4>
 <p className="text-sm text-muted-foreground">
 Created {new Date(environment.createdAt).toLocaleDateString()}
 </p>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 {environment.status === 'ready' && environment.url && (
 <button
 onClick={onView}
 className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Globe className="w-3 h-3" />
 View
 </button>
 )}
 
 {environment.status === 'stopped' ? (
 <button
 onClick={onStart}
 className="flex items-center gap-1 px-3 py-1 rounded text-sm border border-border hover:bg-accent"
 >
 <Play className="w-3 h-3" />
 Start
 </button>
 ) : (
 <button
 onClick={onStop}
 disabled={environment.status === 'starting'}
 className="flex items-center gap-1 px-3 py-1 rounded text-sm border border-border hover:bg-accent disabled:opacity-50"
 >
 <Square className="w-3 h-3" />
 Stop
 </button>
 )}
 </div>
 </div>

 {/* Resource usage */}
 <div className="grid grid-cols-3 gap-4 text-sm">
 <div className="flex items-center gap-2">
 <Cpu className="w-4 h-4 text-blue-600" />
 <span>CPU: {environment.resources.cpu}%</span>
 </div>
 <div className="flex items-center gap-2">
 <MemoryStick className="w-4 h-4 text-green-600" />
 <span>RAM: {environment.resources.memory}%</span>
 </div>
 <div className="flex items-center gap-2">
 <Activity className="w-4 h-4 text-purple-600" />
 <span>Storage: {environment.resources.storage}%</span>
 </div>
 </div>

 {/* Recent logs */}
 {environment.logs.length > 0 && (
 <div className="mt-4">
 <h5 className="font-medium mb-2 text-sm">Recent Logs</h5>
 <div className="bg-black text-green-400 font-mono text-xs p-3 rounded max-h-32 overflow-y-auto">
 {environment.logs.slice(-5).map((log, index) => (
 <div key={index} className={cn(
 'mb-1',
 log.level === 'error' && 'text-red-400',
 log.level === 'warn' && 'text-yellow-400'
 )}>
 [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

export const TemplateTestEnvironment: React.FC<TemplateTestEnvironmentProps> = ({
 templateRef,
 className,
}) => {
 const [activeTab, setActiveTab] = useState<'tests' | 'preview' | 'security'>('tests');
 const [expandedTest, setExpandedTest] = useState<string | null>(null);
 const [runningTests, setRunningTests] = useState<Set<string>>(new Set());

 const { data: template } = useTemplate(templateRef);
 const dryRunMutation = useDryRunTemplate();

 // Mock test suites
 const [testSuites, setTestSuites] = useState<TestSuite[]>([
 {
 id: 'basic',
 name: 'Basic Functionality',
 status: 'pending',
 testCases: [
 {
 id: 'basic-params',
 name: 'Basic Parameters',
 description: 'Test template with minimal required parameters',
 parameters: {
 name: 'test-service',
 description: 'A test service',
 owner: 'platform-team',
 },
 status: 'pending',
 expectedOutput: {
 files: ['catalog-info.yaml', 'README.md', 'src/index.js'],
 steps: ['fetch:template', 'publish:github', 'catalog:register'],
 validations: ['Valid YAML', 'No security issues', 'All files generated'],
 },
 },
 {
 id: 'edge-cases',
 name: 'Edge Cases',
 description: 'Test template with edge case parameters',
 parameters: {
 name: 'test-service-with-very-long-name-that-might-cause-issues',
 description: 'A test service with special characters !@#$%^&*()',
 owner: 'team-with-special.chars',
 },
 status: 'pending',
 },
 ],
 },
 {
 id: 'integration',
 name: 'Integration Tests',
 status: 'pending',
 testCases: [
 {
 id: 'github-integration',
 name: 'GitHub Integration',
 description: 'Test GitHub repository creation and setup',
 parameters: {
 name: 'github-test-service',
 description: 'Testing GitHub integration',
 repoUrl: { host: 'github.com', owner: 'test-org', repo: 'test-repo' },
 },
 status: 'pending',
 },
 ],
 },
 ]);

 // Mock preview environments
 const [previewEnvironments, setPreviewEnvironments] = useState<PreviewEnvironment[]>([
 {
 id: 'main',
 name: 'Main Preview',
 status: 'ready',
 url: 'https://preview-main.example.com',
 resources: { cpu: 25, memory: 40, storage: 15 },
 createdAt: '2024-01-20T10:00:00Z',
 logs: [
 { timestamp: '2024-01-20T10:05:00Z', level: 'info', message: 'Environment started successfully' },
 { timestamp: '2024-01-20T10:06:00Z', level: 'info', message: 'Template rendered successfully' },
 { timestamp: '2024-01-20T10:07:00Z', level: 'info', message: 'Preview available at https://preview-main.example.com' },
 ],
 },
 ]);

 const runTest = useCallback(async (testCase: TestCase) => {
 setRunningTests(prev => new Set(prev).add(testCase.id));
 
 // Update test status
 setTestSuites(prev => prev.map(suite => ({
 ...suite,
 testCases: suite.testCases.map(tc => 
 tc.id === testCase.id ? { ...tc, status: 'running' } : tc
 ),
 })));

 try {
 const startTime = Date.now();
 const result = await dryRunMutation.mutateAsync({
 templateRef,
 values: testCase.parameters,
 });

 const duration = Date.now() - startTime;

 // Update test with results
 setTestSuites(prev => prev.map(suite => ({
 ...suite,
 testCases: suite.testCases.map(tc => 
 tc.id === testCase.id ? {
 ...tc,
 status: 'passed',
 duration,
 results: result,
 } : tc
 ),
 })));
 } catch (error) {
 // Update test with error
 setTestSuites(prev => prev.map(suite => ({
 ...suite,
 testCases: suite.testCases.map(tc => 
 tc.id === testCase.id ? {
 ...tc,
 status: 'failed',
 error: error instanceof Error ? error.message : 'Unknown error',
 } : tc
 ),
 })));
 } finally {
 setRunningTests(prev => {
 const newSet = new Set(prev);
 newSet.delete(testCase.id);
 return newSet;
 });
 }
 }, [templateRef, dryRunMutation]);

 const runAllTests = useCallback(async () => {
 for (const suite of testSuites) {
 for (const testCase of suite.testCases) {
 if (testCase.status === 'pending' || testCase.status === 'failed') {
 await runTest(testCase);
 }
 }
 }
 }, [testSuites, runTest]);

 return (
 <div className={cn('space-y-6', className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <TestTube className="w-6 h-6 text-primary" />
 <div>
 <h2 className="text-2xl font-bold">Template Testing</h2>
 <p className="text-sm text-muted-foreground">
 Test and preview template functionality before deployment
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={runAllTests}
 disabled={runningTests.size > 0}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 <Play className="w-4 h-4" />
 Run All Tests
 </button>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex border-b">
 {[
 { id: 'tests', label: 'Tests', icon: TestTube },
 { id: 'preview', label: 'Preview', icon: Eye },
 { id: 'security', label: 'Security', icon: Shield },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={cn(
 'flex items-center gap-1 px-4 py-2 text-sm transition-colors border-b-2',
 activeTab === tab.id
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 )}
 >
 <tab.icon className="w-4 h-4" />
 {tab.label}
 </button>
 ))}
 </div>

 {/* Content */}
 {activeTab === 'tests' && (
 <div className="space-y-6">
 {testSuites.map(suite => (
 <div key={suite.id} className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold">{suite.name}</h3>
 <div className="text-sm text-muted-foreground">
 {suite.testCases.filter(tc => tc.status === 'passed').length} / {suite.testCases.length} passed
 </div>
 </div>

 <div className="space-y-3">
 {suite.testCases.map(testCase => (
 <TestCaseCard
 key={testCase.id}
 testCase={testCase}
 onRun={runTest}
 onView={() => console.log('View test:', testCase.id)}
 expanded={expandedTest === testCase.id}
 onToggleExpand={() => setExpandedTest(
 expandedTest === testCase.id ? null : testCase.id
 )}
 />
 ))}
 </div>
 </div>
 ))}
 </div>
 )}

 {activeTab === 'preview' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold">Preview Environments</h3>
 <button className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent">
 <Plus className="w-4 h-4" />
 Create Environment
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {previewEnvironments.map(env => (
 <PreviewEnvironmentCard
 key={env.id}
 environment={env}
 onStart={() => console.log('Start environment:', env.id)}
 onStop={() => console.log('Stop environment:', env.id)}
 onView={() => window.open(env.url, '_blank')}
 />
 ))}
 </div>
 </div>
 )}

 {activeTab === 'security' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold">Security Analysis</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-card rounded-lg border p-6">
 <div className="flex items-center gap-2 mb-4">
 <Shield className="w-5 h-5 text-green-600" />
 <h4 className="font-medium">Security Scan Results</h4>
 </div>
 
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm">Vulnerabilities</span>
 <span className="font-medium text-green-600">0 High, 1 Medium</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">Code Quality</span>
 <span className="font-medium text-green-600">A+</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">Dependencies</span>
 <span className="font-medium text-green-600">Up to date</span>
 </div>
 </div>
 </div>

 <div className="bg-card rounded-lg border p-6">
 <div className="flex items-center gap-2 mb-4">
 <Bug className="w-5 h-5 text-yellow-600" />
 <h4 className="font-medium">Issues Found</h4>
 </div>
 
 <div className="space-y-2 text-sm">
 <div className="flex items-start gap-2">
 <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
 <div>
 <p className="font-medium">Medium: Hardcoded API endpoint</p>
 <p className="text-muted-foreground">Consider using environment variables</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};