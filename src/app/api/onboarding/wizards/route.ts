/**
 * Onboarding Wizards API
 * Manages guided setup wizard sessions and configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import WizardOrchestrator, { WizardCategory } from '@/services/onboarding/WizardOrchestrator';
import AuthenticationWizard from '@/services/onboarding/AuthenticationWizard';

// Singleton orchestrator and wizards
let orchestrator: WizardOrchestrator;
let authWizard: AuthenticationWizard;

function getOrchestrator(): WizardOrchestrator {
  if (!orchestrator) {
    orchestrator = new WizardOrchestrator();
    authWizard = new AuthenticationWizard(orchestrator);
  }
  return orchestrator;
}

// GET /api/onboarding/wizards - List available wizards or get wizard details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wizardId = searchParams.get('id');
    const category = searchParams.get('category');
    const sessionId = searchParams.get('sessionId');

    const orchestrator = getOrchestrator();

    // Get specific wizard session
    if (sessionId) {
      const session = await orchestrator.getWizardSession(sessionId);
      if (!session) {
        return NextResponse.json({
          success: false,
          error: 'Wizard session not found'
        }, { status: 404 });
      }

      const wizard = orchestrator.getWizard(session.wizardId);
      const currentStep = wizard?.steps[session.currentStep];

      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          wizardId: session.wizardId,
          wizardName: wizard?.name,
          status: session.status,
          currentStep: session.currentStep,
          currentStepData: currentStep,
          progress: session.progress,
          data: session.data,
          history: session.history.slice(-10) // Last 10 history items
        }
      });
    }

    // Get specific wizard details
    if (wizardId) {
      const wizard = orchestrator.getWizard(wizardId);
      if (!wizard) {
        return NextResponse.json({
          success: false,
          error: 'Wizard not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        wizard: {
          id: wizard.id,
          name: wizard.name,
          description: wizard.description,
          category: wizard.category,
          estimatedDuration: wizard.estimatedDuration,
          steps: wizard.steps.map(step => ({
            id: step.id,
            name: step.name,
            description: step.description,
            type: step.type,
            required: step.required,
            ui: step.ui
          })),
          prerequisites: wizard.prerequisites,
          metadata: wizard.metadata
        }
      });
    }

    // Get wizards by category
    if (category) {
      const wizards = orchestrator.getWizardsByCategory(category as WizardCategory);
      
      return NextResponse.json({
        success: true,
        wizards: wizards.map(wizard => ({
          id: wizard.id,
          name: wizard.name,
          description: wizard.description,
          category: wizard.category,
          estimatedDuration: wizard.estimatedDuration,
          difficulty: wizard.metadata.difficulty,
          popularity: wizard.metadata.popularity,
          stepCount: wizard.steps.length
        }))
      });
    }

    // Get all available wizards
    const allWizards = orchestrator.getAllWizards();
    
    // Group by category
    const categorizedWizards = allWizards.reduce((acc, wizard) => {
      if (!acc[wizard.category]) {
        acc[wizard.category] = [];
      }
      acc[wizard.category].push({
        id: wizard.id,
        name: wizard.name,
        description: wizard.description,
        estimatedDuration: wizard.estimatedDuration,
        difficulty: wizard.metadata.difficulty,
        popularity: wizard.metadata.popularity,
        stepCount: wizard.steps.length
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      success: true,
      categories: Object.keys(categorizedWizards).map(category => ({
        category,
        wizards: categorizedWizards[category],
        count: categorizedWizards[category].length
      })),
      totalWizards: allWizards.length
    });

  } catch (error) {
    console.error('Failed to get wizards:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get wizards',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/onboarding/wizards - Start new wizard session or update existing session
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, wizardId, sessionId, stepData, userId, organizationId } = data;

    const orchestrator = getOrchestrator();

    if (action === 'start') {
      if (!wizardId || !userId) {
        return NextResponse.json({
          success: false,
          error: 'wizardId and userId are required to start a wizard'
        }, { status: 400 });
      }

      try {
        const session = await orchestrator.startWizard(wizardId, userId, organizationId);
        const wizard = orchestrator.getWizard(wizardId);
        
        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            wizardId: session.wizardId,
            wizardName: wizard?.name,
            status: session.status,
            currentStep: session.currentStep,
            currentStepData: wizard?.steps[session.currentStep],
            progress: session.progress
          }
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to start wizard',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    if (action === 'next') {
      if (!sessionId) {
        return NextResponse.json({
          success: false,
          error: 'sessionId is required for next step'
        }, { status: 400 });
      }

      try {
        const session = await orchestrator.nextStep(sessionId, stepData);
        const wizard = orchestrator.getWizard(session.wizardId);
        const currentStep = wizard?.steps[session.currentStep];

        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            status: session.status,
            currentStep: session.currentStep,
            currentStepData: currentStep,
            progress: session.progress,
            completed: session.status === 'completed'
          }
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to proceed to next step',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    if (action === 'previous') {
      if (!sessionId) {
        return NextResponse.json({
          success: false,
          error: 'sessionId is required for previous step'
        }, { status: 400 });
      }

      try {
        const session = await orchestrator.previousStep(sessionId);
        const wizard = orchestrator.getWizard(session.wizardId);
        const currentStep = wizard?.steps[session.currentStep];

        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            currentStep: session.currentStep,
            currentStepData: currentStep,
            progress: session.progress
          }
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to go to previous step',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    if (action === 'skip') {
      if (!sessionId) {
        return NextResponse.json({
          success: false,
          error: 'sessionId is required to skip step'
        }, { status: 400 });
      }

      try {
        const session = await orchestrator.skipStep(sessionId, stepData?.reason);
        const wizard = orchestrator.getWizard(session.wizardId);
        const currentStep = wizard?.steps[session.currentStep];

        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            currentStep: session.currentStep,
            currentStepData: currentStep,
            progress: session.progress
          }
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to skip step',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    if (action === 'pause') {
      if (!sessionId) {
        return NextResponse.json({
          success: false,
          error: 'sessionId is required to pause wizard'
        }, { status: 400 });
      }

      try {
        const session = await orchestrator.pauseSession(sessionId);
        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            status: session.status,
            progress: session.progress
          }
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to pause wizard',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    if (action === 'resume') {
      if (!sessionId) {
        return NextResponse.json({
          success: false,
          error: 'sessionId is required to resume wizard'
        }, { status: 400 });
      }

      try {
        const session = await orchestrator.resumeSession(sessionId);
        const wizard = orchestrator.getWizard(session.wizardId);
        const currentStep = wizard?.steps[session.currentStep];

        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            status: session.status,
            currentStep: session.currentStep,
            currentStepData: currentStep,
            progress: session.progress
          }
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to resume wizard',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    if (action === 'cancel') {
      if (!sessionId) {
        return NextResponse.json({
          success: false,
          error: 'sessionId is required to cancel wizard'
        }, { status: 400 });
      }

      try {
        const session = await orchestrator.cancelSession(sessionId, stepData?.reason);
        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            status: session.status
          }
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to cancel wizard',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Must be one of: start, next, previous, skip, pause, resume, cancel'
    }, { status: 400 });

  } catch (error) {
    console.error('Failed to process wizard action:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process wizard action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/onboarding/wizards - Update wizard session data
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { sessionId, updates } = data;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId is required'
      }, { status: 400 });
    }

    const orchestrator = getOrchestrator();
    const session = await orchestrator.updateSession(sessionId, updates);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        data: session.data,
        metadata: session.metadata,
        progress: session.progress
      }
    });

  } catch (error) {
    console.error('Failed to update wizard session:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update wizard session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/onboarding/wizards - Delete wizard session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId is required'
      }, { status: 400 });
    }

    // For now, just cancel the session since we don't have persistent storage
    const orchestrator = getOrchestrator();
    await orchestrator.cancelSession(sessionId, 'Session deleted by user');

    return NextResponse.json({
      success: true,
      message: 'Wizard session deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete wizard session:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete wizard session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}