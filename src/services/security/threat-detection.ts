/**
 * Advanced Threat Detection Engine
 * 
 * Real-time threat detection and security monitoring system that uses machine
 * learning, behavioral analysis, and rule-based detection to identify security
 * threats and anomalies across the platform.
 * 
 * Features:
 * - Real-time event processing and correlation
 * - Machine learning-based anomaly detection
 * - Behavioral analysis and user profiling
 * - Rule-based threat detection
 * - Attack pattern recognition
 * - Threat intelligence integration
 * - Automated incident classification
 * - Risk scoring and prioritization
 */

import { Logger } from '@backstage/backend-common';
import { SecurityConfigManager, ThreatDetectionConfig, ThreatRule } from './security-config';
import * as crypto from 'crypto';

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  source: string;
  type: ThreatEventType;
  severity: ThreatSeverity;
  confidence: number;
  category: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  indicators: ThreatIndicator[];
  affectedAssets: string[];
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  geolocation?: GeoLocation;
  rawEvent: any;
}

export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'user' | 'process';
  value: string;
  confidence: number;
  context: string;
  source: string;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  asn?: string;
  organization?: string;
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: ThreatSeverity;
  status: IncidentStatus;
  category: string;
  events: ThreatEvent[];
  timeline: IncidentEvent[];
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  metadata: Record<string, any>;
  mitigations: string[];
  artifacts: IncidentArtifact[];
}

export interface IncidentEvent {
  id: string;
  timestamp: Date;
  type: 'detection' | 'escalation' | 'mitigation' | 'resolution' | 'comment';
  description: string;
  actor: string;
  metadata: Record<string, any>;
}

export interface IncidentArtifact {
  id: string;
  type: 'log' | 'pcap' | 'screenshot' | 'memory-dump' | 'file';
  name: string;
  path: string;
  hash: string;
  size: number;
  createdAt: Date;
}

export interface UserBehaviorProfile {
  userId: string;
  baseline: BehaviorBaseline;
  recentActivity: ActivityPattern[];
  riskScore: number;
  anomalies: BehaviorAnomaly[];
  lastUpdated: Date;
}

export interface BehaviorBaseline {
  loginTimes: number[];
  locations: string[];
  devices: string[];
  applications: string[];
  dataAccess: string[];
  networkPatterns: NetworkPattern[];
}

export interface ActivityPattern {
  timestamp: Date;
  action: string;
  resource: string;
  details: Record<string, any>;
  risk: number;
}

export interface BehaviorAnomaly {
  id: string;
  type: 'temporal' | 'geographical' | 'access' | 'volume' | 'pattern';
  severity: number;
  description: string;
  evidence: any[];
  timestamp: Date;
}

export interface NetworkPattern {
  protocol: string;
  ports: number[];
  destinations: string[];
  frequency: number;
  volume: number;
}

export interface MLModel {
  name: string;
  version: string;
  type: 'anomaly-detection' | 'classification' | 'clustering';
  status: 'training' | 'ready' | 'updating' | 'failed';
  accuracy: number;
  lastTrained: Date;
  features: string[];
}

export interface ThreatIntelligence {
  indicators: ThreatIndicator[];
  campaigns: ThreatCampaign[];
  tactics: string[];
  techniques: string[];
  procedures: string[];
  lastUpdated: Date;
}

export interface ThreatCampaign {
  id: string;
  name: string;
  description: string;
  actors: string[];
  targets: string[];
  ttps: string[];
  indicators: ThreatIndicator[];
  active: boolean;
}

export type ThreatEventType = 
  | 'authentication-failure' 
  | 'privilege-escalation' 
  | 'data-exfiltration' 
  | 'malware-detection' 
  | 'network-intrusion' 
  | 'policy-violation' 
  | 'anomalous-behavior' 
  | 'suspicious-activity';

export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'false-positive';

/**
 * Real-time Event Processor
 * Processes security events in real-time and applies detection rules
 */
