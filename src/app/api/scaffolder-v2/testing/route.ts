import { NextRequest, NextResponse } from 'next/server';
import { TemplateTestingEngine } from '@/lib/scaffolder-v2/testing-engine';
import { ScaffolderTemplate, TemplateTestResult } from '@/lib/scaffolder-v2/types';

const testingEngine = TemplateTestingEngine.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, testConfiguration } = body;

    if (!template) {
      return NextResponse.json(
        { error: 'Template is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('type'); // 'full', 'quick', 'validation', 'sample'

    switch (testType) {
      case 'full':
        // Run comprehensive test suite
        const fullResults = await testingEngine.runTestSuite(template, testConfiguration || {});
        return NextResponse.json(fullResults);

      case 'quick':
        // Run quick validation only
        const quickResults = await testingEngine.runQuickValidation(template);
        return NextResponse.json({
          templateId: template.id,
          version: template.version,
          validationResults: quickResults,
          executedAt: new Date().toISOString()
        });

      case 'validation':
        // Run template validation
        const validationResults = await testingEngine.validateTemplate(template);
        return NextResponse.json({
          templateId: template.id,
          version: template.version,
          validationResults,
          executedAt: new Date().toISOString()
        });

      case 'sample':
        // Run sample execution
        const sampleParameters = body.sampleParameters;
        const sampleResults = await testingEngine.runSampleExecution(template, sampleParameters);
        return NextResponse.json({
          templateId: template.id,
          version: template.version,
          sampleExecution: sampleResults,
          executedAt: new Date().toISOString()
        });

      default:
        // Default to full test suite
        const defaultResults = await testingEngine.runTestSuite(template, testConfiguration || {});
        return NextResponse.json(defaultResults);
    }
  } catch (error) {
    console.error('Error running template tests:', error);
    return NextResponse.json(
      { error: 'Failed to run template tests' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const templateId = searchParams.get('templateId');

    switch (action) {
      case 'coverage':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required for coverage analysis' },
            { status: 400 }
          );
        }

        // This would need to fetch the template first
        const mockTemplate: ScaffolderTemplate = {
          id: templateId,
          name: 'Mock Template',
          description: 'Mock template for coverage analysis',
          version: '1.0.0',
          category: 'Test',
          tags: [],
          author: { name: 'Test', email: 'test@example.com' },
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            downloads: 0,
            rating: 0,
            complexity: 'medium',
            estimatedTime: '15-30 minutes'
          },
          spec: {
            parameters: [],
            steps: [],
            outputs: []
          }
        };

        const coverage = await testingEngine.analyzeCoverage(mockTemplate);
        return NextResponse.json(coverage);

      case 'generate-tests':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required for test generation' },
            { status: 400 }
          );
        }

        const generatedTests = await testingEngine.generateTestCases(mockTemplate);
        return NextResponse.json({ generatedTests });

      case 'capabilities':
        return NextResponse.json({
          supportedTestTypes: [
            'unit',
            'integration',
            'e2e',
            'performance',
            'security'
          ],
          supportedEnvironments: [
            'docker',
            'kubernetes',
            'local',
            'lightweight'
          ],
          features: {
            automatedTestGeneration: true,
            coverageAnalysis: true,
            performanceTesting: true,
            securityTesting: true,
            regressionTesting: true,
            realTimeReporting: true
          },
          limits: {
            maxExecutionTime: 600000, // 10 minutes
            maxTemplateSize: 10485760, // 10MB
            maxConcurrentTests: 5
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: coverage, generate-tests, capabilities' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling test request:', error);
    return NextResponse.json(
      { error: 'Failed to handle test request' },
      { status: 500 }
    );
  }
}