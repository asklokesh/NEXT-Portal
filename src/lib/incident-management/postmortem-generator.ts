import { Incident, PostMortem, PostMortemTimelineItem, RootCauseAnalysis, ImpactAnalysis, PostMortemActionItem, User } from './types';

interface PostMortemTemplate {
  id: string;
  name: string;
  description: string;
  sections: PostMortemSection[];
  triggers: PostMortemTrigger[];
}

interface PostMortemSection {
  id: string;
  title: string;
  template: string;
  required: boolean;
  order: number;
}

interface PostMortemTrigger {
  severity: string[];
  duration?: number; // minutes
  services?: string[];
  impactedUsers?: number;
}

interface PostMortemContext {
  incident: Incident;
  relatedIncidents: Incident[];
  timelineEvents: any[];
  metrics: any;
  artifacts: PostMortemArtifact[];
}

interface PostMortemArtifact {
  type: 'log' | 'metric' | 'screenshot' | 'code' | 'document';
  title: string;
  url?: string;
  content?: string;
  timestamp: Date;
}

export class PostMortemGenerator {
  private templates: Map<string, PostMortemTemplate> = new Map();
  private postMortems: Map<string, PostMortem> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  async generatePostMortem(incident: Incident, templateId?: string): Promise<PostMortem> {
    // Select appropriate template
    const template = templateId 
      ? this.templates.get(templateId)
      : this.selectTemplateForIncident(incident);

    if (!template) {
      throw new Error('No suitable post-mortem template found');
    }

    // Gather context data
    const context = await this.gatherContext(incident);

    // Generate post-mortem content
    const postMortem = await this.buildPostMortem(incident, template, context);

    this.postMortems.set(postMortem.id, postMortem);
    
    return postMortem;
  }

  async updatePostMortem(id: string, updates: Partial<PostMortem>, user: User): Promise<PostMortem> {
    const postMortem = this.postMortems.get(id);
    if (!postMortem) {
      throw new Error(`Post-mortem ${id} not found`);
    }

    // Update the post-mortem
    Object.assign(postMortem, updates);

    // Add contributor if not already present
    if (!postMortem.contributors.includes(user.id)) {
      postMortem.contributors.push(user.id);
    }

    this.postMortems.set(id, postMortem);
    
    return postMortem;
  }

  async reviewPostMortem(id: string, reviewer: User, approved: boolean, comments?: string): Promise<PostMortem> {
    const postMortem = this.postMortems.get(id);
    if (!postMortem) {
      throw new Error(`Post-mortem ${id} not found`);
    }

    if (!postMortem.reviewers.includes(reviewer.id)) {
      postMortem.reviewers.push(reviewer.id);
    }

    if (approved && postMortem.status === 'under_review') {
      postMortem.status = 'approved';
    }

    return postMortem;
  }

  async publishPostMortem(id: string, publisher: User): Promise<PostMortem> {
    const postMortem = this.postMortems.get(id);
    if (!postMortem) {
      throw new Error(`Post-mortem ${id} not found`);
    }

    if (postMortem.status !== 'approved') {
      throw new Error('Post-mortem must be approved before publishing');
    }

    postMortem.status = 'published';
    postMortem.publishedAt = new Date();

    // Generate action items for tracking
    await this.createActionItems(postMortem);

    return postMortem;
  }

  private selectTemplateForIncident(incident: Incident): PostMortemTemplate | undefined {
    for (const template of this.templates.values()) {
      if (this.matchesTemplate(incident, template)) {
        return template;
      }
    }
    
    // Return default template if no specific match
    return this.templates.get('default');
  }

