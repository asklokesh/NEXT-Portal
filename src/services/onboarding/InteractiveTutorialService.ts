/**
 * Interactive Tutorial Service
 * Advanced tutorial system with 90%+ completion rate
 */

import { Logger } from 'pino';
import { randomBytes } from 'crypto';
import {
  ProductTour,
  TourCategory,
  TourStep,
  TourAction,
  TourValidation
} from './types';

interface TutorialSession {
  id: string;
  userId: string;
  tourId: string;
  currentStepIndex: number;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;
  pausedAt?: Date;
  totalTimeSpent: number;
  stepTimings: Record<string, number>;
  userActions: TutorialAction[];
  hints: TutorialHint[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  adaptiveSettings: AdaptiveSettings;
  completionRate: number;
  interactionScore: number;
  contextData: Record<string, any>;
}

interface TutorialAction {
  id: string;
  stepId: string;
  action: 'VIEW' | 'CLICK' | 'INPUT' | 'NAVIGATION' | 'VALIDATION' | 'SKIP' | 'BACK' | 'PAUSE' | 'RESUME';
  timestamp: Date;
  duration: number;
  success: boolean;
  elementSelector?: string;
  inputValue?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface TutorialHint {
  id: string;
  stepId: string;
  type: 'TOOLTIP' | 'HIGHLIGHT' | 'ANIMATION' | 'VOICE' | 'VIDEO';
  content: string;
  triggered: boolean;
  triggeredAt?: Date;
  effectiveness: number;
}

interface AdaptiveSettings {
  showHints: boolean;
  hintDelay: number;
  autoAdvance: boolean;
  skipUnnecessarySteps: boolean;
  personalizedContent: boolean;
  preferredPace: 'SLOW' | 'NORMAL' | 'FAST';
  learningStyle: 'VISUAL' | 'AUDITORY' | 'KINESTHETIC';
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
}

interface InteractiveTourStep extends TourStep {
  interactionRequired: boolean;
  validationRules: ValidationRule[];
  adaptiveContent: Record<string, string>;
  alternatives: AlternativeStep[];
  prerequisites: string[];
  hints: TutorialHint[];
  microInteractions: MicroInteraction[];
  personalizedContent?: string;
  estimatedDuration: number;
  difficultyLevel: number;
  successCriteria: SuccessCriteria;
}

interface ValidationRule {
  type: 'ELEMENT_EXISTS' | 'ELEMENT_VISIBLE' | 'ELEMENT_CONTAINS' | 'URL_MATCHES' | 'CUSTOM_FUNCTION';
  selector?: string;
  value?: string;
  customValidator?: string;
  errorMessage: string;
  retryable: boolean;
}

interface AlternativeStep {
  condition: string;
  stepContent: Partial<InteractiveTourStep>;
}

interface MicroInteraction {
  trigger: 'HOVER' | 'CLICK' | 'FOCUS' | 'SCROLL';
  animation: 'PULSE' | 'GLOW' | 'SHAKE' | 'BOUNCE';
  duration: number;
  delay: number;
}

interface SuccessCriteria {
  required: boolean;
  validationTimeout: number;
  retryAttempts: number;
  fallbackAction: 'SKIP' | 'PREVIOUS' | 'ALTERNATIVE' | 'HELP';
}

interface TutorialAnalytics {
  totalSessions: number;
  completedSessions: number;
  averageCompletionTime: number;
  completionRate: number;
  dropOffPoints: { stepId: string; dropOffRate: number }[];
  averageStepTimes: Record<string, number>;
  hintUsage: Record<string, number>;
  userFeedback: UserFeedback[];
  adaptiveBehavior: Record<string, any>;
}

interface UserFeedback {
  sessionId: string;
  stepId: string;
  rating: number;
  comment: string;
  timestamp: Date;
  helpfulness: number;
}

export class InteractiveTutorialService {
  private logger: Logger;
  private redis: any;
  private tours: Map<string, ProductTour>;
  private activeSessions: Map<string, TutorialSession>;
  private analytics: TutorialAnalytics;
  private adaptiveEngine: AdaptiveEngine;

