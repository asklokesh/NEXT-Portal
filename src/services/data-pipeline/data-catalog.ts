import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface DataAsset {
  id: string;
  name: string;
  type: 'table' | 'view' | 'file' | 'stream' | 'api' | 'model';
  description: string;
  location: {
    source: string;
    path: string;
    format?: string;
  };
  schema: {
    version: string;
    fields: DataField[];
    primaryKeys: string[];
    indexes: Index[];
  };
  metadata: {
    size: number;
    recordCount: number;
    createdAt: Date;
    updatedAt: Date;
    lastAccessed: Date;
    tags: string[];
    owner: string;
    steward: string;
  };
  quality: DataQualityMetrics;
  lineage: DataLineage;
  governance: GovernanceInfo;
  usage: UsageMetrics;
}

interface DataField {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  constraints?: string[];
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  personalData?: {
    isPII: boolean;
    category?: string;
    retention?: number;
  };
}

interface Index {
  name: string;
  fields: string[];
  type: 'primary' | 'unique' | 'index' | 'composite';
}

interface DataQualityMetrics {
  score: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  validity: number;
  uniqueness: number;
  freshness: number;
  issues: QualityIssue[];
  lastAssessed: Date;
}

interface QualityIssue {
  type: 'missing' | 'invalid' | 'duplicate' | 'inconsistent' | 'stale';
  field: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface DataLineage {
  upstream: LineageNode[];
  downstream: LineageNode[];
  transformations: Transformation[];
  impact: ImpactAnalysis;
}

interface LineageNode {
  assetId: string;
  name: string;
  type: string;
  relationship: 'source' | 'derived' | 'referenced';
}

interface Transformation {
  id: string;
  type: 'filter' | 'aggregate' | 'join' | 'transform' | 'enrich';
  description: string;
  logic: string;
  impact: string[];
}

interface ImpactAnalysis {
  affectedAssets: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedDowntime?: number;
  businessImpact: string;
}

interface GovernanceInfo {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  compliance: ComplianceInfo[];
  accessControl: {
    readers: string[];
    writers: string[];
    admins: string[];
  };
  retention: {
    policy: string;
    duration: number;
    action: 'delete' | 'archive' | 'anonymize';
  };
  encryption: {
    atRest: boolean;
    inTransit: boolean;
    keyRotation: number;
  };
}

interface ComplianceInfo {
  regulation: string;
  status: 'compliant' | 'non-compliant' | 'needs-review';
  requirements: string[];
  evidence: string[];
  lastReview: Date;
  nextReview: Date;
}

interface UsageMetrics {
  accessCount: number;
  uniqueUsers: number;
  popularQueries: QueryPattern[];
  performanceMetrics: {
    avgQueryTime: number;
    slowQueries: number;
    errorRate: number;
  };
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
}

interface QueryPattern {
  pattern: string;
  count: number;
  avgDuration: number;
  users: string[];
}

export class DataCatalog extends EventEmitter {
  private assets: Map<string, DataAsset> = new Map();
  private schemas: Map<string, any> = new Map();
  private qualityRules: Map<string, any[]> = new Map();
  private classificationModel: any = null;

  constructor() {
    super();
    this.initializeQualityRules();
    this.startPeriodicTasks();
  }

  private initializeQualityRules() {
    this.qualityRules.set('completeness', [
      { field: '*', rule: 'not_null', threshold: 0.95 },
      { field: 'email', rule: 'email_format', threshold: 1.0 },
      { field: 'phone', rule: 'phone_format', threshold: 0.9 }
    ]);

    this.qualityRules.set('validity', [
      { field: 'date_*', rule: 'valid_date', threshold: 1.0 },
      { field: 'price', rule: 'positive_number', threshold: 1.0 },
      { field: 'status', rule: 'enum_values', values: ['active', 'inactive'], threshold: 1.0 }
    ]);

    this.qualityRules.set('uniqueness', [
      { field: 'id', rule: 'unique', threshold: 1.0 },
      { field: 'email', rule: 'unique', threshold: 0.99 }
    ]);
  }

