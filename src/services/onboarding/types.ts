/**
 * Customer Onboarding System - Type Definitions
 * Enterprise SaaS IDP Platform
 */

// Account Types
export enum AccountType {
  TRIAL = 'TRIAL',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

// Onboarding Status
export enum OnboardingStatus {
  SIGNUP_STARTED = 'SIGNUP_STARTED',
  EMAIL_VERIFICATION_PENDING = 'EMAIL_VERIFICATION_PENDING',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  PROFILE_SETUP = 'PROFILE_SETUP',
  ORGANIZATION_SETUP = 'ORGANIZATION_SETUP',
  INTEGRATION_SETUP = 'INTEGRATION_SETUP',
  PRODUCT_TOUR = 'PRODUCT_TOUR',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED'
}

// Onboarding Steps
export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  order: number;
  required: boolean;
  completed: boolean;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

// Customer Profile
export interface CustomerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  phone?: string;
  timezone?: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// Organization Details
export interface Organization {
  id: string;
  name: string;
  domain: string;
  size: OrganizationSize;
  industry: string;
  website?: string;
  logo?: string;
  address?: Address;
  billingInfo?: BillingInfo;
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrganizationSize {
  SMALL = '1-50',
  MEDIUM = '51-200',
  LARGE = '201-1000',
  ENTERPRISE = '1000+'
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface BillingInfo {
  companyName: string;
  taxId?: string;
  billingEmail: string;
  paymentMethod?: PaymentMethod;
  billingAddress: Address;
}

export interface PaymentMethod {
  type: 'CREDIT_CARD' | 'ACH' | 'INVOICE';
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

// Trial Account
export interface TrialAccount {
  id: string;
  customerId: string;
  organizationId: string;
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  features: string[];
  usageLimits: UsageLimits;
  demoDataGenerated: boolean;
  conversionProbability: number;
  status: TrialStatus;
}

export enum TrialStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED',
  CANCELLED = 'CANCELLED'
}

export interface UsageLimits {
  maxUsers: number;
  maxProjects: number;
  maxIntegrations: number;
  maxApiCalls: number;
  maxStorageGB: number;
}

// Onboarding Session
export interface OnboardingSession {
  id: string;
  customerId: string;
  organizationId: string;
  accountType: AccountType;
  status: OnboardingStatus;
  currentStep: number;
  steps: OnboardingStep[];
  startedAt: Date;
  completedAt?: Date;
  abandonedAt?: Date;
  timeSpentMinutes: number;
  completionPercentage: number;
  metadata: OnboardingMetadata;
}

export interface OnboardingMetadata {
  source: string; // 'organic', 'paid', 'referral', 'partner'
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  deviceType: string;
  browser: string;
  ipAddress: string;
  country: string;
}

// User Preferences
export interface UserPreferences {
  language: string;
  dateFormat: string;
  timeFormat: string;
  notifications: NotificationPreferences;
  productTour: ProductTourPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  digest: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'NEVER';
}

export interface ProductTourPreferences {
  autoStart: boolean;
  showHints: boolean;
  completedTours: string[];
  skippedTours: string[];
}

// Organization Settings
export interface OrganizationSettings {
  sso: SSOConfig;
  security: SecuritySettings;
  integrations: IntegrationSettings;
  compliance: ComplianceSettings;
}

export interface SSOConfig {
  enabled: boolean;
  provider?: 'SAML' | 'OIDC' | 'OAUTH2';
  idpUrl?: string;
  certificate?: string;
  metadata?: Record<string, any>;
}

export interface SecuritySettings {
  mfaRequired: boolean;
  passwordPolicy: PasswordPolicy;
  ipWhitelist: string[];
  sessionTimeout: number;
  auditLogging: boolean;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays: number;
  preventReuse: number;
}

export interface IntegrationSettings {
  github?: GitHubIntegration;
  gitlab?: GitLabIntegration;
  jenkins?: JenkinsIntegration;
  aws?: AWSIntegration;
  slack?: SlackIntegration;
}

export interface GitHubIntegration {
  enabled: boolean;
  organizationName: string;
  accessToken?: string;
  webhookSecret?: string;
  repositories: string[];
}

export interface GitLabIntegration {
  enabled: boolean;
  instanceUrl: string;
  accessToken?: string;
  groupId: string;
}

export interface JenkinsIntegration {
  enabled: boolean;
  serverUrl: string;
  username: string;
  apiToken?: string;
}

export interface AWSIntegration {
  enabled: boolean;
  accountId: string;
  region: string;
  roleArn?: string;
}

export interface SlackIntegration {
  enabled: boolean;
  workspaceId: string;
  botToken?: string;
  channels: string[];
}

export interface ComplianceSettings {
  gdprEnabled: boolean;
  hipaaEnabled: boolean;
  soc2Enabled: boolean;
  dataResidency: string;
  dataRetentionDays: number;
}

// Product Tour
export interface ProductTour {
  id: string;
  name: string;
  description: string;
  targetRole: string[];
  steps: TourStep[];
  estimatedMinutes: number;
  category: TourCategory;
}

export enum TourCategory {
  GETTING_STARTED = 'GETTING_STARTED',
  FEATURE_DISCOVERY = 'FEATURE_DISCOVERY',
  BEST_PRACTICES = 'BEST_PRACTICES',
  ADVANCED = 'ADVANCED'
}

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: TourAction;
  validation?: TourValidation;
}

export interface TourAction {
  type: 'click' | 'input' | 'navigate';
  value?: string;
}

export interface TourValidation {
  type: 'element_exists' | 'element_contains' | 'url_matches';
  value: string;
}

// Customer Health Score
export interface CustomerHealthScore {
  customerId: string;
  organizationId: string;
  score: number; // 0-100
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  factors: HealthFactor[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lastCalculated: Date;
}

export interface HealthFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

// Onboarding Analytics
export interface OnboardingAnalytics {
  totalSignups: number;
  completedOnboardings: number;
  abandonmentRate: number;
  averageTimeToComplete: number;
  conversionRate: number;
  stepCompletionRates: Record<string, number>;
  topDropOffPoints: string[];
  averageHealthScore: number;
}

// Email Templates
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  category: EmailCategory;
}

export enum EmailCategory {
  WELCOME = 'WELCOME',
  VERIFICATION = 'VERIFICATION',
  ONBOARDING = 'ONBOARDING',
  TRIAL_REMINDER = 'TRIAL_REMINDER',
  FEATURE_ANNOUNCEMENT = 'FEATURE_ANNOUNCEMENT',
  SURVEY = 'SURVEY'
}

// Survey and Feedback
export interface OnboardingSurvey {
  id: string;
  customerId: string;
  type: 'NPS' | 'CSAT' | 'CES';
  score: number;
  feedback?: string;
  submittedAt: Date;
}

// Webhook Events
export interface OnboardingWebhookEvent {
  id: string;
  type: OnboardingEventType;
  customerId: string;
  organizationId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export enum OnboardingEventType {
  SIGNUP_STARTED = 'SIGNUP_STARTED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  TRIAL_STARTED = 'TRIAL_STARTED',
  INTEGRATION_CONNECTED = 'INTEGRATION_CONNECTED',
  TOUR_COMPLETED = 'TOUR_COMPLETED',
  ONBOARDING_COMPLETED = 'ONBOARDING_COMPLETED',
  TRIAL_EXPIRING = 'TRIAL_EXPIRING',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
  TRIAL_CONVERTED = 'TRIAL_CONVERTED',
  ACCOUNT_UPGRADED = 'ACCOUNT_UPGRADED',
  CHURN_RISK_DETECTED = 'CHURN_RISK_DETECTED'
}