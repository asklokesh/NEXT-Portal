/**
 * TechDocs v2 Core Types
 * Revolutionary documentation system types
 */

import { ReactNode } from 'react';

// Base Document Structure
export interface TechDocument {
  id: string;
  title: string;
  slug: string;
  content: DocumentContent;
  metadata: DocumentMetadata;
  version: DocumentVersion;
  analytics: DocumentAnalytics;
  collaboration: CollaborationState;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Document Content with Rich Blocks
export interface DocumentContent {
  format: DocumentFormat;
  blocks: DocumentBlock[];
  rawContent?: string;
  compiledHtml?: string;
  searchIndex?: SearchIndex;
}

export type DocumentFormat = 
  | 'markdown'
  | 'mdx'
  | 'jupyter'
  | 'notion'
  | 'html'
  | 'asciidoc'
  | 'restructuredtext';

// Interactive Document Blocks
export interface DocumentBlock {
  id: string;
  type: BlockType;
  content: any;
  metadata: BlockMetadata;
  position: BlockPosition;
  dependencies?: string[];
  interactive?: InteractiveConfig;
  validation?: ValidationConfig;
}

export type BlockType =
  | 'text'
  | 'code'
  | 'diagram'
  | 'chart'
  | 'image'
  | 'video'
  | 'table'
  | 'form'
  | 'api-explorer'
  | 'live-demo'
  | 'tutorial'
  | 'quiz'
  | 'feedback'
  | 'embed';

export interface BlockMetadata {
  title?: string;
  description?: string;
  tags: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime?: number;
  lastModified: Date;
  author: string;
}

export interface BlockPosition {
  index: number;
  section?: string;
  subsection?: string;
  depth: number;
}

// Interactive Code Execution
export interface InteractiveConfig {
  executable: boolean;
  language: ProgrammingLanguage;
  runtime: RuntimeConfig;
  sandbox: SandboxConfig;
  sharing: SharingConfig;
}

export type ProgrammingLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'sql'
  | 'bash'
  | 'docker'
  | 'kubernetes';

export interface RuntimeConfig {
  timeout: number;
  memoryLimit: number;
  networkAccess: boolean;
  fileSystemAccess: 'none' | 'readonly' | 'sandbox';
  environment: Record<string, string>;
}

export interface SandboxConfig {
  isolated: boolean;
  containerImage?: string;
  preInstalledPackages: string[];
  allowedDomains: string[];
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  cpu: string; // e.g., '100m'
  memory: string; // e.g., '256Mi'
  storage: string; // e.g., '1Gi'
  executionTime: number; // seconds
}

// Real-time Collaboration
export interface CollaborationState {
  activeUsers: CollaborativeUser[];
  recentChanges: ChangeEvent[];
  cursors: UserCursor[];
  comments: Comment[];
  suggestions: Suggestion[];
  lockStatus: LockStatus;
}

export interface CollaborativeUser {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isActive: boolean;
  lastSeen: Date;
  permissions: CollaborationPermissions;
}

export interface ChangeEvent {
  id: string;
  userId: string;
  timestamp: Date;
  operation: OperationType;
  blockId: string;
  changes: TextOperation[];
  metadata: ChangeMetadata;
}

export type OperationType = 'insert' | 'delete' | 'format' | 'move' | 'replace';

export interface TextOperation {
  retain?: number;
  insert?: string;
  delete?: number;
  attributes?: Record<string, any>;
}

export interface UserCursor {
  userId: string;
  blockId: string;
  position: CursorPosition;
  selection?: TextSelection;
}

export interface CursorPosition {
  line: number;
  column: number;
  offset: number;
}

export interface TextSelection {
  start: CursorPosition;
  end: CursorPosition;
}

// AI-Powered Features
export interface AIConfiguration {
  contentGeneration: ContentGenerationConfig;
  smartSuggestions: SmartSuggestionsConfig;
  autoComplete: AutoCompleteConfig;
  qualityAnalysis: QualityAnalysisConfig;
}

export interface ContentGenerationConfig {
  enabled: boolean;
  model: string;
  creativity: number; // 0-1
  context: ContextConfig;
  templates: AITemplate[];
}

export interface ContextConfig {
  includeCodebase: boolean;
  includeRelatedDocs: boolean;
  includeUserHistory: boolean;
  maxContextLength: number;
}

export interface AITemplate {
  id: string;
  name: string;
  prompt: string;
  variables: TemplateVariable[];
  examples: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
}

// Advanced Search
export interface SearchIndex {
  id: string;
  documentId: string;
  blockId?: string;
  content: string;
  embeddings: number[];
  keywords: string[];
  entities: NamedEntity[];
  metadata: SearchMetadata;
  lastIndexed: Date;
}

export interface NamedEntity {
  text: string;
  label: EntityLabel;
  confidence: number;
  start: number;
  end: number;
}

export type EntityLabel =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'TECHNOLOGY'
  | 'API'
  | 'SERVICE'
  | 'DATABASE'
  | 'CONCEPT'
  | 'CODE_FUNCTION'
  | 'CODE_CLASS'
  | 'FILE_PATH';

export interface SearchQuery {
  query: string;
  filters: SearchFilters;
  options: SearchOptions;
}

export interface SearchFilters {
  documentTypes?: DocumentFormat[];
  tags?: string[];
  authors?: string[];
  dateRange?: DateRange;
  difficulty?: Array<'beginner' | 'intermediate' | 'advanced'>;
  interactive?: boolean;
}

export interface SearchOptions {
  semantic: boolean;
  fuzzy: boolean;
  autocomplete: boolean;
  limit: number;
  offset: number;
  highlight: boolean;
  explain: boolean;
}

export interface SearchResult {
  document: TechDocument;
  relevance: number;
  highlights: SearchHighlight[];
  explanation?: SearchExplanation;
  relatedDocuments: RelatedDocument[];
}

export interface SearchHighlight {
  blockId: string;
  text: string;
  start: number;
  end: number;
  type: 'exact' | 'semantic' | 'fuzzy';
}

// Visual Diagrams
export interface DiagramConfig {
  type: DiagramType;
  data: any;
  layout: LayoutConfig;
  styling: StylingConfig;
  interactive: boolean;
  exportFormats: ExportFormat[];
}

export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'gantt'
  | 'pie'
  | 'network'
  | 'architecture'
  | 'mindmap'
  | 'timeline'
  | 'kanban'
  | 'custom';

export interface LayoutConfig {
  direction: 'horizontal' | 'vertical' | 'radial';
  spacing: number;
  alignment: 'start' | 'center' | 'end';
  autoLayout: boolean;
}

// Analytics & Feedback
export interface DocumentAnalytics {
  views: ViewAnalytics;
  engagement: EngagementAnalytics;
  feedback: FeedbackAnalytics;
  performance: PerformanceAnalytics;
}

export interface ViewAnalytics {
  totalViews: number;
  uniqueViews: number;
  viewHistory: ViewEvent[];
  heatmap: HeatmapData;
  scrollDepth: ScrollDepthData;
}

export interface ViewEvent {
  userId?: string;
  timestamp: Date;
  duration: number;
  referrer: string;
  userAgent: string;
  location: GeoLocation;
}

export interface HeatmapData {
  clicks: ClickEvent[];
  hovers: HoverEvent[];
  scrolls: ScrollEvent[];
}

export interface EngagementAnalytics {
  averageReadTime: number;
  bounceRate: number;
  completionRate: number;
  interactionRate: number;
  socialShares: number;
  bookmarks: number;
}

// Versioning & Change Tracking
export interface DocumentVersion {
  version: string;
  branch: string;
  commit: string;
  changelog: ChangelogEntry[];
  diff: SemanticDiff;
  published: boolean;
  publishedAt?: Date;
}

export interface SemanticDiff {
  added: DiffBlock[];
  removed: DiffBlock[];
  modified: DiffBlock[];
  moved: DiffBlock[];
  metadata: DiffMetadata;
}

export interface DiffBlock {
  blockId: string;
  type: BlockType;
  content: any;
  significance: 'minor' | 'major' | 'breaking';
}

// Testing & Validation
export interface ValidationConfig {
  rules: ValidationRule[];
  automated: boolean;
  continuous: boolean;
  notifications: NotificationConfig;
}

export interface ValidationRule {
  id: string;
  name: string;
  type: ValidationType;
  config: any;
  severity: 'info' | 'warning' | 'error';
  autofix: boolean;
}

export type ValidationType =
  | 'spelling'
  | 'grammar'
  | 'code-syntax'
  | 'link-checker'
  | 'image-optimization'
  | 'accessibility'
  | 'seo'
  | 'readability'
  | 'consistency'
  | 'outdated-content';

// Performance & Optimization
export interface PerformanceConfig {
  caching: CacheConfig;
  compression: CompressionConfig;
  lazy: LazyLoadingConfig;
  cdn: CDNConfig;
}

export interface CacheConfig {
  enabled: boolean;
  strategy: CacheStrategy;
  ttl: number;
  layers: CacheLayer[];
}

export type CacheStrategy = 'lru' | 'lfu' | 'ttl' | 'adaptive';

export type CacheLayer = 'browser' | 'edge' | 'application' | 'database';

// Utility Types
export interface DateRange {
  start: Date;
  end: Date;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface SharingConfig {
  public: boolean;
  permissions: SharePermission[];
  embedAllowed: boolean;
  downloadAllowed: boolean;
}

export interface SharePermission {
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  expiresAt?: Date;
}

export interface CollaborationPermissions {
  canEdit: boolean;
  canComment: boolean;
  canSuggest: boolean;
  canPublish: boolean;
  canManageUsers: boolean;
}

export type DocumentStatus = 
  | 'draft'
  | 'review'
  | 'published'
  | 'archived'
  | 'deprecated';

export type ExportFormat = 'pdf' | 'html' | 'markdown' | 'docx' | 'epub';

export interface LockStatus {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: Date;
  reason?: string;
}

export interface Comment {
  id: string;
  userId: string;
  blockId: string;
  content: string;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies: Comment[];
}

export interface Suggestion {
  id: string;
  userId: string;
  blockId: string;
  type: 'content' | 'structure' | 'style';
  original: string;
  suggested: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface RelatedDocument {
  document: TechDocument;
  similarity: number;
  relationship: RelationshipType;
}

export type RelationshipType = 
  | 'similar'
  | 'prerequisite'
  | 'followup'
  | 'references'
  | 'updated-version';

export interface SearchExplanation {
  score: number;
  factors: ScoreFactor[];
  query: string;
  matched: string[];
}

export interface ScoreFactor {
  factor: string;
  score: number;
  description: string;
}

export interface SearchMetadata {
  title: string;
  description: string;
  tags: string[];
  author: string;
  difficulty: string;
  lastModified: Date;
  readTime: number;
}

export interface ChangelogEntry {
  version: string;
  date: Date;
  author: string;
  changes: ChangeDescription[];
}

export interface ChangeDescription {
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
  blockId?: string;
}

export interface DiffMetadata {
  totalChanges: number;
  significance: 'minor' | 'major' | 'breaking';
  affectedSections: string[];
  migrationRequired: boolean;
}

export interface NotificationConfig {
  email: boolean;
  slack: boolean;
  webhook?: string;
  severity: Array<'info' | 'warning' | 'error'>;
}

export interface StylingConfig {
  theme: string;
  colors: Record<string, string>;
  fonts: FontConfig;
  spacing: SpacingConfig;
}

export interface FontConfig {
  family: string;
  size: number;
  weight: number;
}

export interface SpacingConfig {
  padding: number;
  margin: number;
  gap: number;
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'deflate';
  level: number;
}

export interface LazyLoadingConfig {
  enabled: boolean;
  threshold: number;
  rootMargin: string;
}

export interface CDNConfig {
  enabled: boolean;
  provider: string;
  endpoints: string[];
}

export interface AutoCompleteConfig {
  enabled: boolean;
  minChars: number;
  maxSuggestions: number;
  contextAware: boolean;
}

export interface QualityAnalysisConfig {
  enabled: boolean;
  metrics: QualityMetric[];
  threshold: number;
}

export type QualityMetric = 
  | 'readability'
  | 'completeness'
  | 'accuracy'
  | 'freshness'
  | 'engagement';

export interface SmartSuggestionsConfig {
  enabled: boolean;
  types: SuggestionType[];
  frequency: 'realtime' | 'periodic' | 'manual';
}

export type SuggestionType =
  | 'content-improvement'
  | 'structure-optimization'
  | 'link-suggestions'
  | 'tag-recommendations'
  | 'related-content';

export interface ClickEvent {
  x: number;
  y: number;
  element: string;
  timestamp: Date;
}

export interface HoverEvent {
  x: number;
  y: number;
  element: string;
  duration: number;
  timestamp: Date;
}

export interface ScrollEvent {
  depth: number;
  timestamp: Date;
  velocity: number;
}

export interface ScrollDepthData {
  averageDepth: number;
  maxDepth: number;
  milestones: ScrollMilestone[];
}

export interface ScrollMilestone {
  percentage: number;
  reached: number;
  averageTime: number;
}

export interface FeedbackAnalytics {
  rating: number;
  reviews: Review[];
  suggestions: FeedbackSuggestion[];
  sentiment: SentimentAnalysis;
}

export interface Review {
  id: string;
  userId: string;
  rating: number;
  comment: string;
  helpful: number;
  createdAt: Date;
}

export interface FeedbackSuggestion {
  id: string;
  userId: string;
  type: 'improvement' | 'error' | 'feature';
  content: string;
  status: 'pending' | 'reviewed' | 'implemented';
  votes: number;
  createdAt: Date;
}

export interface SentimentAnalysis {
  positive: number;
  negative: number;
  neutral: number;
  confidence: number;
}

export interface PerformanceAnalytics {
  loadTime: number;
  renderTime: number;
  interactiveTime: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface ChangeMetadata {
  significance: 'minor' | 'major' | 'breaking';
  category: 'content' | 'structure' | 'metadata';
  automated: boolean;
}