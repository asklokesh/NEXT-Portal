import { NextRequest, NextResponse } from 'next/server';
import { DynamicParameterEngine } from '@/lib/scaffolder-v2/parameter-engine';
import { TemplateParameter, SmartParameter } from '@/lib/scaffolder-v2/types';

const parameterEngine = DynamicParameterEngine.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, templateContext, userContext, parameters } = body;

    switch (action) {
      case 'generate':
        // Generate smart parameters for template
        if (!templateContext) {
          return NextResponse.json(
            { error: 'Template context is required' },
            { status: 400 }
          );
        }

        const smartParameters = await parameterEngine.generateSmartParameters(
          templateContext,
          userContext || {}
        );

        return NextResponse.json({ parameters: smartParameters });

      case 'enhance':
        // Enhance existing parameter with AI capabilities
        const { parameter } = body;
        if (!parameter || !templateContext) {
          return NextResponse.json(
            { error: 'Parameter and template context are required' },
            { status: 400 }
          );
        }

        const enhanced = await parameterEngine.enhanceParameter(
          parameter,
          templateContext,
          userContext || {}
        );

        return NextResponse.json({ parameter: enhanced });

      case 'validate':
        // Validate parameter value
        const { parameter: paramToValidate, value } = body;
        if (!paramToValidate || value === undefined) {
          return NextResponse.json(
            { error: 'Parameter and value are required' },
            { status: 400 }
          );
        }

        const validation = await parameterEngine.validateParameterValue(
          paramToValidate,
          value,
          templateContext || {}
        );

        return NextResponse.json({ validation });

      case 'auto-fill':
        // Auto-fill parameter based on context
        const { parameter: paramToFill, context: autoFillContext } = body;
        if (!paramToFill || !autoFillContext) {
          return NextResponse.json(
            { error: 'Parameter and auto-fill context are required' },
            { status: 400 }
          );
        }

        const autoFillValue = await parameterEngine.autoFillParameter(
          paramToFill,
          autoFillContext
        );

        return NextResponse.json({ value: autoFillValue });

      case 'suggest':
        // Get suggestions for parameter value
        const { parameter: paramForSuggestions, currentValue } = body;
        if (!paramForSuggestions) {
          return NextResponse.json(
            { error: 'Parameter is required' },
            { status: 400 }
          );
        }

        const suggestions = await parameterEngine.getSuggestions(
          paramForSuggestions,
          currentValue,
          templateContext || {},
          userContext || {}
        );

        return NextResponse.json({ suggestions });

      case 'conditional':
        // Create conditional parameters
        const { baseParameters, currentValues } = body;
        if (!baseParameters || !currentValues || !templateContext) {
          return NextResponse.json(
            { error: 'Base parameters, current values, and template context are required' },
            { status: 400 }
          );
        }

        const conditionalParameters = await parameterEngine.createConditionalParameters(
          baseParameters,
          currentValues,
          templateContext
        );

        return NextResponse.json({ parameters: conditionalParameters });

      case 'organize':
        // Organize parameters into groups
        const { smartParameters, userPreferences } = body;
        if (!smartParameters) {
          return NextResponse.json(
            { error: 'Smart parameters are required' },
            { status: 400 }
          );
        }

        const groups = await parameterEngine.organizeParameters(
          smartParameters,
          userPreferences || {}
        );

        return NextResponse.json({ groups });

      case 'help':
        // Generate help for parameter
        const { parameter: paramForHelp } = body;
        if (!paramForHelp || !templateContext) {
          return NextResponse.json(
            { error: 'Parameter and template context are required' },
            { status: 400 }
          );
        }

        const help = await parameterEngine.generateParameterHelp(
          paramForHelp,
          templateContext
        );

        return NextResponse.json({ help });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling parameter request:', error);
    return NextResponse.json(
      { error: 'Failed to handle parameter request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { parameter, value, outcome, templateContext } = body;

    if (!parameter || !outcome) {
      return NextResponse.json(
        { error: 'Parameter and outcome are required for learning' },
        { status: 400 }
      );
    }

    // Learn from parameter usage
    await parameterEngine.learnFromUsage(
      parameter,
      value,
      outcome,
      templateContext || {}
    );

    return NextResponse.json({
      success: true,
      message: 'Parameter usage recorded for learning'
    });
  } catch (error) {
    console.error('Error learning from parameter usage:', error);
    return NextResponse.json(
      { error: 'Failed to record parameter usage' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'capabilities':
        return NextResponse.json({
          supportedParameterTypes: [
            'string',
            'number',
            'boolean',
            'array',
            'object',
            'select',
            'multiselect'
          ],
          supportedWidgets: [
            'text',
            'textarea',
            'number',
            'checkbox',
            'select',
            'radio',
            'date',
            'file'
          ],
          features: {
            aiEnhancement: true,
            smartValidation: true,
            autoFill: true,
            dynamicSuggestions: true,
            conditionalParameters: true,
            smartGrouping: true,
            contextAwareHelp: true,
            learningFromUsage: true
          },
          limits: {
            maxParameters: 100,
            maxEnumOptions: 50,
            maxValidationRules: 10
          }
        });

      case 'types':
        return NextResponse.json({
          parameterTypes: [
            {
              type: 'string',
              description: 'Text input',
              validation: ['pattern', 'min', 'max'],
              widgets: ['text', 'textarea']
            },
            {
              type: 'number',
              description: 'Numeric input',
              validation: ['min', 'max'],
              widgets: ['number']
            },
            {
              type: 'boolean',
              description: 'True/false value',
              validation: [],
              widgets: ['checkbox']
            },
            {
              type: 'select',
              description: 'Single selection from options',
              validation: ['enum'],
              widgets: ['select', 'radio']
            },
            {
              type: 'multiselect',
              description: 'Multiple selections from options',
              validation: ['enum'],
              widgets: ['multiselect']
            },
            {
              type: 'array',
              description: 'List of values',
              validation: ['min', 'max'],
              widgets: ['array']
            },
            {
              type: 'object',
              description: 'Complex object',
              validation: ['properties'],
              widgets: ['object']
            }
          ]
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: capabilities, types' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling parameter info request:', error);
    return NextResponse.json(
      { error: 'Failed to get parameter information' },
      { status: 500 }
    );
  }
}