  private startPeriodicTasks() {
    setInterval(() => this.discoverAssets(), 4 * 60 * 60 * 1000);
    setInterval(() => this.assessQuality(), 2 * 60 * 60 * 1000);
    setInterval(() => this.updateLineage(), 6 * 60 * 60 * 1000);
    setInterval(() => this.analyzeUsage(), 60 * 60 * 1000);
    setInterval(() => this.checkCompliance(), 24 * 60 * 60 * 1000);
  }

  async registerAsset(asset: Omit<DataAsset, 'id'>): Promise<DataAsset> {
    const newAsset: DataAsset = {
      ...asset,
      id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    await this.validateAsset(newAsset);
    await this.classifyData(newAsset);
    await this.assessInitialQuality(newAsset);

    this.assets.set(newAsset.id, newAsset);
    await this.persistAsset(newAsset);

    this.emit('asset-registered', newAsset);
    return newAsset;
  }

  private async validateAsset(asset: DataAsset): Promise<void> {
    const errors = [];

    if (!asset.name) {
      errors.push('Asset name is required');
    }

    if (!asset.location.source || !asset.location.path) {
      errors.push('Asset location is required');
    }

    if (!asset.schema.fields || asset.schema.fields.length === 0) {
      errors.push('Asset must have schema fields');
    }

    if (errors.length > 0) {
      throw new Error(`Asset validation failed: ${errors.join(', ')}`);
    }
  }

  private async classifyData(asset: DataAsset): Promise<void> {
    for (const field of asset.schema.fields) {
      field.classification = await this.classifyField(field);
      field.personalData = await this.detectPersonalData(field);
    }

    asset.governance.classification = this.determineAssetClassification(asset);
  }

  private async classifyField(field: DataField): Promise<'public' | 'internal' | 'confidential' | 'restricted'> {
    const sensitivePatterns = {
      restricted: ['ssn', 'passport', 'license', 'tax_id'],
      confidential: ['salary', 'password', 'secret', 'key'],
      internal: ['employee_id', 'internal', 'private'],
      public: []
    };

    const fieldName = field.name.toLowerCase();

    for (const [classification, patterns] of Object.entries(sensitivePatterns)) {
      if (patterns.some(pattern => fieldName.includes(pattern))) {
        return classification as any;
      }
    }

    return 'public';
  }

  private async detectPersonalData(field: DataField): Promise<any> {
    const piiPatterns = {
      name: ['first_name', 'last_name', 'full_name', 'display_name'],
      email: ['email', 'email_address', 'contact_email'],
      phone: ['phone', 'telephone', 'mobile', 'cell'],
      address: ['address', 'street', 'city', 'zip', 'postal'],
      identifier: ['ssn', 'passport', 'license', 'id_number'],
      financial: ['credit_card', 'bank_account', 'routing']
    };

    const fieldName = field.name.toLowerCase();

    for (const [category, patterns] of Object.entries(piiPatterns)) {
      if (patterns.some(pattern => fieldName.includes(pattern))) {
        return {
          isPII: true,
          category,
          retention: this.getRetentionPeriod(category)
        };
      }
    }

    return { isPII: false };
  }

  private getRetentionPeriod(category: string): number {
    const retentionPeriods: Record<string, number> = {
      name: 2555,
      email: 2555,
      phone: 1825,
      address: 2555,
      identifier: 3650,
      financial: 2555
    };

    return retentionPeriods[category] || 365;
  }

  private determineAssetClassification(asset: DataAsset): 'public' | 'internal' | 'confidential' | 'restricted' {
    const classifications = asset.schema.fields.map(f => f.classification);
    
    if (classifications.includes('restricted')) return 'restricted';
    if (classifications.includes('confidential')) return 'confidential';
    if (classifications.includes('internal')) return 'internal';
    return 'public';
  }

  private async assessInitialQuality(asset: DataAsset): Promise<void> {
    asset.quality = {
      score: 0,
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      validity: 0,
      uniqueness: 0,
      freshness: 0,
      issues: [],
      lastAssessed: new Date()
    };

    await this.assessAssetQuality(asset);
  }

  async discoverAssets(): Promise<void> {
    const sources = await this.getDataSources();
    
    for (const source of sources) {
      const discoveredAssets = await this.discoverFromSource(source);
      
      for (const discovered of discoveredAssets) {
        const existing = Array.from(this.assets.values())
          .find(a => a.location.source === discovered.location.source && 
                    a.location.path === discovered.location.path);

        if (!existing) {
          await this.registerAsset(discovered);
        } else {
          await this.updateAssetMetadata(existing.id, discovered);
        }
      }
    }

    this.emit('discovery-completed', { discovered: sources.length });
  }

  private async getDataSources(): Promise<any[]> {
    return [
      { type: 'database', connection: 'postgresql://...', name: 'main-db' },
      { type: 'database', connection: 'mongodb://...', name: 'analytics-db' },
      { type: 'file', path: '/data/warehouse', name: 'data-warehouse' },
      { type: 'api', endpoint: 'https://api.example.com', name: 'external-api' }
    ];
  }

  private async discoverFromSource(source: any): Promise<Partial<DataAsset>[]> {
    const discovered: Partial<DataAsset>[] = [];

    switch (source.type) {
      case 'database':
        discovered.push(...await this.discoverDatabaseAssets(source));
        break;
      case 'file':
        discovered.push(...await this.discoverFileAssets(source));
        break;
      case 'api':
        discovered.push(...await this.discoverAPIAssets(source));
        break;
    }

    return discovered;
  }

  private async discoverDatabaseAssets(source: any): Promise<Partial<DataAsset>[]> {
    const mockTables = [
      {
        name: 'users',
        schema: {
          version: '1.0',
          fields: [
            { name: 'id', type: 'integer', nullable: false },
            { name: 'email', type: 'varchar', nullable: false },
            { name: 'first_name', type: 'varchar', nullable: true },
            { name: 'last_name', type: 'varchar', nullable: true },
            { name: 'created_at', type: 'timestamp', nullable: false }
          ],
          primaryKeys: ['id'],
          indexes: [{ name: 'idx_email', fields: ['email'], type: 'unique' as const }]
        },
        metadata: {
          size: 1024 * 1024,
          recordCount: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          tags: ['user-data', 'core'],
          owner: 'engineering',
          steward: 'data-team'
        }
      }
    ];

    return mockTables.map(table => ({
      name: table.name,
      type: 'table' as const,
      description: `Database table: ${table.name}`,
      location: {
        source: source.name,
        path: `${source.name}.${table.name}`,
        format: 'sql'
      },
      schema: table.schema,
      metadata: table.metadata,
      lineage: {
        upstream: [],
        downstream: [],
        transformations: [],
        impact: {
          affectedAssets: [],
          riskLevel: 'low' as const,
          businessImpact: 'Low impact'
        }
      },
      governance: {
        classification: 'internal' as const,
        compliance: [],
        accessControl: {
          readers: ['data-analysts', 'engineers'],
          writers: ['engineers'],
          admins: ['data-admins']
        },
        retention: {
          policy: 'standard',
          duration: 2555,
          action: 'archive' as const
        },
        encryption: {
          atRest: true,
          inTransit: true,
          keyRotation: 90
        }
      },
      usage: {
        accessCount: 0,
        uniqueUsers: 0,
        popularQueries: [],
        performanceMetrics: {
          avgQueryTime: 0,
          slowQueries: 0,
          errorRate: 0
        },
        trends: {
          daily: [],
          weekly: [],
          monthly: []
        }
      }
    }));
  }

  private async discoverFileAssets(source: any): Promise<Partial<DataAsset>[]> {
    return [];
  }

  private async discoverAPIAssets(source: any): Promise<Partial<DataAsset>[]> {
    return [];
  }

  private async updateAssetMetadata(assetId: string, updates: Partial<DataAsset>): Promise<void> {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    Object.assign(asset, {
      ...updates,
      metadata: {
        ...asset.metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    });

    await this.persistAsset(asset);
    this.emit('asset-updated', asset);
  }

  async assessQuality(): Promise<void> {
    for (const asset of this.assets.values()) {
      await this.assessAssetQuality(asset);
    }

    this.emit('quality-assessment-completed');
  }

  private async assessAssetQuality(asset: DataAsset): Promise<void> {
    const sampleData = await this.getSampleData(asset);
    const issues: QualityIssue[] = [];

    const completeness = this.assessCompleteness(sampleData, asset);
    const accuracy = this.assessAccuracy(sampleData, asset);
    const consistency = this.assessConsistency(sampleData, asset);
    const validity = this.assessValidity(sampleData, asset);
    const uniqueness = this.assessUniqueness(sampleData, asset);
    const freshness = this.assessFreshness(asset);

    issues.push(...completeness.issues);
    issues.push(...accuracy.issues);
    issues.push(...consistency.issues);
    issues.push(...validity.issues);
    issues.push(...uniqueness.issues);

    asset.quality = {
      score: (completeness.score + accuracy.score + consistency.score + 
              validity.score + uniqueness.score + freshness.score) / 6,
      completeness: completeness.score,
      accuracy: accuracy.score,
      consistency: consistency.score,
      validity: validity.score,
      uniqueness: uniqueness.score,
      freshness: freshness.score,
      issues,
      lastAssessed: new Date()
    };

    await this.persistAsset(asset);
    this.emit('quality-assessed', { assetId: asset.id, quality: asset.quality });
  }

  private async getSampleData(asset: DataAsset): Promise<any[]> {
    return Array(100).fill(null).map(() => ({
      id: Math.floor(Math.random() * 10000),
      email: Math.random() > 0.1 ? 'user@example.com' : null,
      first_name: Math.random() > 0.05 ? 'John' : null,
      last_name: Math.random() > 0.05 ? 'Doe' : null,
      created_at: new Date()
    }));
  }

  private assessCompleteness(data: any[], asset: DataAsset): { score: number; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];
    let totalScore = 0;

    for (const field of asset.schema.fields) {
      const nullCount = data.filter(row => row[field.name] == null).length;
      const completeness = 1 - (nullCount / data.length);
      
      totalScore += completeness;

      if (completeness < 0.9) {
        issues.push({
          type: 'missing',
          field: field.name,
          count: nullCount,
          severity: completeness < 0.5 ? 'critical' : completeness < 0.8 ? 'high' : 'medium',
          description: `${field.name} has ${nullCount} missing values (${(100 - completeness * 100).toFixed(1)}%)`
        });
      }
    }

    return {
      score: totalScore / asset.schema.fields.length,
      issues
    };
  }

  private assessAccuracy(data: any[], asset: DataAsset): { score: number; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];
    let totalScore = 1;

    return { score: totalScore, issues };
  }

