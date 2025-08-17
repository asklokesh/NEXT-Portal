/**
 * Enhanced Registration Service
 * Social login integration and progressive registration with minimal friction
 */

import { Logger } from 'pino';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  OnboardingSession,
  OnboardingStatus,
  AccountType,
  CustomerProfile,
  Organization
} from './types';

interface SocialProvider {
  id: string;
  name: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  scope: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  fieldMapping: SocialFieldMapping;
}

interface SocialFieldMapping {
  email: string;
  firstName: string;
  lastName: string;
  avatar: string;
  company?: string;
  jobTitle?: string;
}

interface SocialUserData {
  providerId: string;
  provider: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  company?: string;
  jobTitle?: string;
  verified: boolean;
  raw: Record<string, any>;
}

interface RegistrationRequest {
  method: 'EMAIL' | 'SOCIAL' | 'INVITE' | 'SSO';
  data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    password?: string;
    socialToken?: string;
    socialProvider?: string;
    inviteToken?: string;
    ssoToken?: string;
  };
  source?: string;
  referrer?: string;
  metadata?: Record<string, any>;
}

interface RegistrationResult {
  success: boolean;
  sessionId?: string;
  userId?: string;
  requiresVerification: boolean;
  verificationMethod: 'EMAIL' | 'SMS' | 'NONE';
  nextStep: 'VERIFICATION' | 'PROFILE_COMPLETION' | 'ONBOARDING';
  socialConnected?: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface ProgressiveRegistrationStep {
  id: string;
  name: string;
  required: boolean;
  fields: RegistrationField[];
  condition?: string;
  skipable: boolean;
  order: number;
}

interface RegistrationField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'checkbox' | 'file';
  label: string;
  placeholder: string;
  required: boolean;
  validation: FieldValidation[];
  options?: string[];
  autocomplete?: string;
  prefill?: string;
}

interface FieldValidation {
  type: 'required' | 'email' | 'phone' | 'minLength' | 'maxLength' | 'regex' | 'custom';
  value?: any;
  message: string;
}

interface InviteData {
  token: string;
  email: string;
  invitedBy: string;
  organizationId: string;
  role: string;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

interface RegistrationAnalytics {
  totalRegistrations: number;
  completedRegistrations: number;
  socialRegistrations: Record<string, number>;
  emailRegistrations: number;
  inviteRegistrations: number;
  conversionRates: {
    overall: number;
    byMethod: Record<string, number>;
    bySource: Record<string, number>;
  };
  averageCompletionTime: number;
  dropOffPoints: { step: string; dropOffRate: number }[];
  fraudDetection: {
    blockedRegistrations: number;
    suspiciousActivity: number;
  };
}

export class EnhancedRegistrationService {
  private logger: Logger;
  private prisma: PrismaClient;
  private redis: any;
  private socialProviders: Map<string, SocialProvider>;
  private registrationSteps: ProgressiveRegistrationStep[];
  private fraudDetector: FraudDetector;
  private analytics: RegistrationAnalytics;

  constructor(logger: Logger, prisma: PrismaClient, redis: any) {
    this.logger = logger;
    this.prisma = prisma;
    this.redis = redis;
    this.socialProviders = new Map();
    this.fraudDetector = new FraudDetector(logger, redis);
    this.analytics = this.initializeAnalytics();
    
    this.initializeSocialProviders();
    this.initializeProgressiveSteps();
    this.startAnalyticsCollection();
  }

  /**
   * Start registration process
   */
  async startRegistration(request: RegistrationRequest): Promise<RegistrationResult> {
    const startTime = Date.now();
    
    try {
      // Fraud detection
      const fraudCheck = await this.fraudDetector.checkRegistration(request);
      if (fraudCheck.blocked) {
        this.analytics.fraudDetection.blockedRegistrations++;
        throw new Error('Registration blocked due to security concerns');
      }

      if (fraudCheck.suspicious) {
        this.analytics.fraudDetection.suspiciousActivity++;
        // Continue but with enhanced monitoring
      }

      // Route to appropriate registration method
      switch (request.method) {
        case 'EMAIL':
          return await this.handleEmailRegistration(request);
        case 'SOCIAL':
          return await this.handleSocialRegistration(request);
        case 'INVITE':
          return await this.handleInviteRegistration(request);
        case 'SSO':
          return await this.handleSSORegistration(request);
        default:
          throw new Error('Invalid registration method');
      }
    } catch (error: any) {
      this.logger.error(
        { error: error.message, method: request.method },
        'Registration failed'
      );
      
      return {
        success: false,
        requiresVerification: false,
        verificationMethod: 'NONE',
        nextStep: 'VERIFICATION',
        error: error.message
      };
    } finally {
      // Track registration attempt
      await this.trackRegistrationAttempt(request, Date.now() - startTime);
    }
  }