  private matchesTemplate(incident: Incident, template: PostMortemTemplate): boolean {
    for (const trigger of template.triggers) {
      // Check severity
      if (!trigger.severity.includes(incident.severity)) {
        continue;
      }

      // Check duration if specified
      if (trigger.duration) {
        const incidentDuration = incident.resolvedAt 
          ? (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / 60000
          : 0;
        
        if (incidentDuration < trigger.duration) {
          continue;
        }
      }

      // Check services if specified
      if (trigger.services && trigger.services.length > 0) {
        const hasMatchingService = trigger.services.some(service => 
          incident.affectedServices.includes(service)
        );
        
        if (!hasMatchingService) {
          continue;
        }
      }

      // Check impacted users if specified
      if (trigger.impactedUsers && (incident.impactedUsers || 0) < trigger.impactedUsers) {
        continue;
      }

      // If we reach here, all conditions match
      return true;
    }

    return false;
  }

  private async gatherContext(incident: Incident): Promise<PostMortemContext> {
    return {
      incident,
      relatedIncidents: await this.findRelatedIncidents(incident),
      timelineEvents: incident.timeline,
      metrics: incident.metrics,
      artifacts: await this.gatherArtifacts(incident)
    };
  }

  private async findRelatedIncidents(incident: Incident): Promise<Incident[]> {
    // Find incidents that:
    // 1. Affected same services
    // 2. Had similar symptoms
    // 3. Occurred within the last 30 days
    
    // Mock implementation - in real system, query database
    return [];
  }

  private async gatherArtifacts(incident: Incident): Promise<PostMortemArtifact[]> {
    const artifacts: PostMortemArtifact[] = [];

    // Add monitoring graphs/dashboards
    artifacts.push({
      type: 'metric',
      title: 'Service Health Dashboard',
      url: `https://grafana.example.com/d/service-health?from=${incident.createdAt.getTime()}&to=${(incident.resolvedAt || new Date()).getTime()}`,
      timestamp: incident.createdAt
    });

    // Add relevant logs
    artifacts.push({
      type: 'log',
      title: 'Application Logs',
      url: `https://kibana.example.com/app/discover#/?_g=(time:(from:'${incident.createdAt.toISOString()}',to:'${(incident.resolvedAt || new Date()).toISOString()}'))`,
      timestamp: incident.createdAt
    });

    // Add communication channels
    if (incident.communicationChannels.length > 0) {
      const slackChannel = incident.communicationChannels.find(c => c.type === 'slack');
      if (slackChannel) {
        artifacts.push({
          type: 'document',
          title: 'Incident Communication Channel',
          url: `https://slack.com/channels/${slackChannel.identifier}`,
          timestamp: incident.createdAt
        });
      }
    }

    return artifacts;
  }

  private async buildPostMortem(incident: Incident, template: PostMortemTemplate, context: PostMortemContext): Promise<PostMortem> {
    const id = this.generatePostMortemId();

    // Build timeline from incident events
    const timeline = this.buildTimeline(context);

    // Analyze root cause
    const rootCause = await this.analyzeRootCause(context);

    // Analyze impact
    const impact = this.analyzeImpact(context);

    // Generate action items
    const actionItems = await this.generateActionItems(context);

    // Extract lessons learned
    const lessons = this.extractLessons(context);

    return {
      id,
      incidentId: incident.id,
      title: `Post-mortem: ${incident.title}`,
      summary: await this.generateSummary(context),
      timeline,
      rootCause,
      impact,
      actionItems,
      lessons,
      contributors: [incident.incidentCommander.id],
      reviewers: [],
      status: 'draft',
      createdAt: new Date()
    };
  }

  private buildTimeline(context: PostMortemContext): PostMortemTimelineItem[] {
    const timeline: PostMortemTimelineItem[] = [];

    // Add key events from incident timeline
    context.timelineEvents.forEach(event => {
      timeline.push({
        timestamp: event.timestamp,
        event: event.description,
        impact: this.describeImpact(event, context),
        source: event.user.name
      });
    });

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }

  private async analyzeRootCause(context: PostMortemContext): Promise<RootCauseAnalysis> {
    const incident = context.incident;

    // Primary cause analysis
    const primaryCause = incident.rootCause || 'Root cause analysis pending';

    // Contributing factors
    const contributingFactors = this.identifyContributingFactors(context);

    // 5 Whys analysis
    const whyAnalysis = await this.performFiveWhysAnalysis(context);

    // Categorize the root cause
    const category = this.categorizeRootCause(primaryCause);

    return {
      primaryCause,
      contributingFactors,
      whyAnalysis,
      category
    };
  }

  private analyzeImpact(context: PostMortemContext): ImpactAnalysis {
    const incident = context.incident;
    
    const duration = incident.resolvedAt 
      ? Math.floor((incident.resolvedAt.getTime() - incident.createdAt.getTime()) / 60000)
      : 0;

    return {
      usersAffected: incident.impactedUsers || 0,
      servicesAffected: incident.affectedServices,
      durationMinutes: duration,
      severityJustification: this.justifySeverity(incident),
      revenueImpact: this.estimateRevenueImpact(incident)
    };
  }

  private async generateActionItems(context: PostMortemContext): Promise<PostMortemActionItem[]> {
    const actionItems: PostMortemActionItem[] = [];

    // Detection improvements
    if (context.incident.metrics.detectionTime > 5) {
      actionItems.push({
        id: this.generateActionItemId(),
        title: 'Improve incident detection time',
        description: `Current detection time of ${context.incident.metrics.detectionTime} minutes exceeds target of 5 minutes`,
        assignee: context.incident.incidentCommander,
        status: 'pending',
        priority: 'high',
        type: 'investigation',
        category: 'detection',
        estimatedImpact: 'high',
        implementationCost: 'medium'
      });
    }

    // Response improvements
    if (context.incident.metrics.acknowledgmentTime > 10) {
      actionItems.push({
        id: this.generateActionItemId(),
        title: 'Reduce incident acknowledgment time',
        description: `Current acknowledgment time of ${context.incident.metrics.acknowledgmentTime} minutes exceeds SLA`,
        assignee: context.incident.incidentCommander,
        status: 'pending',
        priority: 'medium',
        type: 'mitigation',
        category: 'response',
        estimatedImpact: 'medium',
        implementationCost: 'low'
      });
    }

    // Prevention items based on root cause
    if (context.incident.rootCause) {
      actionItems.push({
        id: this.generateActionItemId(),
        title: 'Implement preventive measures',
        description: `Address root cause: ${context.incident.rootCause}`,
        assignee: context.incident.incidentCommander,
        status: 'pending',
        priority: context.incident.severity === 'critical' ? 'critical' : 'high',
        type: 'investigation',
        category: 'prevention',
        estimatedImpact: 'high',
        implementationCost: 'high'
      });
    }

    return actionItems;
  }

  private extractLessons(context: PostMortemContext): string[] {
    const lessons: string[] = [];

    // Detection lessons
    if (context.incident.metrics.detectionTime > 5) {
      lessons.push('Our monitoring did not detect the issue quickly enough. We need better alerting on key metrics.');
    }

    // Response lessons
    if (context.incident.metrics.escalations > 1) {
      lessons.push('The incident required multiple escalations, indicating our initial response was insufficient.');
    }

    // Communication lessons
    if (context.incident.communicationChannels.length === 0) {
      lessons.push('Dedicated communication channels should be established for all high-severity incidents.');
    }

    // Runbook lessons
    if (context.incident.metrics.runbooksExecuted === 0 && context.incident.severity === 'critical') {
      lessons.push('No runbooks were executed during this critical incident. We should develop and automate more response procedures.');
    }

    // SLA lessons
    if (context.incident.slaStatus === 'breached') {
      lessons.push('SLA was breached. We need to review our SLA targets and response capabilities.');
    }

    return lessons;
  }

  private async generateSummary(context: PostMortemContext): Promise<string> {
    const incident = context.incident;
    const duration = incident.resolvedAt 
      ? Math.floor((incident.resolvedAt.getTime() - incident.createdAt.getTime()) / 60000)
      : 0;

    let summary = `On ${incident.createdAt.toLocaleDateString()}, we experienced a ${incident.severity} incident affecting ${incident.affectedServices.join(', ')}. `;
    
    if (incident.impactedUsers && incident.impactedUsers > 0) {
      summary += `Approximately ${incident.impactedUsers.toLocaleString()} users were impacted. `;
    }

    summary += `The incident lasted ${duration} minutes and was resolved by ${incident.incidentCommander.name}. `;

    if (incident.rootCause) {
      summary += `The root cause was identified as: ${incident.rootCause}. `;
    }

    if (incident.resolution) {
      summary += `Resolution: ${incident.resolution}`;
    }

    return summary;
  }

  private identifyContributingFactors(context: PostMortemContext): string[] {
    const factors: string[] = [];

    // Analyze timeline for patterns
    const incident = context.incident;

    if (incident.metrics.detectionTime > 10) {
      factors.push('Delayed detection due to insufficient monitoring coverage');
    }

    if (incident.metrics.escalations > 2) {
      factors.push('Multiple escalations indicate unclear escalation procedures');
    }

    if (incident.team.length < 2 && incident.severity === 'critical') {
      factors.push('Insufficient team size for critical incident response');
    }

    // Check for weekend/holiday timing
    const dayOfWeek = incident.createdAt.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      factors.push('Incident occurred during weekend when response team availability was reduced');
    }

    return factors;
  }

