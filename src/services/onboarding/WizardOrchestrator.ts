/**
 * Wizard Orchestrator
 * Manages multi-step guided setup wizards for enterprise portal onboarding
 */

import { EventEmitter } from 'events';

// Core Wizard Types
export interface WizardDefinition {
  id: string;
  name: string;
  description: string;
  category: WizardCategory;
  version: string;
  estimatedDuration: number; // in minutes
  prerequisites: WizardPrerequisite[];
  steps: WizardStep[];
  metadata: WizardMetadata;
}

export enum WizardCategory {
  AUTHENTICATION = 'authentication',
  CICD = 'cicd',
  PLUGINS = 'plugins',
  PERMISSIONS = 'permissions',
  INTEGRATIONS = 'integrations',
  CUSTOMIZATION = 'customization'
}

export interface WizardStep {
  id: string;
  name: string;
  description: string;
  type: StepType;
  component: string;
  required: boolean;
  dependencies: string[];
  validation: StepValidation;
  data: StepData;
  ui: StepUIConfig;
}

export enum StepType {
  FORM = 'form',
  SELECTION = 'selection',
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  REVIEW = 'review',
  DEPLOYMENT = 'deployment'
}

export interface StepValidation {
  rules: ValidationRule[];
  async: boolean;
  skipValidation?: boolean;
}

export interface ValidationRule {
  type: ValidationType;
  field?: string;
  value?: any;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export enum ValidationType {
  REQUIRED = 'required',
  FORMAT = 'format',
  CONNECTION = 'connection',
  PERMISSION = 'permission',
  COMPATIBILITY = 'compatibility',
  CUSTOM = 'custom'
}

export interface StepData {
  fields: WizardField[];
  defaultValues: Record<string, any>;
  templates: StepTemplate[];
}

export interface WizardField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation: FieldValidation;
  conditional?: ConditionalLogic;
}

export enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PASSWORD = 'password',
  URL = 'url',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  FILE = 'file',
  JSON = 'json',
  CODE = 'code'
}

export interface FieldOption {
  value: any;
  label: string;
  description?: string;
  icon?: string;
  recommended?: boolean;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: string;
  async?: boolean;
}

export interface ConditionalLogic {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'exists';
  value: any;
  action: 'show' | 'hide' | 'require' | 'disable';
}

export interface StepTemplate {
  id: string;
  name: string;
  description: string;
  values: Record<string, any>;
  recommended?: boolean;
  category?: string;
}

export interface StepUIConfig {
  layout: 'single' | 'two-column' | 'tabs' | 'accordion';
  showProgress: boolean;
  allowSkip: boolean;
  nextButtonText?: string;
  helpUrl?: string;
  estimatedTime?: number;
}

export interface WizardPrerequisite {
  type: 'service' | 'permission' | 'configuration' | 'resource';
  name: string;
  description: string;
  checkFunction: string;
  required: boolean;
}

export interface WizardMetadata {
  author: string;
  created: Date;
  updated: Date;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  popularity: number;
}

// Wizard Session Types
export interface WizardSession {
  id: string;
  wizardId: string;
  userId: string;
  organizationId?: string;
  status: SessionStatus;
  currentStep: number;
  data: Record<string, any>;
  progress: WizardProgress;
  history: SessionHistory[];
  metadata: SessionMetadata;
}

export enum SessionStatus {
  STARTED = 'started',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface WizardProgress {
  completedSteps: string[];
  currentStepProgress: number;
  totalProgress: number;
  timeSpent: number;
  estimatedTimeRemaining: number;
}

export interface SessionHistory {
  step: string;
  action: 'started' | 'completed' | 'skipped' | 'failed';
  timestamp: Date;
  data?: any;
  error?: string;
}

export interface SessionMetadata {
  startedAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;
  userAgent: string;
  ipAddress: string;
  source: 'direct' | 'invitation' | 'automation';
}

export class WizardOrchestrator extends EventEmitter {
  private wizards = new Map<string, WizardDefinition>();
  private sessions = new Map<string, WizardSession>();
  private validators = new Map<string, Function>();