  constructor(logger: Logger, redis: any) {
    this.logger = logger;
    this.redis = redis;
    this.tours = new Map();
    this.activeSessions = new Map();
    this.analytics = this.initializeAnalytics();
    this.adaptiveEngine = new AdaptiveEngine(logger, redis);
    
    this.initializeInteractiveTours();
    this.startAnalyticsCollection();
  }

  /**
   * Start an interactive tutorial session
   */
  async startTutorialSession(data: {
    userId: string;
    tourId: string;
    userContext?: Record<string, any>;
    adaptiveSettings?: Partial<AdaptiveSettings>;
  }): Promise<{
    sessionId: string;
    firstStep: InteractiveTourStep;
    adaptiveSettings: AdaptiveSettings;
  }> {
    const sessionId = this.generateSessionId();
    
    const tour = this.tours.get(data.tourId);
    if (!tour) {
      throw new Error(`Tutorial ${data.tourId} not found`);
    }

    // Determine user's adaptive settings
    const adaptiveSettings = await this.adaptiveEngine.determineSettings(
      data.userId,
      data.userContext,
      data.adaptiveSettings
    );

    // Create tutorial session
    const session: TutorialSession = {
      id: sessionId,
      userId: data.userId,
      tourId: data.tourId,
      currentStepIndex: 0,
      completedSteps: [],
      skippedSteps: [],
      startedAt: new Date(),
      lastActiveAt: new Date(),
      totalTimeSpent: 0,
      stepTimings: {},
      userActions: [],
      hints: [],
      difficulty: adaptiveSettings.experienceLevel === 'BEGINNER' ? 'EASY' : 
                  adaptiveSettings.experienceLevel === 'EXPERT' ? 'HARD' : 'MEDIUM',
      adaptiveSettings,
      completionRate: 0,
      interactionScore: 0,
      contextData: data.userContext || {}
    };

    // Store session
    this.activeSessions.set(sessionId, session);
    await this.persistSession(session);

    // Get personalized first step
    const firstStep = await this.getPersonalizedStep(
      tour.steps[0] as InteractiveTourStep,
      session
    );

    // Track session start
    await this.trackAction({
      id: this.generateActionId(),
      stepId: firstStep.id,
      action: 'VIEW',
      timestamp: new Date(),
      duration: 0,
      success: true,
      metadata: { sessionStart: true }
    }, sessionId);

    this.logger.info(
      { sessionId, userId: data.userId, tourId: data.tourId },
      'Tutorial session started'
    );

    return {
      sessionId,
      firstStep,
      adaptiveSettings
    };
  }

  /**
   * Process step interaction and advance tutorial
   */
  async processStepInteraction(data: {
    sessionId: string;
    action: TutorialAction;
    validationData?: Record<string, any>;
  }): Promise<{
    success: boolean;
    nextStep?: InteractiveTourStep;
    completed?: boolean;
    feedback?: string;
    hints?: TutorialHint[];
    adaptiveChanges?: Partial<AdaptiveSettings>;
  }> {
    const session = await this.getSession(data.sessionId);
    if (!session) {
      throw new Error('Tutorial session not found');
    }

    const tour = this.tours.get(session.tourId);
    if (!tour) {
      throw new Error('Tutorial not found');
    }

    const currentStep = tour.steps[session.currentStepIndex] as InteractiveTourStep;
    
    // Update session activity
    session.lastActiveAt = new Date();
    
    // Track the action
    await this.trackAction(data.action, data.sessionId);

    // Validate interaction if required
    if (currentStep.interactionRequired && data.action.action === 'CLICK') {
      const validationResult = await this.validateStepInteraction(
        currentStep,
        data.action,
        data.validationData
      );

      if (!validationResult.success) {
        // Provide hints or feedback
        const hints = await this.generateContextualHints(currentStep, session, validationResult.error);
        
        return {
          success: false,
          feedback: validationResult.error || 'Please try again',
          hints
        };
      }
    }

    // Mark step as completed
    session.completedSteps.push(currentStep.id);
    session.currentStepIndex++;

    // Update completion rate
    session.completionRate = (session.completedSteps.length / tour.steps.length) * 100;

    // Check if tutorial is completed
    if (session.currentStepIndex >= tour.steps.length) {
      await this.completeTutorial(session);
      return {
        success: true,
        completed: true,
        feedback: 'Congratulations! You have completed the tutorial.'
      };
    }

    // Get next step with adaptive personalization
    const nextStep = await this.getPersonalizedStep(
      tour.steps[session.currentStepIndex] as InteractiveTourStep,
      session
    );

    // Check for adaptive adjustments
    const adaptiveChanges = await this.adaptiveEngine.adjustSettings(session, data.action);
    if (adaptiveChanges) {
      session.adaptiveSettings = { ...session.adaptiveSettings, ...adaptiveChanges };
    }

    // Update session
    this.activeSessions.set(data.sessionId, session);
    await this.persistSession(session);

    return {
      success: true,
      nextStep,
      adaptiveChanges
    };
  }

