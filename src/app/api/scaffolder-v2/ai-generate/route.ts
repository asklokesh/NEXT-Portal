import { NextRequest, NextResponse } from 'next/server';
import { AITemplateGenerator } from '@/lib/scaffolder-v2/ai-template-generator';
import { AITemplateRequest, AITemplateResponse } from '@/lib/scaffolder-v2/types';

export async function POST(request: NextRequest) {
  try {
    const body: AITemplateRequest = await request.json();
    
    // Validate request
    if (!body.naturalLanguageDescription) {
      return NextResponse.json(
        { error: 'Natural language description is required' },
        { status: 400 }
      );
    }

    // Generate template using AI
    const generator = AITemplateGenerator.getInstance();
    const response: AITemplateResponse = await generator.generateFromNaturalLanguage(body);

    return NextResponse.json(response);
  } catch (error) {
    console.error('AI template generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get AI capabilities and supported features
    const capabilities = {
      supportedTechnologies: [
        'typescript', 'javascript', 'react', 'vue', 'angular', 
        'nodejs', 'python', 'java', 'go', 'rust',
        'docker', 'kubernetes', 'aws', 'gcp', 'azure'
      ],
      supportedPlatforms: ['web', 'mobile', 'api', 'microservice', 'library'],
      supportedComplexity: ['simple', 'medium', 'complex'],
      supportedCloudProviders: ['aws', 'gcp', 'azure', 'multi-cloud'],
      features: {
        naturalLanguageProcessing: true,
        contextAwareGeneration: true,
        multiTechnologySupport: true,
        smartParameterGeneration: true,
        bestPracticeIntegration: true,
        realTimeGeneration: true
      },
      limits: {
        maxDescriptionLength: 1000,
        maxGenerationTime: 30000,
        maxTemplatesPerHour: 100
      }
    };

    return NextResponse.json({ capabilities });
  } catch (error) {
    console.error('Error getting AI capabilities:', error);
    return NextResponse.json(
      { error: 'Failed to get AI capabilities' },
      { status: 500 }
    );
  }
}