  constructor() {
    super();
    this.initializeOrchestrator();
  }

  private async initializeOrchestrator() {
    console.log('Initializing Wizard Orchestrator...');
    
    // Load built-in wizards
    await this.loadBuiltInWizards();
    
    // Initialize validators
    this.initializeValidators();
    
    this.emit('orchestrator_initialized');
  }

  /**
   * Wizard Definition Management
   */
  async registerWizard(wizard: Omit<WizardDefinition, 'id'>): Promise<WizardDefinition> {
    const newWizard: WizardDefinition = {
      id: `wizard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...wizard
    };

    this.wizards.set(newWizard.id, newWizard);
    this.emit('wizard_registered', newWizard);

    return newWizard;
  }

  getWizard(id: string): WizardDefinition | null {
    return this.wizards.get(id) || null;
  }

  getAllWizards(): WizardDefinition[] {
    return Array.from(this.wizards.values());
  }

  getWizardsByCategory(category: WizardCategory): WizardDefinition[] {
    return Array.from(this.wizards.values()).filter(w => w.category === category);
  }

  /**
   * Wizard Session Management
   */
  async startWizard(
    wizardId: string, 
    userId: string, 
    organizationId?: string
  ): Promise<WizardSession> {
    
    const wizard = this.wizards.get(wizardId);
    if (!wizard) {
      throw new Error(`Wizard not found: ${wizardId}`);
    }

    // Check prerequisites
    await this.checkPrerequisites(wizard, userId, organizationId);

    const session: WizardSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      wizardId,
      userId,
      organizationId,
      status: SessionStatus.STARTED,
      currentStep: 0,
      data: {},
      progress: {
        completedSteps: [],
        currentStepProgress: 0,
        totalProgress: 0,
        timeSpent: 0,
        estimatedTimeRemaining: wizard.estimatedDuration * 60 // convert to seconds
      },
      history: [{
        step: 'wizard_start',
        action: 'started',
        timestamp: new Date()
      }],
      metadata: {
        startedAt: new Date(),
        lastActiveAt: new Date(),
        userAgent: 'unknown',
        ipAddress: 'unknown',
        source: 'direct'
      }
    };

    this.sessions.set(session.id, session);
    this.emit('wizard_started', session);

    return session;
  }

  async getWizardSession(sessionId: string): Promise<WizardSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSession(sessionId: string, updates: Partial<WizardSession>): Promise<WizardSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession = {
      ...session,
      ...updates,
      metadata: {
        ...session.metadata,
        lastActiveAt: new Date()
      }
    };

    this.sessions.set(sessionId, updatedSession);
    this.emit('session_updated', updatedSession);

    return updatedSession;
  }

  /**
   * Step Navigation
   */
  async nextStep(sessionId: string, stepData?: Record<string, any>): Promise<WizardSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const wizard = this.wizards.get(session.wizardId);
    if (!wizard) {
      throw new Error(`Wizard not found: ${session.wizardId}`);
    }

    const currentStep = wizard.steps[session.currentStep];
    
    // Validate current step if data provided
    if (stepData && !currentStep.validation.skipValidation) {
      await this.validateStep(currentStep, stepData, session.data);
    }

    // Update session data
    if (stepData) {
      session.data = { ...session.data, ...stepData };
    }

    // Mark current step as completed
    session.progress.completedSteps.push(currentStep.id);
    
    // Move to next step
    if (session.currentStep < wizard.steps.length - 1) {
      session.currentStep++;
      session.status = SessionStatus.IN_PROGRESS;
    } else {
      session.status = SessionStatus.COMPLETED;
      session.metadata.completedAt = new Date();
    }

    // Update progress
    session.progress.totalProgress = (session.progress.completedSteps.length / wizard.steps.length) * 100;
    session.progress.currentStepProgress = 0;

    // Add to history
    session.history.push({
      step: currentStep.id,
      action: 'completed',
      timestamp: new Date(),
      data: stepData
    });

    this.sessions.set(sessionId, session);
    this.emit('step_completed', session, currentStep);

    if (session.status === SessionStatus.COMPLETED) {
      await this.finalizeWizard(session);
    }

    return session;
  }

  async previousStep(sessionId: string): Promise<WizardSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.currentStep > 0) {
      session.currentStep--;
      session.progress.currentStepProgress = 100; // Previous step was completed
      session.progress.totalProgress = (session.progress.completedSteps.length / this.wizards.get(session.wizardId)!.steps.length) * 100;

      this.sessions.set(sessionId, session);
      this.emit('step_previous', session);
    }

    return session;
  }

  async skipStep(sessionId: string, reason?: string): Promise<WizardSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const wizard = this.wizards.get(session.wizardId);
    if (!wizard) {
      throw new Error(`Wizard not found: ${session.wizardId}`);
    }

    const currentStep = wizard.steps[session.currentStep];
    
    if (currentStep.required) {
      throw new Error('Cannot skip required step');
    }

    // Add to history
    session.history.push({
      step: currentStep.id,
      action: 'skipped',
      timestamp: new Date(),
      data: { reason }
    });

    // Move to next step
    return await this.nextStep(sessionId);
  }

  /**
   * Validation System
   */
  private async validateStep(
    step: WizardStep, 
    data: Record<string, any>, 
    sessionData: Record<string, any>
  ): Promise<void> {
    
    const errors: string[] = [];

    // Field validation
    for (const field of step.data.fields) {
      const value = data[field.id];
      
      // Required validation
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.label} is required`);
        continue;
      }