  /**
   * Handle email registration
   */
  private async handleEmailRegistration(request: RegistrationRequest): Promise<RegistrationResult> {
    const { email, firstName, lastName, company, password } = request.data;
    
    if (!email || !firstName || !lastName) {
      throw new Error('Missing required fields for email registration');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('Account already exists with this email address');
    }

    // Create user account
    const user = await this.createUserAccount({
      email,
      firstName,
      lastName,
      company,
      provider: 'email',
      providerId: email,
      verified: false,
      password
    });

    // Create onboarding session
    const session = await this.createOnboardingSession({
      userId: user.id,
      accountType: AccountType.TRIAL,
      source: request.source || 'organic',
      metadata: request.metadata
    });

    // Send verification email
    const verificationToken = await this.generateVerificationToken(user.id, email);
    
    this.analytics.emailRegistrations++;
    
    return {
      success: true,
      sessionId: session.id,
      userId: user.id,
      requiresVerification: true,
      verificationMethod: 'EMAIL',
      nextStep: 'VERIFICATION',
      metadata: {
        verificationToken,
        progressive: true
      }
    };
  }

  /**
   * Handle social login registration
   */
  private async handleSocialRegistration(request: RegistrationRequest): Promise<RegistrationResult> {
    const { socialToken, socialProvider } = request.data;
    
    if (!socialToken || !socialProvider) {
      throw new Error('Missing social authentication data');
    }

    const provider = this.socialProviders.get(socialProvider);
    if (!provider || !provider.enabled) {
      throw new Error(`Social provider ${socialProvider} not available`);
    }

    // Verify social token and get user data
    const socialUserData = await this.verifySocialToken(provider, socialToken);
    
    // Check if user already exists
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: socialUserData.email },
          { 
            provider: socialProvider,
            providerId: socialUserData.providerId
          }
        ]
      }
    });

    if (user) {
      // User exists, update social connection if needed
      if (user.provider !== socialProvider) {
        await this.linkSocialAccount(user.id, socialUserData);
      }
    } else {
      // Create new user from social data
      user = await this.createUserAccount({
        email: socialUserData.email,
        firstName: socialUserData.firstName,
        lastName: socialUserData.lastName,
        company: socialUserData.company,
        avatar: socialUserData.avatar,
        provider: socialProvider,
        providerId: socialUserData.providerId,
        verified: socialUserData.verified
      });
    }

    // Create onboarding session
    const session = await this.createOnboardingSession({
      userId: user.id,
      accountType: AccountType.TRIAL,
      source: request.source || 'social',
      metadata: {
        ...request.metadata,
        socialProvider,
        socialVerified: socialUserData.verified
      }
    });

    // Update analytics
    if (!this.analytics.socialRegistrations[socialProvider]) {
      this.analytics.socialRegistrations[socialProvider] = 0;
    }
    this.analytics.socialRegistrations[socialProvider]++;
    
    return {
      success: true,
      sessionId: session.id,
      userId: user.id,
      requiresVerification: !socialUserData.verified,
      verificationMethod: socialUserData.verified ? 'NONE' : 'EMAIL',
      nextStep: socialUserData.verified ? 'PROFILE_COMPLETION' : 'VERIFICATION',
      socialConnected: true,
      metadata: {
        provider: socialProvider,
        progressive: this.needsProfileCompletion(socialUserData)
      }
    };
  }

  /**
   * Handle invite-based registration
   */
  private async handleInviteRegistration(request: RegistrationRequest): Promise<RegistrationResult> {
    const { inviteToken, firstName, lastName, password } = request.data;
    
    if (!inviteToken) {
      throw new Error('Invalid invite token');
    }

    // Validate invite
    const invite = await this.validateInvite(inviteToken);
    if (!invite) {
      throw new Error('Invalid or expired invite');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email }
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create user account
    const user = await this.createUserAccount({
      email: invite.email,
      firstName: firstName || '',
      lastName: lastName || '',
      provider: 'invite',
      providerId: invite.email,
      verified: true, // Invites are pre-verified
      password,
      organizationId: invite.organizationId,
      role: invite.role
    });

    // Create onboarding session
    const session = await this.createOnboardingSession({
      userId: user.id,
      organizationId: invite.organizationId,
      accountType: AccountType.PROFESSIONAL, // Invites typically go to paid accounts
      source: 'invite',
      metadata: {
        ...request.metadata,
        invitedBy: invite.invitedBy,
        inviteRole: invite.role
      }
    });

    // Mark invite as used
    await this.redis.del(`invite:${inviteToken}`);
    
    this.analytics.inviteRegistrations++;
    
    return {
      success: true,
      sessionId: session.id,
      userId: user.id,
      requiresVerification: false,
      verificationMethod: 'NONE',
      nextStep: 'ONBOARDING',
      metadata: {
        inviteAccepted: true,
        organizationId: invite.organizationId
      }
    };
  }

  /**
   * Handle SSO registration
   */
  private async handleSSORegistration(request: RegistrationRequest): Promise<RegistrationResult> {
    const { ssoToken } = request.data;
    
    if (!ssoToken) {
      throw new Error('Missing SSO token');
    }

    // Validate SSO token and extract user data
    const ssoUserData = await this.validateSSOToken(ssoToken);
    
    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: ssoUserData.email }
    });

    if (!user) {
      // Create new user from SSO data
      user = await this.createUserAccount({
        email: ssoUserData.email,
        firstName: ssoUserData.firstName,
        lastName: ssoUserData.lastName,
        company: ssoUserData.company,
        provider: 'sso',
        providerId: ssoUserData.id,
        verified: true, // SSO users are pre-verified
        organizationId: ssoUserData.organizationId
      });
    }

    // Create onboarding session
    const session = await this.createOnboardingSession({
      userId: user.id,
      organizationId: ssoUserData.organizationId,
      accountType: AccountType.ENTERPRISE,
      source: 'sso',
      metadata: request.metadata
    });
    
    return {
      success: true,
      sessionId: session.id,
      userId: user.id,
      requiresVerification: false,
      verificationMethod: 'NONE',
      nextStep: 'ONBOARDING',
      metadata: {
        ssoVerified: true,
        organizationId: ssoUserData.organizationId
      }
    };
  }

  /**
   * Get progressive registration steps
   */
  async getProgressiveSteps(sessionId: string): Promise<{
    steps: ProgressiveRegistrationStep[];
    currentStep: number;
    progress: number;
  }> {
    const session = await this.getOnboardingSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Filter steps based on user data and conditions
    const applicableSteps = this.registrationSteps.filter(step => 
      this.evaluateStepCondition(step, session)
    );

    const currentStep = applicableSteps.findIndex(step => 
      !session.completedSteps?.includes(step.id)
    );

    const progress = currentStep === -1 ? 100 : 
      ((currentStep) / applicableSteps.length) * 100;

    return {
      steps: applicableSteps,
      currentStep: Math.max(0, currentStep),
      progress
    };
  }

  /**
   * Complete progressive registration step
   */
  async completeProgressiveStep(data: {
    sessionId: string;
    stepId: string;
    fieldData: Record<string, any>;
  }): Promise<{
    success: boolean;
    nextStep?: ProgressiveRegistrationStep;
    completed?: boolean;
    validationErrors?: Record<string, string>;
  }> {
    const session = await this.getOnboardingSession(data.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const step = this.registrationSteps.find(s => s.id === data.stepId);
    if (!step) {
      throw new Error('Step not found');
    }

    // Validate field data
    const validationErrors = await this.validateStepData(step, data.fieldData);
    if (Object.keys(validationErrors).length > 0) {
      return {
        success: false,
        validationErrors
      };
    }

    // Update user data
    await this.updateUserData(session.customerId, data.fieldData);

    // Mark step as completed
    const completedSteps = session.completedSteps || [];
    completedSteps.push(data.stepId);
    
    await this.updateOnboardingSession(data.sessionId, {
      completedSteps,
      variables: { ...session.variables, ...data.fieldData }
    });

    // Get next step
    const { steps, currentStep } = await this.getProgressiveSteps(data.sessionId);
    const nextStep = steps[currentStep + 1];
    const completed = !nextStep;

    return {
      success: true,
      nextStep,
      completed
    };
  }

  /**
   * Get registration analytics
   */
  async getRegistrationAnalytics(): Promise<RegistrationAnalytics> {
    return this.analytics;
  }

  /**
   * Generate invite link
   */
  async generateInviteLink(data: {
    email: string;
    organizationId: string;
    invitedBy: string;
    role: string;
    expiresIn?: number; // hours
    metadata?: Record<string, any>;
  }): Promise<{
    inviteToken: string;
    inviteUrl: string;
    expiresAt: Date;
  }> {
    const inviteToken = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (data.expiresIn || 72)); // Default 72 hours

    const invite: InviteData = {
      token: inviteToken,
      email: data.email,
      invitedBy: data.invitedBy,
      organizationId: data.organizationId,
      role: data.role,
      expiresAt,
      metadata: data.metadata
    };

    // Store invite
    await this.redis.setex(
      `invite:${inviteToken}`,
      data.expiresIn ? data.expiresIn * 3600 : 259200, // 72 hours in seconds
      JSON.stringify(invite)
    );

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register?invite=${inviteToken}`;

    this.logger.info(
      { email: data.email, organizationId: data.organizationId },
      'Invite generated'
    );

    return {
      inviteToken,
      inviteUrl,
      expiresAt
    };
  }

  // Private methods

  private async createUserAccount(data: {
    email: string;
    firstName: string;
    lastName: string;
    company?: string;
    avatar?: string;
    provider: string;
    providerId: string;
    verified: boolean;
    password?: string;
    organizationId?: string;
    role?: string;
  }): Promise<any> {
    const hashedPassword = data.password ? 
      await this.hashPassword(data.password) : null;

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        provider: data.provider,
        providerId: data.providerId,
        password: hashedPassword,
        role: data.role || 'DEVELOPER',
        isActive: true,
        avatar: data.avatar
      }
    });

    // Create or join organization
    if (data.organizationId) {
      // Join existing organization
      await this.addUserToOrganization(user.id, data.organizationId, data.role || 'MEMBER');
    } else if (data.company) {
      // Create new organization
      await this.createOrganization({
        name: data.company,
        ownerId: user.id,
        domain: data.email.split('@')[1]
      });
    }

    return user;
  }

  private async createOnboardingSession(data: {
    userId: string;
    organizationId?: string;
    accountType: AccountType;
    source: string;
    metadata?: Record<string, any>;
  }): Promise<OnboardingSession> {
    const sessionId = this.generateSessionId();
    
    const session: OnboardingSession = {
      id: sessionId,
      customerId: data.userId,
      organizationId: data.organizationId || '',
      accountType: data.accountType,
      status: OnboardingStatus.EMAIL_VERIFICATION_PENDING,
      currentStep: 0,
      steps: [],
      startedAt: new Date(),
      timeSpentMinutes: 0,
      completionPercentage: 0,
      metadata: {
        source: data.source,
        deviceType: 'web',
        browser: '',
        ipAddress: '',
        country: '',
        referrer: '',
        ...data.metadata
      }
    };

    // Store session
    await this.redis.setex(
      `onboarding_session:${sessionId}`,
      86400 * 7, // 7 days
      JSON.stringify(session)
    );

    return session;
  }

  private async verifySocialToken(provider: SocialProvider, token: string): Promise<SocialUserData> {
    try {
      const response = await fetch(provider.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Social provider API error: ${response.statusText}`);
      }

      const userData = await response.json();
      
      // Map provider-specific fields to standard format
      return {
        providerId: userData[provider.fieldMapping.email] || userData.id,
        provider: provider.id,
        email: userData[provider.fieldMapping.email],
        firstName: userData[provider.fieldMapping.firstName] || '',
        lastName: userData[provider.fieldMapping.lastName] || '',
        avatar: userData[provider.fieldMapping.avatar],
        company: userData[provider.fieldMapping.company],
        jobTitle: userData[provider.fieldMapping.jobTitle],
        verified: userData.email_verified || false,
        raw: userData
      };
    } catch (error) {
      this.logger.error({ error, provider: provider.id }, 'Social token verification failed');
      throw new Error('Failed to verify social login');
    }
  }

  private async validateInvite(token: string): Promise<InviteData | null> {
    const inviteData = await this.redis.get(`invite:${token}`);
    if (!inviteData) {
      return null;
    }

    const invite: InviteData = JSON.parse(inviteData);
    
    if (new Date() > invite.expiresAt) {
      await this.redis.del(`invite:${token}`);
      return null;
    }

    return invite;
  }

  private async validateSSOToken(token: string): Promise<any> {
    // Implementation would depend on SSO provider (SAML, OIDC, etc.)
    // This is a simplified placeholder
    
    const decoded = this.decodeSSOToken(token);
    
    return {
      id: decoded.sub,
      email: decoded.email,
      firstName: decoded.given_name || '',
      lastName: decoded.family_name || '',
      company: decoded.company,
      organizationId: decoded.org_id
    };
  }

  private decodeSSOToken(token: string): any {
    // JWT decode or SAML assertion parsing
    // Simplified implementation
    try {
      const payload = token.split('.')[1];
      return JSON.parse(Buffer.from(payload, 'base64').toString());
    } catch {
      throw new Error('Invalid SSO token');
    }
  }

  private needsProfileCompletion(socialData: SocialUserData): boolean {
    return !socialData.company || !socialData.jobTitle;
  }

  private async linkSocialAccount(userId: string, socialData: SocialUserData): Promise<void> {
    // Store social account linkage
    await this.redis.setex(
      `social_link:${userId}:${socialData.provider}`,
      86400 * 365, // 1 year
      JSON.stringify({
        providerId: socialData.providerId,
        email: socialData.email,
        linkedAt: new Date()
      })
    );
  }

  private evaluateStepCondition(step: ProgressiveRegistrationStep, session: OnboardingSession): boolean {
    if (!step.condition) {
      return true;
    }

    // Simple condition evaluation (can be enhanced with a proper expression engine)
    try {
      const variables = { ...session.metadata, ...session.variables };
      return new Function('data', `return ${step.condition}`)(variables);
    } catch {
      return true; // Default to showing step if condition evaluation fails
    }
  }

  private async validateStepData(step: ProgressiveRegistrationStep, data: Record<string, any>): Promise<Record<string, string>> {
    const errors: Record<string, string> = {};

    for (const field of step.fields) {
      const value = data[field.id];
      
      // Required field validation
      if (field.required && (!value || value === '')) {
        errors[field.id] = `${field.label} is required`;
        continue;
      }

      // Field-specific validations
      if (value && field.validation) {
        for (const validation of field.validation) {
          const validationError = this.validateField(value, validation);
          if (validationError) {
            errors[field.id] = validationError;
            break;
          }
        }
      }
    }

    return errors;
  }

  private validateField(value: any, validation: FieldValidation): string | null {
    switch (validation.type) {
      case 'required':
        return !value ? validation.message : null;
      
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRegex.test(value) ? validation.message : null;
      
      case 'minLength':
        return value.length < validation.value ? validation.message : null;
      
      case 'maxLength':
        return value.length > validation.value ? validation.message : null;
      
      case 'regex':
        const regex = new RegExp(validation.value);
        return !regex.test(value) ? validation.message : null;
      
      default:
        return null;
    }
  }

  private async updateUserData(userId: string, data: Record<string, any>): Promise<void> {
    const updateData: any = {};
    
    if (data.firstName || data.lastName) {
      updateData.name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    }
    
    if (data.phone) {
      updateData.phoneNumber = data.phone;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    }
  }

  private async updateOnboardingSession(sessionId: string, updates: Partial<OnboardingSession>): Promise<void> {
    const sessionData = await this.redis.get(`onboarding_session:${sessionId}`);
    if (!sessionData) {
      return;
    }

    const session = JSON.parse(sessionData);
    const updatedSession = { ...session, ...updates };
    
    await this.redis.setex(
      `onboarding_session:${sessionId}`,
      86400 * 7,
      JSON.stringify(updatedSession)
    );
  }

  private async getOnboardingSession(sessionId: string): Promise<OnboardingSession | null> {
    const sessionData = await this.redis.get(`onboarding_session:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  private async createOrganization(data: {
    name: string;
    ownerId: string;
    domain: string;
  }): Promise<any> {
    // Implementation would create organization in database
    // Simplified for this example
    return {
      id: this.generateId(),
      name: data.name,
      domain: data.domain,
      ownerId: data.ownerId
    };
  }

  private async addUserToOrganization(userId: string, organizationId: string, role: string): Promise<void> {
    // Implementation would add user to organization
    // Simplified for this example
  }

  private async generateVerificationToken(userId: string, email: string): Promise<string> {
    const token = this.generateSecureToken();
    
    await this.redis.setex(
      `verification:${token}`,
      3600, // 1 hour
      JSON.stringify({ userId, email })
    );
    
    return token;
  }

  private async hashPassword(password: string): Promise<string> {
    // Implementation would use bcrypt or similar
    return password; // Simplified
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateSessionId(): string {
    return `reg_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateId(): string {
    return `id_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private async trackRegistrationAttempt(request: RegistrationRequest, duration: number): Promise<void> {
    this.analytics.totalRegistrations++;
    
    // Track by method
    if (!this.analytics.conversionRates.byMethod[request.method]) {
      this.analytics.conversionRates.byMethod[request.method] = 0;
    }
    
    // Track by source
    const source = request.source || 'direct';
    if (!this.analytics.conversionRates.bySource[source]) {
      this.analytics.conversionRates.bySource[source] = 0;
    }
  }

  private initializeAnalytics(): RegistrationAnalytics {
    return {
      totalRegistrations: 0,
      completedRegistrations: 0,
      socialRegistrations: {},
      emailRegistrations: 0,
      inviteRegistrations: 0,
      conversionRates: {
        overall: 0,
        byMethod: {},
        bySource: {}
      },
      averageCompletionTime: 0,
      dropOffPoints: [],
      fraudDetection: {
        blockedRegistrations: 0,
        suspiciousActivity: 0
      }
    };
  }

  private initializeSocialProviders(): void {
    // Google OAuth
    this.socialProviders.set('google', {
      id: 'google',
      name: 'Google',
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      scope: ['email', 'profile'],
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      fieldMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        avatar: 'picture'
      }
    });

    // GitHub OAuth
    this.socialProviders.set('github', {
      id: 'github',
      name: 'GitHub',
      enabled: !!process.env.GITHUB_CLIENT_ID,
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      scope: ['user:email'],
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      fieldMapping: {
        email: 'email',
        firstName: 'name',
        lastName: '',
        avatar: 'avatar_url',
        company: 'company'
      }
    });

    // Microsoft OAuth
    this.socialProviders.set('microsoft', {
      id: 'microsoft',
      name: 'Microsoft',
      enabled: !!process.env.MICROSOFT_CLIENT_ID,
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      scope: ['User.Read'],
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      fieldMapping: {
        email: 'mail',
        firstName: 'givenName',
        lastName: 'surname',
        avatar: '',
        company: 'companyName',
        jobTitle: 'jobTitle'
      }
    });

    this.logger.info(
      { enabledProviders: Array.from(this.socialProviders.values()).filter(p => p.enabled).map(p => p.name) },
      'Social providers initialized'
    );
  }

  private initializeProgressiveSteps(): void {
    this.registrationSteps = [
      {
        id: 'basic_info',
        name: 'Basic Information',
        required: true,
        skipable: false,
        order: 1,
        fields: [
          {
            id: 'firstName',
            type: 'text',
            label: 'First Name',
            placeholder: 'Enter your first name',
            required: true,
            validation: [
              { type: 'required', message: 'First name is required' },
              { type: 'minLength', value: 2, message: 'First name must be at least 2 characters' }
            ],
            autocomplete: 'given-name'
          },
          {
            id: 'lastName',
            type: 'text',
            label: 'Last Name',
            placeholder: 'Enter your last name',
            required: true,
            validation: [
              { type: 'required', message: 'Last name is required' },
              { type: 'minLength', value: 2, message: 'Last name must be at least 2 characters' }
            ],
            autocomplete: 'family-name'
          }
        ]
      },
      {
        id: 'company_info',
        name: 'Company Information',
        required: false,
        skipable: true,
        order: 2,
        condition: 'data.accountType !== "PERSONAL"',
        fields: [
          {
            id: 'company',
            type: 'text',
            label: 'Company Name',
            placeholder: 'Enter your company name',
            required: false,
            validation: [],
            autocomplete: 'organization'
          },
          {
            id: 'jobTitle',
            type: 'text',
            label: 'Job Title',
            placeholder: 'Enter your job title',
            required: false,
            validation: [],
            autocomplete: 'organization-title'
          },
          {
            id: 'companySize',
            type: 'select',
            label: 'Company Size',
            placeholder: 'Select company size',
            required: false,
            validation: [],
            options: ['1-10', '11-50', '51-200', '201-1000', '1000+']
          }
        ]
      },
      {
        id: 'contact_info',
        name: 'Contact Information',
        required: false,
        skipable: true,
        order: 3,
        fields: [
          {
            id: 'phone',
            type: 'phone',
            label: 'Phone Number',
            placeholder: 'Enter your phone number',
            required: false,
            validation: [
              { type: 'regex', value: '^[\+]?[1-9][\d]{0,3}[\s\-]?[\d\s\-]{4,14}$', message: 'Invalid phone number format' }
            ],
            autocomplete: 'tel'
          }
        ]
      }
    ];
  }

  private startAnalyticsCollection(): void {
    // Start periodic analytics updates
    setInterval(() => {
      this.updateAnalytics();
    }, 300000); // Every 5 minutes
  }

  private async updateAnalytics(): Promise<void> {
    // Update conversion rates
    if (this.analytics.totalRegistrations > 0) {
      this.analytics.conversionRates.overall = 
        (this.analytics.completedRegistrations / this.analytics.totalRegistrations) * 100;
    }
  }
}

/**
 * Fraud Detection Service
 */
class FraudDetector {
  private logger: Logger;
  private redis: any;

  constructor(logger: Logger, redis: any) {
    this.logger = logger;
    this.redis = redis;
  }

  async checkRegistration(request: RegistrationRequest): Promise<{
    blocked: boolean;
    suspicious: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let blocked = false;
    let suspicious = false;

    // Check rate limiting by IP
    const ipKey = `rate_limit:${request.metadata?.ipAddress}`;
    const ipCount = await this.redis.get(ipKey) || 0;
    
    if (parseInt(ipCount) > 10) { // More than 10 registrations per hour
      blocked = true;
      reasons.push('Rate limit exceeded');
    } else if (parseInt(ipCount) > 5) {
      suspicious = true;
      reasons.push('High registration frequency');
    }

    // Update rate limit counter
    await this.redis.setex(ipKey, 3600, parseInt(ipCount) + 1);

    // Check disposable email domains
    if (request.data.email) {
      const domain = request.data.email.split('@')[1];
      const isDisposable = await this.isDisposableEmailDomain(domain);
      
      if (isDisposable) {
        suspicious = true;
        reasons.push('Disposable email domain');
      }
    }

    // Check for suspicious patterns
    if (request.data.firstName && request.data.lastName) {
      const namePattern = /^[a-zA-Z\s]+$/;
      if (!namePattern.test(request.data.firstName) || !namePattern.test(request.data.lastName)) {
        suspicious = true;
        reasons.push('Suspicious name pattern');
      }
    }

    return { blocked, suspicious, reasons };
  }

  private async isDisposableEmailDomain(domain: string): Promise<boolean> {
    // Check against known disposable email domains
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
      'mailinator.com', 'yopmail.com'
    ];
    
    return disposableDomains.includes(domain.toLowerCase());
  }
}