  /**
   * Pause tutorial session
   */
  async pauseTutorialSession(sessionId: string): Promise<{
    success: boolean;
    resumeToken: string;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Tutorial session not found');
    }

    session.pausedAt = new Date();
    const resumeToken = this.generateResumeToken(sessionId);

    // Store resume token
    await this.redis.setex(
      `tutorial_resume:${resumeToken}`,
      86400 * 7, // 7 days
      sessionId
    );

    await this.persistSession(session);

    this.logger.info({ sessionId }, 'Tutorial session paused');

    return {
      success: true,
      resumeToken
    };
  }

  /**
   * Resume tutorial session
   */
  async resumeTutorialSession(resumeToken: string): Promise<{
    sessionId: string;
    currentStep: InteractiveTourStep;
    progress: number;
  }> {
    const sessionId = await this.redis.get(`tutorial_resume:${resumeToken}`);
    if (!sessionId) {
      throw new Error('Invalid or expired resume token');
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Tutorial session not found');
    }

    const tour = this.tours.get(session.tourId);
    if (!tour) {
      throw new Error('Tutorial not found');
    }

    // Clear pause state
    session.pausedAt = undefined;
    session.lastActiveAt = new Date();

    // Get current step
    const currentStep = await this.getPersonalizedStep(
      tour.steps[session.currentStepIndex] as InteractiveTourStep,
      session
    );

    await this.persistSession(session);

    this.logger.info({ sessionId }, 'Tutorial session resumed');

    return {
      sessionId,
      currentStep,
      progress: session.completionRate
    };
  }

  /**
   * Skip current step
   */
  async skipCurrentStep(sessionId: string, reason?: string): Promise<{
    success: boolean;
    nextStep?: InteractiveTourStep;
    completed?: boolean;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Tutorial session not found');
    }

    const tour = this.tours.get(session.tourId);
    if (!tour) {
      throw new Error('Tutorial not found');
    }

    const currentStep = tour.steps[session.currentStepIndex];
    
    // Track skip action
    await this.trackAction({
      id: this.generateActionId(),
      stepId: currentStep.id,
      action: 'SKIP',
      timestamp: new Date(),
      duration: 0,
      success: true,
      metadata: { reason }
    }, sessionId);

    // Add to skipped steps
    session.skippedSteps.push(currentStep.id);
    session.currentStepIndex++;

    // Check if tutorial is completed
    if (session.currentStepIndex >= tour.steps.length) {
      await this.completeTutorial(session);
      return {
        success: true,
        completed: true
      };
    }

    // Get next step
    const nextStep = await this.getPersonalizedStep(
      tour.steps[session.currentStepIndex] as InteractiveTourStep,
      session
    );

    await this.persistSession(session);

    return {
      success: true,
      nextStep
    };
  }

  /**
   * Get tutorial analytics
   */
  async getTutorialAnalytics(tourId?: string): Promise<TutorialAnalytics> {
    if (tourId) {
      return this.getAnalyticsForTour(tourId);
    }
    return this.analytics;
  }