      // Field-specific validation
      if (value !== undefined && value !== null && value !== '') {
        const fieldErrors = await this.validateField(field, value, sessionData);
        errors.push(...fieldErrors);
      }
    }

    // Step-level validation
    for (const rule of step.validation.rules) {
      const validator = this.validators.get(rule.type);
      if (validator) {
        try {
          const isValid = await validator(data, sessionData, rule);
          if (!isValid) {
            errors.push(rule.message);
          }
        } catch (error) {
          errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  private async validateField(
    field: WizardField, 
    value: any, 
    sessionData: Record<string, any>
  ): Promise<string[]> {
    
    const errors: string[] = [];

    // Length validation
    if (field.validation.minLength && value.length < field.validation.minLength) {
      errors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
    }

    if (field.validation.maxLength && value.length > field.validation.maxLength) {
      errors.push(`${field.label} must be no more than ${field.validation.maxLength} characters`);
    }

    // Pattern validation
    if (field.validation.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        errors.push(`${field.label} format is invalid`);
      }
    }

    // Type-specific validation
    switch (field.type) {
      case FieldType.EMAIL:
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field.label} must be a valid email address`);
        }
        break;

      case FieldType.URL:
        try {
          new URL(value);
        } catch {
          errors.push(`${field.label} must be a valid URL`);
        }
        break;

      case FieldType.JSON:
        try {
          JSON.parse(value);
        } catch {
          errors.push(`${field.label} must be valid JSON`);
        }
        break;
    }

    return errors;
  }

  /**
   * Wizard Execution
   */
  private async finalizeWizard(session: WizardSession): Promise<void> {
    console.log(`Finalizing wizard session: ${session.id}`);

    const wizard = this.wizards.get(session.wizardId);
    if (!wizard) return;

    try {
      // Execute wizard-specific finalization logic
      await this.executeWizardActions(wizard, session);

      this.emit('wizard_completed', session);
      console.log(`Wizard ${wizard.name} completed successfully for user ${session.userId}`);

    } catch (error) {
      session.status = SessionStatus.FAILED;
      session.history.push({
        step: 'wizard_finalize',
        action: 'failed',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.emit('wizard_failed', session, error);
      console.error(`Wizard ${wizard.name} failed for user ${session.userId}:`, error);
    }
  }

  private async executeWizardActions(wizard: WizardDefinition, session: WizardSession): Promise<void> {
    // This would contain wizard-specific implementation logic
    // For now, just simulate the execution
    console.log(`Executing actions for ${wizard.name} with data:`, session.data);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async checkPrerequisites(
    wizard: WizardDefinition, 
    userId: string, 
    organizationId?: string
  ): Promise<void> {
    
    for (const prerequisite of wizard.prerequisites) {
      const checker = this.validators.get(prerequisite.checkFunction);
      if (checker) {
        const isValid = await checker(userId, organizationId);
        if (!isValid && prerequisite.required) {
          throw new Error(`Prerequisite not met: ${prerequisite.description}`);
        }
      }
    }
  }

  /**
   * Built-in Wizards and Validators
   */
  private async loadBuiltInWizards(): Promise<void> {
    // Load authentication setup wizard
    await this.registerWizard({
      name: 'Authentication Setup',
      description: 'Configure authentication providers for your portal',
      category: WizardCategory.AUTHENTICATION,
      version: '1.0.0',
      estimatedDuration: 15,
      prerequisites: [],
      steps: [], // Will be defined separately
      metadata: {
        author: 'system',
        created: new Date(),
        updated: new Date(),
        tags: ['auth', 'security'],
        difficulty: 'intermediate',
        popularity: 95
      }
    });

    console.log('Built-in wizards loaded successfully');
  }

  private initializeValidators(): void {
    // Connection validation
    this.validators.set(ValidationType.CONNECTION, async (data: any) => {
      // Mock connection test
      return true;
    });

    // Permission validation
    this.validators.set(ValidationType.PERMISSION, async (userId: string, orgId?: string) => {
      // Mock permission check
      return true;
    });

    // Format validation
    this.validators.set(ValidationType.FORMAT, async (data: any, sessionData: any, rule: ValidationRule) => {
      // Mock format validation
      return true;
    });

    console.log('Validators initialized');
  }

  // Utility methods
  async pauseSession(sessionId: string): Promise<WizardSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = SessionStatus.PAUSED;
    this.sessions.set(sessionId, session);
    this.emit('session_paused', session);

    return session;
  }

  async resumeSession(sessionId: string): Promise<WizardSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = SessionStatus.IN_PROGRESS;
    session.metadata.lastActiveAt = new Date();
    this.sessions.set(sessionId, session);
    this.emit('session_resumed', session);

    return session;
  }

  async cancelSession(sessionId: string, reason?: string): Promise<WizardSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = SessionStatus.CANCELLED;
    session.history.push({
      step: 'wizard_cancel',
      action: 'failed',
      timestamp: new Date(),
      data: { reason }
    });

    this.sessions.set(sessionId, session);
    this.emit('session_cancelled', session);

    return session;
  }

  // Analytics and reporting
  getWizardAnalytics(wizardId: string): any {
    const sessions = Array.from(this.sessions.values()).filter(s => s.wizardId === wizardId);
    
    return {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === SessionStatus.COMPLETED).length,
      averageCompletionTime: this.calculateAverageCompletionTime(sessions),
      dropOffPoints: this.analyzeDropOffPoints(sessions),
      successRate: sessions.length > 0 ? (sessions.filter(s => s.status === SessionStatus.COMPLETED).length / sessions.length) * 100 : 0
    };
  }

  private calculateAverageCompletionTime(sessions: WizardSession[]): number {
    const completedSessions = sessions.filter(s => s.status === SessionStatus.COMPLETED && s.metadata.completedAt);
    if (completedSessions.length === 0) return 0;

    const totalTime = completedSessions.reduce((sum, session) => {
      const duration = session.metadata.completedAt!.getTime() - session.metadata.startedAt.getTime();
      return sum + duration;
    }, 0);

    return totalTime / completedSessions.length / 1000 / 60; // Convert to minutes
  }

  private analyzeDropOffPoints(sessions: WizardSession[]): Record<string, number> {
    const dropOffs: Record<string, number> = {};
    
    sessions.forEach(session => {
      if (session.status === SessionStatus.CANCELLED || session.status === SessionStatus.FAILED) {
        const lastStep = session.history[session.history.length - 1]?.step || 'start';
        dropOffs[lastStep] = (dropOffs[lastStep] || 0) + 1;
      }
    });

    return dropOffs;
  }
}

export default WizardOrchestrator;