  private async performFiveWhysAnalysis(context: PostMortemContext): Promise<string[]> {
    const whys: string[] = [];
    const incident = context.incident;

    // This would typically be done interactively, but we'll generate some based on the incident
    whys.push(`Why did the incident occur? ${incident.description}`);
    
    if (incident.rootCause) {
      whys.push(`Why did ${incident.rootCause.toLowerCase()}? [Analysis needed]`);
      whys.push('Why was this condition not prevented? [Analysis needed]');
      whys.push('Why was this not detected earlier? [Analysis needed]');
      whys.push('Why do we not have safeguards for this? [Analysis needed]');
    }

    return whys;
  }

  private categorizeRootCause(cause: string): RootCauseAnalysis['category'] {
    const lowerCause = cause.toLowerCase();
    
    if (lowerCause.includes('human') || lowerCause.includes('manual') || lowerCause.includes('mistake')) {
      return 'human_error';
    } else if (lowerCause.includes('hardware') || lowerCause.includes('network') || lowerCause.includes('disk')) {
      return 'system_failure';
    } else if (lowerCause.includes('process') || lowerCause.includes('procedure') || lowerCause.includes('workflow')) {
      return 'process_gap';
    } else if (lowerCause.includes('third-party') || lowerCause.includes('vendor') || lowerCause.includes('external')) {
      return 'external_dependency';
    } else {
      return 'unknown';
    }
  }