  private assessConsistency(data: any[], asset: DataAsset): { score: number; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];
    let totalScore = 1;

    return { score: totalScore, issues };
  }

  private assessValidity(data: any[], asset: DataAsset): { score: number; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];
    let totalScore = 0;

    for (const field of asset.schema.fields) {
      let validCount = 0;
      
      for (const row of data) {
        if (this.isValidValue(row[field.name], field.type)) {
          validCount++;
        }
      }

      const validity = validCount / data.length;
      totalScore += validity;

      if (validity < 0.95) {
        issues.push({
          type: 'invalid',
          field: field.name,
          count: data.length - validCount,
          severity: validity < 0.8 ? 'high' : 'medium',
          description: `${field.name} has invalid values`
        });
      }
    }

    return {
      score: totalScore / asset.schema.fields.length,
      issues
    };
  }

  private isValidValue(value: any, type: string): boolean {
    if (value == null) return true;

    switch (type) {
      case 'integer':
        return Number.isInteger(value);
      case 'varchar':
        return typeof value === 'string';
      case 'timestamp':
        return value instanceof Date || !isNaN(Date.parse(value));
      default:
        return true;
    }
  }

  private assessUniqueness(data: any[], asset: DataAsset): { score: number; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];
    let totalScore = 0;

    for (const field of asset.schema.fields) {
      const values = data.map(row => row[field.name]);
      const uniqueValues = new Set(values);
      const uniqueness = uniqueValues.size / values.length;
      
      totalScore += uniqueness;

      if (field.name.includes('id') && uniqueness < 1) {
        issues.push({
          type: 'duplicate',
          field: field.name,
          count: values.length - uniqueValues.size,
          severity: 'high',
          description: `${field.name} has duplicate values`
        });
      }
    }

    return {
      score: totalScore / asset.schema.fields.length,
      issues
    };
  }

  private assessFreshness(asset: DataAsset): { score: number } {
    const now = Date.now();
    const lastUpdated = asset.metadata.updatedAt.getTime();
    const daysSinceUpdate = (now - lastUpdated) / (24 * 60 * 60 * 1000);
    
    let freshnessScore = 1;
    if (daysSinceUpdate > 1) {
      freshnessScore = Math.max(0, 1 - (daysSinceUpdate / 30));
    }

    return { score: freshnessScore };
  }

  async updateLineage(): Promise<void> {
    for (const asset of this.assets.values()) {
      await this.traceLineage(asset);
    }

    this.emit('lineage-updated');
  }

  private async traceLineage(asset: DataAsset): Promise<void> {
    const upstream = await this.findUpstreamAssets(asset);
    const downstream = await this.findDownstreamAssets(asset);
    const transformations = await this.identifyTransformations(asset);

    asset.lineage = {
      upstream,
      downstream,
      transformations,
      impact: this.calculateImpactAnalysis(asset, downstream)
    };

    await this.persistAsset(asset);
  }

  private async findUpstreamAssets(asset: DataAsset): Promise<LineageNode[]> {
    return [];
  }

  private async findDownstreamAssets(asset: DataAsset): Promise<LineageNode[]> {
    return [];
  }

  private async identifyTransformations(asset: DataAsset): Promise<Transformation[]> {
    return [];
  }

  private calculateImpactAnalysis(asset: DataAsset, downstream: LineageNode[]): ImpactAnalysis {
    return {
      affectedAssets: downstream.map(d => d.assetId),
      riskLevel: downstream.length > 5 ? 'high' : downstream.length > 2 ? 'medium' : 'low',
      businessImpact: `Changes to ${asset.name} may affect ${downstream.length} downstream assets`
    };
  }

  async analyzeUsage(): Promise<void> {
    for (const asset of this.assets.values()) {
      await this.collectUsageMetrics(asset);
    }

    this.emit('usage-analyzed');
  }

  private async collectUsageMetrics(asset: DataAsset): Promise<void> {
    const queryLogs = await this.getQueryLogs(asset);
    
    asset.usage = {
      accessCount: queryLogs.length,
      uniqueUsers: new Set(queryLogs.map(q => q.user)).size,
      popularQueries: this.identifyPopularQueries(queryLogs),
      performanceMetrics: this.calculatePerformanceMetrics(queryLogs),
      trends: this.calculateUsageTrends(queryLogs)
    };

    await this.persistAsset(asset);
  }

  private async getQueryLogs(asset: DataAsset): Promise<any[]> {
    return [];
  }

  private identifyPopularQueries(logs: any[]): QueryPattern[] {
    return [];
  }

  private calculatePerformanceMetrics(logs: any[]): any {
    return {
      avgQueryTime: 0,
      slowQueries: 0,
      errorRate: 0
    };
  }

  private calculateUsageTrends(logs: any[]): any {
    return {
      daily: [],
      weekly: [],
      monthly: []
    };
  }

  async checkCompliance(): Promise<void> {
    for (const asset of this.assets.values()) {
      await this.assessCompliance(asset);
    }

    this.emit('compliance-checked');
  }

  private async assessCompliance(asset: DataAsset): Promise<void> {
    const regulations = ['GDPR', 'CCPA', 'HIPAA', 'SOX'];
    
    for (const regulation of regulations) {
      const complianceCheck = await this.checkRegulationCompliance(asset, regulation);
      
      const existing = asset.governance.compliance.find(c => c.regulation === regulation);
      if (existing) {
        Object.assign(existing, complianceCheck);
      } else {
        asset.governance.compliance.push(complianceCheck);
      }
    }

    await this.persistAsset(asset);
  }

  private async checkRegulationCompliance(asset: DataAsset, regulation: string): Promise<ComplianceInfo> {
    const hasPII = asset.schema.fields.some(f => f.personalData?.isPII);
    
    return {
      regulation,
      status: hasPII ? 'needs-review' : 'compliant',
      requirements: this.getRegulationRequirements(regulation),
      evidence: [],
      lastReview: new Date(),
      nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    };
  }

  private getRegulationRequirements(regulation: string): string[] {
    const requirements: Record<string, string[]> = {
      GDPR: ['Data minimization', 'Consent management', 'Right to erasure', 'Data portability'],
      CCPA: ['Consumer rights', 'Data deletion', 'Opt-out mechanisms'],
      HIPAA: ['Data encryption', 'Access controls', 'Audit logging'],
      SOX: ['Data integrity', 'Access controls', 'Change management']
    };

    return requirements[regulation] || [];
  }

  async searchAssets(query: {
    text?: string;
    type?: string;
    classification?: string;
    owner?: string;
    tags?: string[];
  }): Promise<DataAsset[]> {
    let results = Array.from(this.assets.values());

    if (query.text) {
      const searchTerm = query.text.toLowerCase();
      results = results.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm) ||
        asset.description.toLowerCase().includes(searchTerm) ||
        asset.schema.fields.some(f => f.name.toLowerCase().includes(searchTerm))
      );
    }

    if (query.type) {
      results = results.filter(asset => asset.type === query.type);
    }

    if (query.classification) {
      results = results.filter(asset => asset.governance.classification === query.classification);
    }

    if (query.owner) {
      results = results.filter(asset => asset.metadata.owner === query.owner);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(asset =>
        query.tags!.some(tag => asset.metadata.tags.includes(tag))
      );
    }

    return results;
  }

  async getAssetMetrics(): Promise<any> {
    const assets = Array.from(this.assets.values());
    
    return {
      total: assets.length,
      byType: this.groupBy(assets, 'type'),
      byClassification: this.groupBy(assets, a => a.governance.classification),
      qualityDistribution: this.getQualityDistribution(assets),
      complianceStatus: this.getComplianceStatus(assets),
      topOwners: this.getTopOwners(assets),
      recentAssets: assets
        .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
        .slice(0, 10)
    };
  }

  private groupBy<T>(array: T[], key: string | ((item: T) => string)): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const item of array) {
      const groupKey = typeof key === 'string' ? (item as any)[key] : key(item);
      result[groupKey] = (result[groupKey] || 0) + 1;
    }
    
    return result;
  }

  private getQualityDistribution(assets: DataAsset[]): any {
    const scores = assets.map(a => a.quality.score);
    return {
      excellent: scores.filter(s => s >= 0.9).length,
      good: scores.filter(s => s >= 0.7 && s < 0.9).length,
      fair: scores.filter(s => s >= 0.5 && s < 0.7).length,
      poor: scores.filter(s => s < 0.5).length
    };
  }

  private getComplianceStatus(assets: DataAsset[]): any {
    let compliant = 0;
    let needsReview = 0;
    let nonCompliant = 0;

    for (const asset of assets) {
      const statuses = asset.governance.compliance.map(c => c.status);
      if (statuses.includes('non-compliant')) {
        nonCompliant++;
      } else if (statuses.includes('needs-review')) {
        needsReview++;
      } else {
        compliant++;
      }
    }

    return { compliant, needsReview, nonCompliant };
  }

  private getTopOwners(assets: DataAsset[]): any[] {
    const ownerCounts = this.groupBy(assets, 'metadata.owner');
    
    return Object.entries(ownerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([owner, count]) => ({ owner, count }));
  }

  private async persistAsset(asset: DataAsset): Promise<void> {
    await prisma.dataAsset.upsert({
      where: { id: asset.id },
      update: {
        name: asset.name,
        type: asset.type,
        description: asset.description,
        location: asset.location,
        schema: asset.schema,
        metadata: asset.metadata,
        quality: asset.quality,
        lineage: asset.lineage,
        governance: asset.governance,
        usage: asset.usage
      },
      create: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        description: asset.description,
        location: asset.location,
        schema: asset.schema,
        metadata: asset.metadata,
        quality: asset.quality,
        lineage: asset.lineage,
        governance: asset.governance,
        usage: asset.usage
      }
    });
  }
}