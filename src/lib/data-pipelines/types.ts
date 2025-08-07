// Data Pipeline Types and Interfaces

export interface DataPipelineConfig {
  id: string;
  name: string;
  description: string;
  type: PipelineType;
  schedule: ScheduleConfig;
  sources: DataSource[];
  destinations: DataDestination[];
  transformations: TransformationStep[];
  qualityChecks: QualityCheck[];
  metadata: PipelineMetadata;
}

export enum PipelineType {
  BATCH = 'batch',
  STREAMING = 'streaming',
  MICRO_BATCH = 'micro_batch',
  LAMBDA = 'lambda',
  KAPPA = 'kappa'
}

export interface ScheduleConfig {
  type: 'cron' | 'interval' | 'event' | 'manual';
  expression?: string;
  interval?: number;
  timezone?: string;
  enabled: boolean;
}

export interface DataSource {
  id: string;
  type: SourceType;
  connection: ConnectionConfig;
  schema?: SchemaDefinition;
  partitioning?: PartitionConfig;
  watermarks?: WatermarkConfig;
}

export interface DataDestination {
  id: string;
  type: DestinationType;
  connection: ConnectionConfig;
  schema?: SchemaDefinition;
  writeMode: WriteMode;
  partitioning?: PartitionConfig;
}

export enum SourceType {
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  KAFKA = 'kafka',
  KINESIS = 'kinesis',
  API = 'api',
  S3 = 's3',
  BIGQUERY = 'bigquery',
  SNOWFLAKE = 'snowflake',
  REDSHIFT = 'redshift',
  ELASTICSEARCH = 'elasticsearch',
  MONGODB = 'mongodb',
  CASSANDRA = 'cassandra'
}

export enum DestinationType {
  DATABASE = 'database',
  DATA_WAREHOUSE = 'data_warehouse',
  DATA_LAKE = 'data_lake',
  KAFKA = 'kafka',
  API = 'api',
  S3 = 's3',
  BIGQUERY = 'bigquery',
  SNOWFLAKE = 'snowflake',
  REDSHIFT = 'redshift',
  ELASTICSEARCH = 'elasticsearch'
}

export enum WriteMode {
  APPEND = 'append',
  OVERWRITE = 'overwrite',
  UPSERT = 'upsert',
  DELETE = 'delete'
}

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  parameters?: Record<string, any>;
  secretRef?: string;
}