  private justifySeverity(incident: Incident): string {
    switch (incident.severity) {
      case 'critical':
        return 'Service completely unavailable, affecting all users';
      case 'high':
        return 'Major functionality impacted, affecting significant number of users';
      case 'medium':
        return 'Partial functionality impacted, affecting some users';
      case 'low':
        return 'Minor impact with workarounds available';
      default:
        return 'Impact assessment needed';
    }
  }

  private estimateRevenueImpact(incident: Incident): number | undefined {
    if (!incident.impactedUsers || !incident.resolvedAt) return undefined;

    // Rough estimation: $0.10 per affected user per hour
    const durationHours = (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / (1000 * 60 * 60);
    return Math.round(incident.impactedUsers * 0.10 * durationHours);
  }

  private describeImpact(event: any, context: PostMortemContext): string {
    switch (event.type) {
      case 'created':
        return 'Service disruption began';
      case 'status_change':
        if (event.metadata?.to === 'resolved') {
          return 'Service restored';
        }
        return 'Investigation progressed';
      case 'escalation':
        return 'Additional resources engaged';
      case 'runbook_executed':
        return 'Automated remediation attempted';
      default:
        return 'Status updated';
    }
  }

  private async createActionItems(postMortem: PostMortem): Promise<void> {
    // In a real system, this would create tickets in the project management system
    console.log(`Created ${postMortem.actionItems.length} action items for post-mortem ${postMortem.id}`);
  }

  private generatePostMortemId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6);
    return `pm-${date}-${random}`;
  }

  private generateActionItemId(): string {
    return 'action-' + Math.random().toString(36).substr(2, 12);
  }

  private initializeTemplates(): void {
    // Default post-mortem template
    this.templates.set('default', {
      id: 'default',
      name: 'Standard Post-mortem',
      description: 'Standard template for most incidents',
      sections: [
        {
          id: 'summary',
          title: 'Executive Summary',
          template: '{{summary}}',
          required: true,
          order: 1
        },
        {
          id: 'timeline',
          title: 'Timeline',
          template: '{{timeline}}',
          required: true,
          order: 2
        },
        {
          id: 'root_cause',
          title: 'Root Cause Analysis',
          template: '{{root_cause}}',
          required: true,
          order: 3
        },
        {
          id: 'impact',
          title: 'Impact Assessment',
          template: '{{impact}}',
          required: true,
          order: 4
        },
        {
          id: 'lessons',
          title: 'Lessons Learned',
          template: '{{lessons}}',
          required: true,
          order: 5
        },
        {
          id: 'actions',
          title: 'Action Items',
          template: '{{actions}}',
          required: true,
          order: 6
        }
      ],
      triggers: [
        {
          severity: ['critical', 'high', 'medium', 'low']
        }
      ]
    });

    // Security incident template
    this.templates.set('security', {
      id: 'security',
      name: 'Security Incident Post-mortem',
      description: 'Template for security-related incidents',
      sections: [
        {
          id: 'summary',
          title: 'Executive Summary',
          template: '{{summary}}',
          required: true,
          order: 1
        },
        {
          id: 'security_impact',
          title: 'Security Impact',
          template: 'Data affected: {{data_affected}}\nSecurity measures bypassed: {{security_bypassed}}\nCompliance implications: {{compliance_impact}}',
          required: true,
          order: 2
        },
        {
          id: 'timeline',
          title: 'Incident Timeline',
          template: '{{timeline}}',
          required: true,
          order: 3
        },
        {
          id: 'root_cause',
          title: 'Root Cause Analysis',
          template: '{{root_cause}}',
          required: true,
          order: 4
        },
        {
          id: 'containment',
          title: 'Containment Actions',
          template: '{{containment_actions}}',
          required: true,
          order: 5
        },
        {
          id: 'lessons',
          title: 'Lessons Learned',
          template: '{{lessons}}',
          required: true,
          order: 6
        },
        {
          id: 'actions',
          title: 'Remediation Actions',
          template: '{{actions}}',
          required: true,
          order: 7
        }
      ],
      triggers: [
        {
          severity: ['critical', 'high'],
          services: ['auth', 'security', 'payment']
        }
      ]
    });

    // Data loss incident template
    this.templates.set('data_loss', {
      id: 'data_loss',
      name: 'Data Loss Post-mortem',
      description: 'Template for data loss incidents',
      sections: [
        {
          id: 'summary',
          title: 'Executive Summary',
          template: '{{summary}}',
          required: true,
          order: 1
        },
        {
          id: 'data_impact',
          title: 'Data Impact Assessment',
          template: 'Data lost: {{data_lost}}\nRecovery status: {{recovery_status}}\nCustomers affected: {{customers_affected}}',
          required: true,
          order: 2
        },
        {
          id: 'timeline',
          title: 'Timeline',
          template: '{{timeline}}',
          required: true,
          order: 3
        },
        {
          id: 'recovery_process',
          title: 'Recovery Process',
          template: '{{recovery_process}}',
          required: true,
          order: 4
        },
        {
          id: 'root_cause',
          title: 'Root Cause Analysis',
          template: '{{root_cause}}',
          required: true,
          order: 5
        },
        {
          id: 'prevention',
          title: 'Prevention Measures',
          template: '{{prevention_measures}}',
          required: true,
          order: 6
        },
        {
          id: 'actions',
          title: 'Action Items',
          template: '{{actions}}',
          required: true,
          order: 7
        }
      ],
      triggers: [
        {
          severity: ['critical'],
          services: ['database', 'storage', 'backup']
        }
      ]
    });

    console.log('Initialized post-mortem templates');
  }

  // Public methods for template and post-mortem management
  public getTemplates(): PostMortemTemplate[] {
    return Array.from(this.templates.values());
  }

  public getPostMortem(id: string): PostMortem | undefined {
    return this.postMortems.get(id);
  }

  public getPostMortems(): PostMortem[] {
    return Array.from(this.postMortems.values());
  }

  public addTemplate(template: PostMortemTemplate): void {
    this.templates.set(template.id, template);
  }

  public removeTemplate(templateId: string): void {
    this.templates.delete(templateId);
  }
}