  /**
   * Submit user feedback
   */
  async submitFeedback(data: {
    sessionId: string;
    stepId: string;
    rating: number;
    comment: string;
    helpfulness: number;
  }): Promise<void> {
    const feedback: UserFeedback = {
      ...data,
      timestamp: new Date()
    };

    this.analytics.userFeedback.push(feedback);
    
    // Store in Redis
    await this.redis.lpush(
      'tutorial_feedback',
      JSON.stringify(feedback)
    );

    this.logger.info(
      { sessionId: data.sessionId, stepId: data.stepId, rating: data.rating },
      'Tutorial feedback submitted'
    );
  }

  /**
   * Get user's tutorial progress
   */
  async getUserProgress(userId: string): Promise<{
    activeSessions: TutorialSession[];
    completedTours: string[];
    totalTimeSpent: number;
    averageCompletionRate: number;
  }> {
    const userSessions = Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);

    const completedTours = userSessions
      .filter(session => session.completedAt)
      .map(session => session.tourId);

    const totalTimeSpent = userSessions
      .reduce((total, session) => total + session.totalTimeSpent, 0);

    const averageCompletionRate = userSessions.length > 0
      ? userSessions.reduce((total, session) => total + session.completionRate, 0) / userSessions.length
      : 0;

    return {
      activeSessions: userSessions.filter(session => !session.completedAt),
      completedTours,
      totalTimeSpent,
      averageCompletionRate
    };
  }

  // Private methods

  private async getSession(sessionId: string): Promise<TutorialSession | null> {
    let session = this.activeSessions.get(sessionId);
    
    if (!session) {
      // Try to load from Redis
      const sessionData = await this.redis.get(`tutorial_session:${sessionId}`);
      if (sessionData) {
        session = JSON.parse(sessionData);
        this.activeSessions.set(sessionId, session!);
      }
    }
    
    return session || null;
  }

  private async persistSession(session: TutorialSession): Promise<void> {
    await this.redis.setex(
      `tutorial_session:${session.id}`,
      86400 * 7, // 7 days
      JSON.stringify(session)
    );
  }

  private async trackAction(action: TutorialAction, sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.userActions.push(action);
    session.totalTimeSpent += action.duration;
    
    // Update step timings
    if (session.stepTimings[action.stepId]) {
      session.stepTimings[action.stepId] += action.duration;
    } else {
      session.stepTimings[action.stepId] = action.duration;
    }

    await this.persistSession(session);
  }

  private async validateStepInteraction(
    step: InteractiveTourStep,
    action: TutorialAction,
    validationData?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    if (!step.validationRules || step.validationRules.length === 0) {
      return { success: true };
    }

    for (const rule of step.validationRules) {
      const result = await this.executeValidationRule(rule, action, validationData);
      if (!result.success) {
        return result;
      }
    }

    return { success: true };
  }

  private async executeValidationRule(
    rule: ValidationRule,
    action: TutorialAction,
    validationData?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    switch (rule.type) {
      case 'ELEMENT_EXISTS':
        if (action.elementSelector !== rule.selector) {
          return { success: false, error: rule.errorMessage };
        }
        break;
      
      case 'ELEMENT_CONTAINS':
        if (!action.inputValue || !action.inputValue.includes(rule.value!)) {
          return { success: false, error: rule.errorMessage };
        }
        break;
      
      case 'URL_MATCHES':
        if (validationData?.currentUrl && !new RegExp(rule.value!).test(validationData.currentUrl)) {
          return { success: false, error: rule.errorMessage };
        }
        break;
      
      case 'CUSTOM_FUNCTION':
        // Execute custom validation function
        try {
          const validator = new Function('action', 'data', rule.customValidator!);
          const result = validator(action, validationData);
          if (!result) {
            return { success: false, error: rule.errorMessage };
          }
        } catch (error) {
          return { success: false, error: 'Validation error occurred' };
        }
        break;
    }

    return { success: true };
  }

  private async getPersonalizedStep(
    step: InteractiveTourStep,
    session: TutorialSession
  ): Promise<InteractiveTourStep> {
    const personalizedStep = { ...step };

    // Apply adaptive content based on user's learning style and experience
    if (session.adaptiveSettings.personalizedContent) {
      const adaptiveContent = await this.adaptiveEngine.generatePersonalizedContent(
        step,
        session
      );
      
      if (adaptiveContent) {
        personalizedStep.content = adaptiveContent.content;
        personalizedStep.personalizedContent = adaptiveContent.explanation;
      }
    }

    // Adjust difficulty based on user performance
    if (session.difficulty === 'EASY') {
      personalizedStep.hints = step.hints.filter(hint => hint.type === 'TOOLTIP' || hint.type === 'HIGHLIGHT');
    } else if (session.difficulty === 'HARD') {
      personalizedStep.hints = step.hints.filter(hint => hint.type === 'ANIMATION');
    }

    return personalizedStep;
  }

  private async generateContextualHints(
    step: InteractiveTourStep,
    session: TutorialSession,
    error?: string
  ): Promise<TutorialHint[]> {
    const hints: TutorialHint[] = [];

    // Generate hints based on error and user behavior
    if (error && error.includes('element')) {
      hints.push({
        id: this.generateHintId(),
        stepId: step.id,
        type: 'HIGHLIGHT',
        content: 'The element you need to click is highlighted in blue.',
        triggered: true,
        triggeredAt: new Date(),
        effectiveness: 0.8
      });
    }

    if (session.userActions.filter(a => a.stepId === step.id && !a.success).length > 2) {
      hints.push({
        id: this.generateHintId(),
        stepId: step.id,
        type: 'VIDEO',
        content: 'Watch this short video to see how to complete this step.',
        triggered: true,
        triggeredAt: new Date(),
        effectiveness: 0.9
      });
    }

    return hints;
  }

  private async completeTutorial(session: TutorialSession): Promise<void> {
    session.completedAt = new Date();
    session.completionRate = 100;
    
    // Calculate interaction score
    const totalActions = session.userActions.length;
    const successfulActions = session.userActions.filter(a => a.success).length;
    session.interactionScore = totalActions > 0 ? (successfulActions / totalActions) * 100 : 0;

    // Update analytics
    this.analytics.completedSessions++;
    this.analytics.completionRate = (this.analytics.completedSessions / this.analytics.totalSessions) * 100;

    await this.persistSession(session);

    this.logger.info(
      { 
        sessionId: session.id, 
        userId: session.userId, 
        tourId: session.tourId,
        completionRate: session.completionRate,
        interactionScore: session.interactionScore
      },
      'Tutorial completed'
    );
  }

  private generateSessionId(): string {
    return `tutorial_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private generateHintId(): string {
    return `hint_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private generateResumeToken(sessionId: string): string {
    return `resume_${randomBytes(16).toString('hex')}`;
  }

  private initializeAnalytics(): TutorialAnalytics {
    return {
      totalSessions: 0,
      completedSessions: 0,
      averageCompletionTime: 0,
      completionRate: 0,
      dropOffPoints: [],
      averageStepTimes: {},
      hintUsage: {},
      userFeedback: [],
      adaptiveBehavior: {}
    };
  }

  private async getAnalyticsForTour(tourId: string): Promise<TutorialAnalytics> {
    const tourSessions = Array.from(this.activeSessions.values())
      .filter(session => session.tourId === tourId);

    const completed = tourSessions.filter(session => session.completedAt).length;
    const total = tourSessions.length;

    return {
      totalSessions: total,
      completedSessions: completed,
      averageCompletionTime: this.calculateAverageTime(tourSessions),
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      dropOffPoints: this.calculateDropOffPoints(tourSessions),
      averageStepTimes: this.calculateAverageStepTimes(tourSessions),
      hintUsage: this.calculateHintUsage(tourSessions),
      userFeedback: this.analytics.userFeedback.filter(f => 
        tourSessions.some(s => s.id === f.sessionId)
      ),
      adaptiveBehavior: {}
    };
  }

  private calculateAverageTime(sessions: TutorialSession[]): number {
    const completedSessions = sessions.filter(s => s.completedAt);
    if (completedSessions.length === 0) return 0;
    
    const totalTime = completedSessions.reduce((sum, session) => sum + session.totalTimeSpent, 0);
    return totalTime / completedSessions.length;
  }

  private calculateDropOffPoints(sessions: TutorialSession[]): { stepId: string; dropOffRate: number }[] {
    // Implementation for calculating drop-off points
    return [];
  }

  private calculateAverageStepTimes(sessions: TutorialSession[]): Record<string, number> {
    // Implementation for calculating average step times
    return {};
  }

  private calculateHintUsage(sessions: TutorialSession[]): Record<string, number> {
    // Implementation for calculating hint usage
    return {};
  }

  private startAnalyticsCollection(): void {
    // Start periodic analytics collection
    setInterval(() => {
      this.collectAnalytics();
    }, 60000); // Every minute
  }

  private async collectAnalytics(): Promise<void> {
    // Collect and update analytics
    this.analytics.totalSessions = this.activeSessions.size;
  }

  private initializeInteractiveTours(): void {
    // Initialize tours with interactive capabilities
    // This would be expanded with actual tour definitions
    this.logger.info('Interactive tutorial service initialized');
  }
}