export class RealTimeEventProcessor {
  private logger: Logger;
  private rules: Map<string, ThreatRule> = new Map();
  private eventBuffer: ThreatEvent[] = [];
  private processingQueue: ThreatEvent[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize the event processor with detection rules
   */
  async initialize(rules: ThreatRule[]): Promise<void> {
    this.logger.info('Initializing Real-time Event Processor');
    
    for (const rule of rules) {
      if (rule.enabled) {
        this.rules.set(rule.id, rule);
      }
    }
    
    this.logger.info(`Loaded ${this.rules.size} threat detection rules`);
  }

  /**
   * Process incoming security event
   */
  async processEvent(event: ThreatEvent): Promise<ThreatEvent[]> {
    this.eventBuffer.push(event);
    
    const threats: ThreatEvent[] = [];
    
    // Apply detection rules
    for (const rule of this.rules.values()) {
      const matches = await this.evaluateRule(rule, event);
      threats.push(...matches);
    }
    
    // Correlation analysis
    const correlatedThreats = await this.correlateEvents([event]);
    threats.push(...correlatedThreats);
    
    return threats;
  }

  /**
   * Evaluate threat detection rule against event
   */
  private async evaluateRule(rule: ThreatRule, event: ThreatEvent): Promise<ThreatEvent[]> {
    const threats: ThreatEvent[] = [];
    
    try {
      // Simulate rule evaluation logic
      switch (rule.name) {
        case 'Brute Force Detection':
          const bruteForceThreats = await this.detectBruteForce(event);
          threats.push(...bruteForceThreats);
          break;
          
        case 'Suspicious Login Location':
          const locationThreats = await this.detectSuspiciousLocation(event);
          threats.push(...locationThreats);
          break;
          
        case 'Data Exfiltration':
          const exfiltrationThreats = await this.detectDataExfiltration(event);
          threats.push(...exfiltrationThreats);
          break;
          
        case 'Privilege Escalation':
          const privescThreats = await this.detectPrivilegeEscalation(event);
          threats.push(...privescThreats);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate rule ${rule.name}`, error);
    }
    
    return threats;
  }

  /**
   * Detect brute force attacks
   */
  private async detectBruteForce(event: ThreatEvent): Promise<ThreatEvent[]> {
    if (event.type !== 'authentication-failure') {
      return [];
    }
    
    // Get recent failed login attempts for this IP/user
    const recentFailures = this.eventBuffer
      .filter(e => 
        e.type === 'authentication-failure' &&
        e.ipAddress === event.ipAddress &&
        e.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      )
      .length;
    
    if (recentFailures >= 5) {
      return [{
        id: crypto.randomUUID(),
        timestamp: new Date(),
        source: 'threat-detection-engine',
        type: 'authentication-failure',
        severity: 'high',
        confidence: 0.9,
        category: 'brute-force',
        title: 'Brute Force Attack Detected',
        description: `Multiple failed login attempts from ${event.ipAddress}`,
        metadata: {
          failedAttempts: recentFailures,
          timeWindow: '5 minutes',
          sourceIP: event.ipAddress
        },
        indicators: [{
          type: 'ip',
          value: event.ipAddress!,
          confidence: 0.9,
          context: 'source',
          source: 'detection-engine'
        }],
        affectedAssets: ['authentication-system'],
        ipAddress: event.ipAddress,
        rawEvent: event
      }];
    }
    
    return [];
  }

  /**
   * Detect suspicious login locations
   */
  private async detectSuspiciousLocation(event: ThreatEvent): Promise<ThreatEvent[]> {
    if (!event.userId || !event.geolocation) {
      return [];
    }
    
    // Get user's typical locations
    const recentLocations = this.eventBuffer
      .filter(e => 
        e.userId === event.userId &&
        e.geolocation &&
        e.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      )
      .map(e => e.geolocation!.country);
    
    const uniqueCountries = [...new Set(recentLocations)];
    
    // Check if this is a new country for the user
    if (!uniqueCountries.includes(event.geolocation.country) && uniqueCountries.length > 0) {
      return [{
        id: crypto.randomUUID(),
        timestamp: new Date(),
        source: 'threat-detection-engine',
        type: 'suspicious-activity',
        severity: 'medium',
        confidence: 0.7,
        category: 'geolocation-anomaly',
        title: 'Suspicious Login Location',
        description: `Login from unusual location: ${event.geolocation.country}`,
        metadata: {
          newLocation: event.geolocation,
          typicalCountries: uniqueCountries,
          userId: event.userId
        },
        indicators: [{
          type: 'user',
          value: event.userId,
          confidence: 0.7,
          context: 'subject',
          source: 'detection-engine'
        }],
        affectedAssets: ['user-account'],
        userId: event.userId,
        geolocation: event.geolocation,
        rawEvent: event
      }];
    }
    
    return [];
  }

  /**
   * Detect data exfiltration attempts
   */
  private async detectDataExfiltration(event: ThreatEvent): Promise<ThreatEvent[]> {
    // Check for large data transfers or unusual access patterns
    if (event.metadata?.dataVolume && event.metadata.dataVolume > 1000000) { // 1MB
      return [{
        id: crypto.randomUUID(),
        timestamp: new Date(),
        source: 'threat-detection-engine',
        type: 'data-exfiltration',
        severity: 'high',
        confidence: 0.8,
        category: 'data-loss-prevention',
        title: 'Potential Data Exfiltration',
        description: 'Large volume data transfer detected',
        metadata: {
          dataVolume: event.metadata.dataVolume,
          destination: event.metadata.destination,
          userId: event.userId
        },
        indicators: [{
          type: 'user',
          value: event.userId!,
          confidence: 0.8,
          context: 'actor',
          source: 'detection-engine'
        }],
        affectedAssets: ['data-storage'],
        userId: event.userId,
        rawEvent: event
      }];
    }
    
    return [];
  }

  /**
   * Detect privilege escalation attempts
   */
  private async detectPrivilegeEscalation(event: ThreatEvent): Promise<ThreatEvent[]> {
    if (event.type === 'privilege-escalation') {
      return [{
        id: crypto.randomUUID(),
        timestamp: new Date(),
        source: 'threat-detection-engine',
        type: 'privilege-escalation',
        severity: 'critical',
        confidence: 0.95,
        category: 'privilege-abuse',
        title: 'Privilege Escalation Detected',
        description: 'Unauthorized privilege elevation attempt',
        metadata: {
          fromRole: event.metadata?.fromRole,
          toRole: event.metadata?.toRole,
          userId: event.userId
        },
        indicators: [{
          type: 'user',
          value: event.userId!,
          confidence: 0.95,
          context: 'actor',
          source: 'detection-engine'
        }],
        affectedAssets: ['identity-management'],
        userId: event.userId,
        rawEvent: event
      }];
    }
    
    return [];
  }

  /**
   * Correlate events to identify complex attack patterns
   */
  private async correlateEvents(events: ThreatEvent[]): Promise<ThreatEvent[]> {
    const correlatedThreats: ThreatEvent[] = [];
    
    // Look for multi-stage attacks
    const timeWindow = 60 * 60 * 1000; // 1 hour
    const windowEnd = Date.now();
    const windowStart = windowEnd - timeWindow;
    
    const recentEvents = this.eventBuffer.filter(e =>
      e.timestamp.getTime() >= windowStart && e.timestamp.getTime() <= windowEnd
    );
    
    // Detect APT-like patterns
    const aptPattern = this.detectAPTPattern(recentEvents);
    if (aptPattern) {
      correlatedThreats.push(aptPattern);
    }
    
    return correlatedThreats;
  }

  /**
   * Detect Advanced Persistent Threat patterns
   */
  private detectAPTPattern(events: ThreatEvent[]): ThreatEvent | null {
    // Look for: Initial access -> Persistence -> Lateral movement -> Exfiltration
    const stages = {
      'initial-access': events.filter(e => e.category === 'initial-access').length > 0,
      'persistence': events.filter(e => e.category === 'persistence').length > 0,
      'lateral-movement': events.filter(e => e.category === 'lateral-movement').length > 0,
      'exfiltration': events.filter(e => e.category === 'data-loss-prevention').length > 0
    };
    
    const completedStages = Object.values(stages).filter(Boolean).length;
    
    if (completedStages >= 3) {
      return {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        source: 'threat-correlation-engine',
        type: 'network-intrusion',
        severity: 'critical',
        confidence: 0.85,
        category: 'advanced-persistent-threat',
        title: 'APT Activity Detected',
        description: 'Multi-stage attack pattern consistent with APT behavior',
        metadata: {
          stages: stages,
          eventsCorrelated: events.length,
          timespan: '1 hour'
        },
        indicators: events.flatMap(e => e.indicators),
        affectedAssets: [...new Set(events.flatMap(e => e.affectedAssets))],
        rawEvent: { correlatedEvents: events }
      };
    }
    
    return null;
  }
}

/**
 * Machine Learning Anomaly Detection
 * Uses ML models to detect behavioral anomalies and unknown threats
 */
export class MLAnomalyDetector {
  private logger: Logger;
  private models: Map<string, MLModel> = new Map();
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize ML models and load user profiles
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing ML Anomaly Detector');
    
    // Initialize anomaly detection model
    const anomalyModel: MLModel = {
      name: 'user-behavior-anomaly',
      version: '1.0.0',
      type: 'anomaly-detection',
      status: 'ready',
      accuracy: 0.87,
      lastTrained: new Date(),
      features: ['login-time', 'location', 'access-pattern', 'data-volume', 'session-duration']
    };
    
    this.models.set(anomalyModel.name, anomalyModel);
    
    // Load existing user profiles
    await this.loadUserProfiles();
    
    this.logger.info(`Initialized ${this.models.size} ML models`);
  }

  /**
   * Analyze user behavior for anomalies
   */
  async analyzeUserBehavior(userId: string, activities: ActivityPattern[]): Promise<BehaviorAnomaly[]> {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      // Create new profile
      await this.createUserProfile(userId, activities);
      return [];
    }
    
    const anomalies: BehaviorAnomaly[] = [];
    
    // Temporal anomalies
    const temporalAnomalies = await this.detectTemporalAnomalies(profile, activities);
    anomalies.push(...temporalAnomalies);
    
    // Access pattern anomalies
    const accessAnomalies = await this.detectAccessAnomalies(profile, activities);
    anomalies.push(...accessAnomalies);
    
    // Volume anomalies
    const volumeAnomalies = await this.detectVolumeAnomalies(profile, activities);
    anomalies.push(...volumeAnomalies);
    
    // Update user profile with new activities
    await this.updateUserProfile(userId, activities);
    
    return anomalies;
  }

  /**
   * Detect temporal behavior anomalies
   */
  private async detectTemporalAnomalies(
    profile: UserBehaviorProfile, 
    activities: ActivityPattern[]
  ): Promise<BehaviorAnomaly[]> {
    const anomalies: BehaviorAnomaly[] = [];
    
    for (const activity of activities) {
      const hour = activity.timestamp.getHours();
      const typicalHours = profile.baseline.loginTimes;
      
      // Check if this is an unusual time
      const isUnusualTime = !typicalHours.some(h => Math.abs(h - hour) <= 2);
      
      if (isUnusualTime) {
        anomalies.push({
          id: crypto.randomUUID(),
          type: 'temporal',
          severity: 0.6,
          description: `Activity at unusual time: ${hour}:00`,
          evidence: [{ unusualHour: hour, typicalHours: typicalHours }],
          timestamp: activity.timestamp
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect access pattern anomalies
   */
  private async detectAccessAnomalies(
    profile: UserBehaviorProfile,
    activities: ActivityPattern[]
  ): Promise<BehaviorAnomaly[]> {
    const anomalies: BehaviorAnomaly[] = [];
    
    const accessedResources = activities.map(a => a.resource);
    const typicalResources = profile.baseline.dataAccess;
    
    const unusualResources = accessedResources.filter(
      resource => !typicalResources.includes(resource)
    );
    
    if (unusualResources.length > 0) {
      anomalies.push({
        id: crypto.randomUUID(),
        type: 'access',
        severity: 0.7,
        description: `Access to unusual resources: ${unusualResources.join(', ')}`,
        evidence: [{ unusualResources, typicalResources }],
        timestamp: new Date()
      });
    }
    
    return anomalies;
  }

  /**
   * Detect volume anomalies
   */
  private async detectVolumeAnomalies(
    profile: UserBehaviorProfile,
    activities: ActivityPattern[]
  ): Promise<BehaviorAnomaly[]> {
    const anomalies: BehaviorAnomaly[] = [];
    
    const activityVolume = activities.length;
    const recentActivityVolumes = profile.recentActivity
      .slice(-7) // Last 7 days
      .map(a => a.details.volume || 1)
      .reduce((sum, vol) => sum + vol, 0) / 7;
    
    // Check if current volume is significantly higher than usual
    if (activityVolume > recentActivityVolumes * 3) {
      anomalies.push({
        id: crypto.randomUUID(),
        type: 'volume',
        severity: 0.8,
        description: `Unusually high activity volume: ${activityVolume} vs typical ${recentActivityVolumes}`,
        evidence: [{ currentVolume: activityVolume, typicalVolume: recentActivityVolumes }],
        timestamp: new Date()
      });
    }
    
    return anomalies;
  }

  /**
   * Create new user behavior profile
   */
  private async createUserProfile(userId: string, activities: ActivityPattern[]): Promise<void> {
    const profile: UserBehaviorProfile = {
      userId,
      baseline: {
        loginTimes: activities.map(a => a.timestamp.getHours()),
        locations: [], // Would be populated from geolocation data
        devices: [], // Would be populated from device fingerprinting
        applications: activities.map(a => a.resource),
        dataAccess: activities.map(a => a.resource),
        networkPatterns: []
      },
      recentActivity: activities,
      riskScore: 0,
      anomalies: [],
      lastUpdated: new Date()
    };
    
    this.userProfiles.set(userId, profile);
    this.logger.debug(`Created behavior profile for user ${userId}`);
  }

  /**
   * Update user behavior profile
   */
  private async updateUserProfile(userId: string, activities: ActivityPattern[]): Promise<void> {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;
    
    // Add new activities
    profile.recentActivity.push(...activities);
    
    // Keep only recent activities (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    profile.recentActivity = profile.recentActivity.filter(a => a.timestamp > thirtyDaysAgo);
    
    // Update baseline
    profile.baseline.loginTimes = profile.recentActivity.map(a => a.timestamp.getHours());
    profile.baseline.dataAccess = [...new Set(profile.recentActivity.map(a => a.resource))];
    
    profile.lastUpdated = new Date();
    
    this.logger.debug(`Updated behavior profile for user ${userId}`);
  }

  /**
   * Load existing user profiles
   */
  private async loadUserProfiles(): Promise<void> {
    // In a real implementation, this would load from a database
    // For now, we'll start with empty profiles
    this.logger.debug('User profiles loaded (empty for demo)');
  }
}

/**
 * Main Threat Detection Engine
 */
export class ThreatDetectionEngine {
  private logger: Logger;
  private configManager: SecurityConfigManager;
  private eventProcessor: RealTimeEventProcessor;
  private anomalyDetector: MLAnomalyDetector;
  private incidents: Map<string, SecurityIncident> = new Map();
  private threatIntelligence: ThreatIntelligence | null = null;

  constructor(logger: Logger, configManager: SecurityConfigManager) {
    this.logger = logger;
    this.configManager = configManager;
    this.eventProcessor = new RealTimeEventProcessor(logger);
    this.anomalyDetector = new MLAnomalyDetector(logger);
  }

  /**
   * Initialize the threat detection engine
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Threat Detection Engine');
    
    const config = this.configManager.getConfig().threat;
    
    if (!config.enabled) {
      this.logger.info('Threat detection is disabled');
      return;
    }
    
    // Initialize event processor with rules
    await this.eventProcessor.initialize(config.rules);
    
    // Initialize ML anomaly detector
    await this.anomalyDetector.initialize();
    
    // Load threat intelligence
    await this.loadThreatIntelligence();
    
    this.logger.info('Threat Detection Engine initialized successfully');
  }

  /**
   * Process a security event and detect threats
   */
  async processSecurityEvent(event: ThreatEvent): Promise<ThreatEvent[]> {
    this.logger.debug(`Processing security event: ${event.type}`);
    
    const detectedThreats: ThreatEvent[] = [];
    
    try {
      // Real-time rule-based detection
      const ruleThreats = await this.eventProcessor.processEvent(event);
      detectedThreats.push(...ruleThreats);
      
      // ML-based anomaly detection
      if (event.userId) {
        const activities: ActivityPattern[] = [{
          timestamp: event.timestamp,
          action: event.type,
          resource: event.affectedAssets[0] || 'unknown',
          details: event.metadata,
          risk: this.calculateRiskScore(event)
        }];
        
        const anomalies = await this.anomalyDetector.analyzeUserBehavior(event.userId, activities);
        
        // Convert anomalies to threat events
        for (const anomaly of anomalies) {
          detectedThreats.push({
            id: crypto.randomUUID(),
            timestamp: anomaly.timestamp,
            source: 'ml-anomaly-detector',
            type: 'anomalous-behavior',
            severity: this.mapAnomalySeverity(anomaly.severity),
            confidence: anomaly.severity,
            category: anomaly.type,
            title: `Behavioral Anomaly: ${anomaly.description}`,
            description: anomaly.description,
            metadata: { anomaly, originalEvent: event },
            indicators: [{
              type: 'user',
              value: event.userId!,
              confidence: anomaly.severity,
              context: 'behavioral',
              source: 'ml-detector'
            }],
            affectedAssets: event.affectedAssets,
            userId: event.userId,
            rawEvent: event
          });
        }
      }
      
      // Check against threat intelligence
      const intelligenceThreats = await this.checkThreatIntelligence(event);
      detectedThreats.push(...intelligenceThreats);
      
      // Create or update incidents for high-severity threats
      for (const threat of detectedThreats) {
        if (['critical', 'high'].includes(threat.severity)) {
          await this.createOrUpdateIncident(threat);
        }
      }
      
    } catch (error) {
      this.logger.error('Error processing security event', error);
    }
    
    return detectedThreats;
  }

  /**
   * Get all active security incidents
   */
  getActiveIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(
      incident => incident.status !== 'resolved' && incident.status !== 'false-positive'
    );
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): SecurityIncident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Update incident status
   */
  async updateIncident(incidentId: string, updates: Partial<SecurityIncident>): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return false;
    }
    
    Object.assign(incident, updates);
    incident.updatedAt = new Date();
    
    // Add timeline event
    incident.timeline.push({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'comment',
      description: `Incident updated: ${Object.keys(updates).join(', ')}`,
      actor: 'system',
      metadata: updates
    });
    
    if (updates.status === 'resolved') {
      incident.resolvedAt = new Date();
    }
    
    this.logger.info(`Incident ${incidentId} updated`);
    return true;
  }

  /**
   * Get threat detection statistics
   */
  getThreatStats(): {
    totalThreats: number;
    bySeverity: Record<ThreatSeverity, number>;
    byCategory: Record<string, number>;
    activeIncidents: number;
    resolvedIncidents: number;
  } {
    const incidents = Array.from(this.incidents.values());
    const totalThreats = incidents.reduce((sum, inc) => sum + inc.events.length, 0);
    
    const stats = {
      totalThreats,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      byCategory: {} as Record<string, number>,
      activeIncidents: 0,
      resolvedIncidents: 0
    };
    
    for (const incident of incidents) {
      if (['open', 'investigating', 'contained'].includes(incident.status)) {
        stats.activeIncidents++;
      } else {
        stats.resolvedIncidents++;
      }
      
      for (const event of incident.events) {
        stats.bySeverity[event.severity]++;
        stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;
      }
    }
    
    return stats;
  }

  /**
   * Calculate risk score for an event
   */
  private calculateRiskScore(event: ThreatEvent): number {
    let score = 0;
    
    // Base score from severity
    switch (event.severity) {
      case 'critical': score += 10; break;
      case 'high': score += 7; break;
      case 'medium': score += 4; break;
      case 'low': score += 2; break;
      case 'info': score += 1; break;
    }
    
    // Confidence multiplier
    score *= event.confidence;
    
    // Category-specific scoring
    switch (event.category) {
      case 'privilege-abuse':
      case 'data-loss-prevention':
        score *= 1.5;
        break;
      case 'brute-force':
      case 'malware':
        score *= 1.3;
        break;
    }
    
    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Map anomaly severity to threat severity
   */
  private mapAnomalySeverity(severity: number): ThreatSeverity {
    if (severity >= 0.9) return 'critical';
    if (severity >= 0.7) return 'high';
    if (severity >= 0.5) return 'medium';
    if (severity >= 0.3) return 'low';
    return 'info';
  }

  /**
   * Check event against threat intelligence
   */
  private async checkThreatIntelligence(event: ThreatEvent): Promise<ThreatEvent[]> {
    if (!this.threatIntelligence) {
      return [];
    }
    
    const threats: ThreatEvent[] = [];
    
    // Check indicators
    for (const indicator of event.indicators) {
      const matchingIndicators = this.threatIntelligence.indicators.filter(
        ti => ti.type === indicator.type && ti.value === indicator.value
      );
      
      if (matchingIndicators.length > 0) {
        threats.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          source: 'threat-intelligence',
          type: 'network-intrusion',
          severity: 'high',
          confidence: 0.9,
          category: 'threat-intelligence-match',
          title: 'Known Threat Indicator Detected',
          description: `Event matches known threat indicator: ${indicator.value}`,
          metadata: {
            matchingIndicators,
            originalEvent: event
          },
          indicators: matchingIndicators,
          affectedAssets: event.affectedAssets,
          rawEvent: event
        });
      }
    }
    
    return threats;
  }

  /**
   * Create or update security incident
   */
  private async createOrUpdateIncident(threat: ThreatEvent): Promise<void> {
    // Look for existing incident that this threat might belong to
    const existingIncident = Array.from(this.incidents.values()).find(inc =>
      inc.status !== 'resolved' &&
      inc.category === threat.category &&
      inc.events.some(e => 
        e.userId === threat.userId ||
        e.ipAddress === threat.ipAddress
      )
    );
    
    if (existingIncident) {
      // Add to existing incident
      existingIncident.events.push(threat);
      existingIncident.updatedAt = new Date();
      existingIncident.timeline.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'detection',
        description: `New threat event added: ${threat.title}`,
        actor: 'system',
        metadata: { threatId: threat.id }
      });
      
      this.logger.debug(`Added threat to existing incident ${existingIncident.id}`);
    } else {
      // Create new incident
      const incident: SecurityIncident = {
        id: crypto.randomUUID(),
        title: threat.title,
        description: threat.description,
        severity: threat.severity,
        status: 'open',
        category: threat.category,
        events: [threat],
        timeline: [{
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'detection',
          description: 'Incident created',
          actor: 'system',
          metadata: {}
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        mitigations: [],
        artifacts: []
      };
      
      this.incidents.set(incident.id, incident);
      this.logger.info(`Created new security incident ${incident.id}`);
    }
  }

  /**
   * Load threat intelligence data
   */
  private async loadThreatIntelligence(): Promise<void> {
    // In a real implementation, this would load from threat intelligence feeds
    this.threatIntelligence = {
      indicators: [
        {
          type: 'ip',
          value: '192.168.1.100',
          confidence: 0.9,
          context: 'malicious',
          source: 'threat-feed'
        }
      ],
      campaigns: [],
      tactics: ['Initial Access', 'Persistence', 'Lateral Movement'],
      techniques: ['T1078', 'T1055', 'T1021'],
      procedures: [],
      lastUpdated: new Date()
    };
    
    this.logger.debug('Threat intelligence loaded');
  }
}

export default ThreatDetectionEngine;