export interface SchemaDefinition {
  fields: FieldDefinition[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyDefinition[];
  indexes?: IndexDefinition[];
}

export interface FieldDefinition {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  constraints?: FieldConstraint[];
}

export interface FieldConstraint {
  type: 'min' | 'max' | 'regex' | 'enum' | 'unique';
  value: any;
}

export interface ForeignKeyDefinition {
  fields: string[];
  referencedTable: string;
  referencedFields: string[];
}

export interface IndexDefinition {
  name: string;
  fields: string[];
  unique: boolean;
}

export interface PartitionConfig {
  type: 'range' | 'hash' | 'list';
  fields: string[];
  strategy?: string;
}

export interface WatermarkConfig {
  field: string;
  strategy: 'bounded' | 'unbounded';
  allowedLateness: number;
  idleTimeout?: number;
}

export interface TransformationStep {
  id: string;
  name: string;
  type: TransformationType;
  config: Record<string, any>;
  dependencies?: string[];
}

export enum TransformationType {
  SQL = 'sql',
  PYTHON = 'python',
  SCALA = 'scala',
  JAVA = 'java',
  DBT = 'dbt',
  SPARK_SQL = 'spark_sql',
  FLINK_SQL = 'flink_sql'
}

export interface QualityCheck {
  id: string;
  name: string;
  type: QualityCheckType;
  config: QualityCheckConfig;
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
}

export enum QualityCheckType {
  ROW_COUNT = 'row_count',
  COLUMN_NULL = 'column_null',
  COLUMN_UNIQUE = 'column_unique',
  COLUMN_RANGE = 'column_range',
  COLUMN_PATTERN = 'column_pattern',
  FRESHNESS = 'freshness',
  SCHEMA_VALIDATION = 'schema_validation',
  CUSTOM_SQL = 'custom_sql',
  GREAT_EXPECTATIONS = 'great_expectations'
}

export interface QualityCheckConfig {
  table?: string;
  column?: string;
  threshold?: number;
  operator?: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  query?: string;
  expectation?: string;
}

export interface PipelineMetadata {
  owner: string;
  team: string;
  tags: string[];
  sla: SLAConfig;
  documentation?: string;
  contacts: ContactInfo[];
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface SLAConfig {
  expectedRuntime: number;
  maxRetries: number;
  alertOnFailure: boolean;
  alertOnDelay: boolean;
}

export interface ContactInfo {
  type: 'email' | 'slack' | 'pagerduty';
  value: string;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  logs: ExecutionLog[];
  metrics: ExecutionMetrics;
  error?: ExecutionError;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped'
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  component?: string;
}

export interface ExecutionMetrics {
  rowsProcessed: number;
  bytesProcessed: number;
  cpuUsage: number;
  memoryUsage: number;
  ioOperations: number;
  checkpointCount?: number;
  latency?: number;
}

export interface ExecutionError {
  type: string;
  message: string;
  stackTrace: string;
  recoverable: boolean;
}

export interface DataLineage {
  pipelineId: string;
  upstream: LineageNode[];
  downstream: LineageNode[];
  transformations: TransformationLineage[];
}

export interface LineageNode {
  type: 'table' | 'view' | 'file' | 'topic';
  name: string;
  schema?: string;
  database?: string;
  system: string;
}

export interface TransformationLineage {
  stepId: string;
  inputFields: string[];
  outputFields: string[];
  logic: string;
}

export interface DataCatalogEntry {
  id: string;
  name: string;
  type: 'dataset' | 'pipeline' | 'transformation';
  description: string;
  schema: SchemaDefinition;
  owner: string;
  tags: string[];
  location: string;
  format: string;
  size?: number;
  rowCount?: number;
  lastUpdated: Date;
  qualityScore?: number;
  lineage: DataLineage;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  type: PolicyType;
  rules: PolicyRule[];
  enforcement: 'block' | 'warn' | 'audit';
  scope: PolicyScope;
}

export enum PolicyType {
  DATA_CLASSIFICATION = 'data_classification',
  RETENTION = 'retention',
  ACCESS_CONTROL = 'access_control',
  PRIVACY = 'privacy',
  QUALITY = 'quality'
}

export interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
}

export interface PolicyScope {
  databases?: string[];
  tables?: string[];
  columns?: string[];
  tags?: string[];
  owners?: string[];
}

export interface MonitoringAlert {
  id: string;
  pipelineId: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export enum AlertType {
  PIPELINE_FAILURE = 'pipeline_failure',
  QUALITY_FAILURE = 'quality_failure',
  SLA_BREACH = 'sla_breach',
  DATA_DRIFT = 'data_drift',
  SCHEMA_CHANGE = 'schema_change',
  HIGH_LATENCY = 'high_latency',
  RESOURCE_USAGE = 'resource_usage'
}

export interface TestCase {
  id: string;
  pipelineId: string;
  name: string;
  type: TestType;
  config: TestConfig;
  expectedResult: any;
  status: TestStatus;
}

export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  END_TO_END = 'end_to_end',
  DATA_QUALITY = 'data_quality',
  PERFORMANCE = 'performance'
}

export interface TestConfig {
  inputData?: any[];
  mockSources?: Record<string, any>;
  assertions: Assertion[];
}

export interface Assertion {
  type: 'equals' | 'contains' | 'schema' | 'count' | 'custom';
  target: string;
  expected: any;
}

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface DeploymentConfig {
  environment: 'dev' | 'staging' | 'prod';
  version: string;
  strategy: DeploymentStrategy;
  rollback: RollbackConfig;
  approvals: ApprovalConfig[];
}

export enum DeploymentStrategy {
  BLUE_GREEN = 'blue_green',
  CANARY = 'canary',
  ROLLING = 'rolling',
  IMMEDIATE = 'immediate'
}

export interface RollbackConfig {
  enabled: boolean;
  automatic: boolean;
  triggers: string[];
}

export interface ApprovalConfig {
  stage: string;
  required: boolean;
  approvers: string[];
  conditions: string[];
}