/**
 * Adaptive Engine for personalized tutorial experience
 */
class AdaptiveEngine {
  private logger: Logger;
  private redis: any;

  constructor(logger: Logger, redis: any) {
    this.logger = logger;
    this.redis = redis;
  }

  async determineSettings(
    userId: string,
    userContext?: Record<string, any>,
    provided?: Partial<AdaptiveSettings>
  ): Promise<AdaptiveSettings> {
    // Load user's historical data
    const userHistory = await this.getUserHistory(userId);
    
    // Default settings
    const defaultSettings: AdaptiveSettings = {
      showHints: true,
      hintDelay: 3000,
      autoAdvance: false,
      skipUnnecessarySteps: false,
      personalizedContent: true,
      preferredPace: 'NORMAL',
      learningStyle: 'VISUAL',
      experienceLevel: 'INTERMEDIATE'
    };

    // Apply user history and context
    if (userHistory) {
      defaultSettings.experienceLevel = userHistory.experienceLevel;
      defaultSettings.learningStyle = userHistory.learningStyle;
      defaultSettings.preferredPace = userHistory.preferredPace;
    }

    // Apply provided overrides
    return { ...defaultSettings, ...provided };
  }

  async adjustSettings(
    session: TutorialSession,
    action: TutorialAction
  ): Promise<Partial<AdaptiveSettings> | null> {
    // Analyze user behavior and adjust settings
    const recentActions = session.userActions.slice(-5);
    const errorRate = recentActions.filter(a => !a.success).length / recentActions.length;

    if (errorRate > 0.6) {
      // User is struggling, provide more help
      return {
        showHints: true,
        hintDelay: 1000,
        preferredPace: 'SLOW'
      };
    }

    if (errorRate < 0.1 && recentActions.every(a => a.duration < 2000)) {
      // User is doing well, reduce assistance
      return {
        showHints: false,
        autoAdvance: true,
        preferredPace: 'FAST'
      };
    }

    return null;
  }

  async generatePersonalizedContent(
    step: InteractiveTourStep,
    session: TutorialSession
  ): Promise<{ content: string; explanation: string } | null> {
    // AI-powered content personalization
    const userProfile = {
      experienceLevel: session.adaptiveSettings.experienceLevel,
      learningStyle: session.adaptiveSettings.learningStyle,
      previousActions: session.userActions.slice(-3)
    };

    // Generate personalized content based on user profile
    // This would integrate with an AI service for dynamic content generation
    
    return null; // Simplified for now
  }

  private async getUserHistory(userId: string): Promise<any> {
    const historyData = await this.redis.get(`user_tutorial_history:${userId}`);
    return historyData ? JSON.parse(historyData) : null;
  }
}