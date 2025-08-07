import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface PluginTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  version: string;
  author: TemplateAuthor;
  metadata: TemplateMetadata;
  structure: TemplateStructure;
  configuration: TemplateConfiguration;
  parameters: TemplateParameter[];
  files: TemplateFile[];
  dependencies: TemplateDependency[];
  hooks: TemplateHooks;
  documentation: TemplateDocumentation;
  examples: TemplateExample[];
  testing: TemplateTestingConfig;
  deployment: TemplateDeploymentConfig;
  created: string;
  updated: string;
}

type TemplateCategory = 
  | 'catalog'
  | 'scaffolding' 
  | 'monitoring'
  | 'security'
  | 'workflow'
  | 'integration'
  | 'visualization'
  | 'authentication'
  | 'notification'
  | 'analytics'
  | 'database'
  | 'api'
  | 'frontend'
  | 'backend'
  | 'infrastructure'
  | 'devops'
  | 'quality'
  | 'documentation'
  | 'collaboration'
  | 'custom';

interface TemplateAuthor {
  name: string;
  email: string;
  organization?: string;
  avatar?: string;
  website?: string;
  github?: string;
  bio?: string;
}

interface TemplateMetadata {
  displayName: string;
  shortDescription: string;
  tags: string[];
  keywords: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedTime: number; // minutes
  license: string;
  maintainers: string[];
  contributors: string[];
  repository?: string;
  homepage?: string;
  issues?: string;
  changelog?: string;
  roadmap?: string;
  features: string[];
  requirements: string[];
  limitations?: string[];
  alternatives?: string[];
  screenshots?: string[];
  videos?: string[];
  ratings: TemplateRatings;
  usage: TemplateUsageStats;
}

interface TemplateRatings {
  average: number;
  total: number;
  distribution: Record<number, number>; // 1-5 star ratings
  reviews: TemplateReview[];
}

interface TemplateReview {
  id: string;
  userId: string;
  username: string;
  rating: number;
  title: string;
  comment: string;
  helpful: number;
  unhelpful: number;
  verified: boolean;
  created: string;
  updated?: string;
}

interface TemplateUsageStats {
  downloads: number;
  installations: number;
  activeInstances: number;
  successRate: number;
  averageSetupTime: number;
  popularParameters: Record<string, number>;
  weeklyTrend: number[];
  monthlyTrend: number[];
}

interface TemplateStructure {
  type: 'monorepo' | 'standalone' | 'microservice' | 'library' | 'application';
  architecture: TemplateArchitecture;
  framework: string;
  language: string;
  buildTool: string;
  packageManager: string;
  testFramework?: string;
  lintingTool?: string;
  formatting?: string;
  ci?: string[];
  deployment?: string[];
}

interface TemplateArchitecture {
  pattern: 'mvc' | 'mvp' | 'mvvm' | 'microservices' | 'serverless' | 'jamstack' | 'custom';
  layers: ArchitectureLayer[];
  modules: ArchitectureModule[];
  integrations: ArchitectureIntegration[];
}

interface ArchitectureLayer {
  name: string;
  type: 'presentation' | 'business' | 'data' | 'infrastructure' | 'cross-cutting';
  description: string;
  components: string[];
  dependencies: string[];
}

interface ArchitectureModule {
  name: string;
  type: 'core' | 'feature' | 'shared' | 'external';
  path: string;
  description: string;
  exports: string[];
  imports: string[];
}

interface ArchitectureIntegration {
  name: string;
  type: 'api' | 'database' | 'queue' | 'cache' | 'storage' | 'auth' | 'monitoring';
  protocol: string;
  endpoint?: string;
  configuration: Record<string, any>;
}

interface TemplateConfiguration {
  backstage: BackstageConfig;
  environment: EnvironmentConfig;
  build: BuildConfig;
  runtime: RuntimeConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  customization: CustomizationConfig;
}

interface BackstageConfig {
  version: string;
  requiredPlugins: string[];
  optionalPlugins: string[];
  catalog: CatalogConfig;
  techDocs: TechDocsConfig;
  kubernetes?: KubernetesConfig;
  scaffolder: ScaffolderConfig;
}

interface CatalogConfig {
  entities: EntityConfig[];
  processors: string[];
  rules: CatalogRule[];
}

interface EntityConfig {
  type: string;
  spec: Record<string, any>;
  relations?: EntityRelation[];
}

interface EntityRelation {
  type: string;
  target: string;
  metadata?: Record<string, any>;
}

interface CatalogRule {
  allow: string[];
  locations: LocationConfig[];
}

interface LocationConfig {
  type: string;
  target: string;
  rules?: string[];
}

interface TechDocsConfig {
  builder: 'local' | 'external';
  generator: 'techdocs' | 'custom';
  publisher: PublisherConfig;
}

interface PublisherConfig {
  type: 'local' | 's3' | 'gcs' | 'azure';
  config?: Record<string, any>;
}

interface KubernetesConfig {
  serviceLocatorMethod: string;
  clusterLocatorMethods: ClusterLocatorMethod[];
  objectTypes: string[];
  apiVersionOverrides?: Record<string, string>;
}

interface ClusterLocatorMethod {
  type: string;
  clusters: ClusterInfo[];
}

interface ClusterInfo {
  name: string;
  url: string;
  authProvider?: string;
  serviceAccountToken?: string;
  skipTLSVerify?: boolean;
  caData?: string;
}

interface ScaffolderConfig {
  actions: ActionConfig[];
  templates: TemplateLocationConfig[];
}

interface ActionConfig {
  name: string;
  handler: string;
  schema?: Record<string, any>;
}

interface TemplateLocationConfig {
  type: string;
  target: string;
  rules?: string[];
}

interface EnvironmentConfig {
  variables: EnvironmentVariable[];
  secrets: SecretVariable[];
  volumes: VolumeMount[];
  networking: NetworkingConfig;
  resources: ResourceConfig;
}

interface EnvironmentVariable {
  name: string;
  value?: string;
  valueFrom?: ValueSource;
  description?: string;
  required: boolean;
  sensitive: boolean;
}

interface ValueSource {
  configMapKeyRef?: ConfigMapKeySelector;
  secretKeyRef?: SecretKeySelector;
  fieldRef?: FieldSelector;
}

interface ConfigMapKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}

interface SecretKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}

interface FieldSelector {
  fieldPath: string;
  apiVersion?: string;
}

interface SecretVariable {
  name: string;
  description?: string;
  type: 'string' | 'file' | 'certificate';
  encoding?: 'base64' | 'plain';
  rotation?: RotationPolicy;
}

interface RotationPolicy {
  enabled: boolean;
  frequency: string;
  notificationThreshold: number;
}

interface VolumeMount {
  name: string;
  type: 'emptyDir' | 'hostPath' | 'nfs' | 'pvc' | 'configMap' | 'secret';
  mountPath: string;
  subPath?: string;
  readOnly?: boolean;
  source?: VolumeSource;
}

interface VolumeSource {
  hostPath?: string;
  nfs?: NFSVolumeSource;
  pvc?: string;
  configMap?: string;
  secret?: string;
}

interface NFSVolumeSource {
  server: string;
  path: string;
  readOnly?: boolean;
}

interface NetworkingConfig {
  ports: PortConfig[];
  ingress: IngressConfig[];
  services: ServiceConfig[];
}

interface PortConfig {
  name: string;
  port: number;
  targetPort: number;
  protocol: 'TCP' | 'UDP';
  nodePort?: number;
}

interface IngressConfig {
  name: string;
  host: string;
  paths: IngressPath[];
  tls?: TLSConfig[];
}

interface IngressPath {
  path: string;
  pathType: 'Exact' | 'Prefix';
  backend: IngressBackend;
}

interface IngressBackend {
  service: string;
  port: number;
}

interface TLSConfig {
  hosts: string[];
  secretName: string;
}

interface ServiceConfig {
  name: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  ports: PortConfig[];
  selector: Record<string, string>;
}

interface ResourceConfig {
  requests: ResourceRequirement;
  limits: ResourceRequirement;
  scaling: ScalingConfig;
}

interface ResourceRequirement {
  cpu: string;
  memory: string;
  storage?: string;
}

interface ScalingConfig {
  minReplicas: number;
  maxReplicas: number;
  metrics: ScalingMetric[];
}

interface ScalingMetric {
  type: 'cpu' | 'memory' | 'custom';
  target: number;
  resource?: string;
}

interface BuildConfig {
  steps: BuildStep[];
  artifacts: ArtifactConfig[];
  cache: CacheConfig;
  optimization: OptimizationConfig;
}

interface BuildStep {
  name: string;
  command: string;
  args: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  condition?: BuildCondition;
  timeout?: number;
  retries?: number;
}

interface BuildCondition {
  when: 'always' | 'on_success' | 'on_failure' | 'manual';
  expression?: string;
}

interface ArtifactConfig {
  name: string;
  type: 'docker' | 'npm' | 'jar' | 'binary' | 'archive';
  source: string;
  destination: string;
  compress?: boolean;
  metadata?: Record<string, any>;
}

interface CacheConfig {
  enabled: boolean;
  key: string;
  paths: string[];
  policy: 'push' | 'pull' | 'push-pull';
}

interface OptimizationConfig {
  minification: boolean;
  compression: boolean;
  treeshaking: boolean;
  bundleSplitting: boolean;
  lazyLoading: boolean;
  codeAnalysis: boolean;
}

interface RuntimeConfig {
  platform: 'node' | 'browser' | 'docker' | 'serverless' | 'kubernetes';
  version: string;
  entrypoint: string;
  healthcheck: HealthcheckConfig;
  lifecycle: LifecycleConfig;
  logging: LoggingConfig;
  metrics: MetricsConfig;
}

interface HealthcheckConfig {
  enabled: boolean;
  path?: string;
  port?: number;
  interval: number;
  timeout: number;
  retries: number;
  initialDelay: number;
}

interface LifecycleConfig {
  preStart?: LifecycleHook;
  postStart?: LifecycleHook;
  preStop?: LifecycleHook;
}

interface LifecycleHook {
  exec?: ExecAction;
  httpGet?: HTTPGetAction;
  tcpSocket?: TCPSocketAction;
}

interface ExecAction {
  command: string[];
}

interface HTTPGetAction {
  path: string;
  port: number;
  host?: string;
  scheme?: 'HTTP' | 'HTTPS';
  headers?: HTTPHeader[];
}

interface HTTPHeader {
  name: string;
  value: string;
}

interface TCPSocketAction {
  port: number;
  host?: string;
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  output: LogOutput[];
  rotation: LogRotation;
}

interface LogOutput {
  type: 'stdout' | 'file' | 'syslog' | 'remote';
  config?: Record<string, any>;
}

interface LogRotation {
  enabled: boolean;
  maxSize: string;
  maxFiles: number;
  maxAge: string;
}

interface MetricsConfig {
  enabled: boolean;
  port: number;
  path: string;
  collectors: MetricCollector[];
}

interface MetricCollector {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels: string[];
}

interface SecurityConfig {
  authentication: AuthConfig;
  authorization: AuthzConfig;
  encryption: EncryptionConfig;
  scanning: ScanningConfig;
  compliance: ComplianceConfig;
}

interface AuthConfig {
  required: boolean;
  providers: string[];
  session: SessionConfig;
  tokens: TokenConfig;
}

interface SessionConfig {
  timeout: number;
  cookieSecure: boolean;
  cookieSameSite: 'strict' | 'lax' | 'none';
}

interface TokenConfig {
  issuer: string;
  algorithm: string;
  expiration: number;
  refresh: boolean;
}

interface AuthzConfig {
  enabled: boolean;
  provider: string;
  policies: PolicyConfig[];
  rbac: RBACConfig;
}

interface PolicyConfig {
  name: string;
  effect: 'allow' | 'deny';
  actions: string[];
  resources: string[];
  conditions: PolicyCondition[];
}

interface PolicyCondition {
  field: string;
  operator: string;
  value: any;
}

interface RBACConfig {
  enabled: boolean;
  roles: RoleConfig[];
  bindings: RoleBinding[];
}

interface RoleConfig {
  name: string;
  permissions: string[];
  description?: string;
}

interface RoleBinding {
  subject: string;
  role: string;
  scope?: string;
}

interface EncryptionConfig {
  inTransit: boolean;
  atRest: boolean;
  algorithm: string;
  keyManagement: KeyManagementConfig;
}

interface KeyManagementConfig {
  provider: string;
  rotation: boolean;
  rotationInterval: number;
}

interface ScanningConfig {
  enabled: boolean;
  types: ('sast' | 'dast' | 'sca' | 'secrets' | 'license')[];
  schedule: string;
  thresholds: ScanThreshold[];
}

interface ScanThreshold {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  limit: number;
}

interface ComplianceConfig {
  frameworks: string[];
  controls: ComplianceControl[];
  reporting: ComplianceReporting;
}

interface ComplianceControl {
  id: string;
  framework: string;
  description: string;
  implemented: boolean;
  evidence: string[];
}

interface ComplianceReporting {
  enabled: boolean;
  schedule: string;
  format: 'json' | 'xml' | 'pdf';
  recipients: string[];
}

interface MonitoringConfig {
  metrics: boolean;
  traces: boolean;
  logs: boolean;
  alerts: AlertConfig[];
  dashboards: DashboardConfig[];
}

interface AlertConfig {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  threshold: number;
  duration: string;
  notifications: NotificationConfig[];
}

interface NotificationConfig {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  config: Record<string, any>;
}

interface DashboardConfig {
  name: string;
  panels: DashboardPanel[];
  layout: DashboardLayout;
}

interface DashboardPanel {
  id: string;
  type: 'graph' | 'table' | 'stat' | 'text';
  title: string;
  query: string;
  visualization: VisualizationConfig;
}

interface VisualizationConfig {
  type: string;
  options: Record<string, any>;
  fieldConfig: FieldConfig;
}

interface FieldConfig {
  defaults: FieldDefaults;
  overrides: FieldOverride[];
}

interface FieldDefaults {
  unit?: string;
  min?: number;
  max?: number;
  color?: ColorConfig;
}

interface ColorConfig {
  mode: 'continuous-GrYlRd' | 'palette-classic';
  fixedColor?: string;
}

interface FieldOverride {
  matcher: FieldMatcher;
  properties: FieldProperty[];
}

interface FieldMatcher {
  id: string;
  options: any;
}

interface FieldProperty {
  id: string;
  value: any;
}

interface DashboardLayout {
  panels: PanelLayout[];
}

interface PanelLayout {
  id: string;
  gridPos: GridPosition;
}

interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CustomizationConfig {
  themes: ThemeConfig[];
  branding: BrandingConfig;
  ui: UIConfig;
  features: FeatureFlag[];
}

interface ThemeConfig {
  name: string;
  colors: Record<string, string>;
  fonts: FontConfig;
}

interface FontConfig {
  primary: string;
  secondary: string;
  monospace: string;
}

interface BrandingConfig {
  logo: string;
  favicon: string;
  title: string;
  colors: BrandColors;
}

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

interface UIConfig {
  navigation: NavigationConfig;
  layout: LayoutConfig;
  components: ComponentConfig[];
}

interface NavigationConfig {
  style: 'sidebar' | 'topbar' | 'hybrid';
  collapsible: boolean;
  items: NavigationItem[];
}

interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  url: string;
  children?: NavigationItem[];
  permissions?: string[];
}

interface LayoutConfig {
  grid: GridConfig;
  spacing: SpacingConfig;
  breakpoints: BreakpointConfig;
}

interface GridConfig {
  columns: number;
  gap: string;
  container: string;
}

interface SpacingConfig {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

interface ComponentConfig {
  name: string;
  props: Record<string, any>;
  overrides: ComponentOverride[];
}

interface ComponentOverride {
  selector: string;
  styles: Record<string, any>;
}

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  rollout?: RolloutConfig;
}

interface RolloutConfig {
  percentage: number;
  criteria: RolloutCriteria[];
}

interface RolloutCriteria {
  type: 'user' | 'group' | 'environment';
  values: string[];
}

interface TemplateParameter {
  name: string;
  type: ParameterType;
  title: string;
  description: string;
  required: boolean;
  default?: any;
  enum?: ParameterOption[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  format?: string;
  validation?: ParameterValidation;
  conditional?: ParameterCondition;
  group?: string;
  order?: number;
  hidden?: boolean;
  advanced?: boolean;
}

type ParameterType = 
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'email'
  | 'url'
  | 'date'
  | 'datetime'
  | 'password'
  | 'file'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'editor'
  | 'json';

interface ParameterOption {
  label: string;
  value: any;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

interface ParameterValidation {
  custom?: ValidationRule[];
  async?: AsyncValidation;
  dependencies?: DependencyRule[];
}

interface ValidationRule {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

interface AsyncValidation {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  debounce?: number;
}

interface DependencyRule {
  field: string;
  condition: 'equals' | 'not-equals' | 'contains' | 'not-contains';
  value: any;
}

interface ParameterCondition {
  show: ConditionalRule[];
  hide?: ConditionalRule[];
  enable?: ConditionalRule[];
  disable?: ConditionalRule[];
}

interface ConditionalRule {
  field: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'greater' | 'less';
  value: any;
}

interface TemplateFile {
  path: string;
  type: 'template' | 'static' | 'binary';
  encoding?: 'utf8' | 'base64';
  content?: string;
  contentUrl?: string;
  size?: number;
  checksum?: string;
  executable?: boolean;
  templating: TemplatingConfig;
  conditions?: FileCondition[];
  transformations?: FileTransformation[];
}

interface TemplatingConfig {
  engine: 'handlebars' | 'mustache' | 'ejs' | 'jinja2' | 'nunjucks';
  delimiters?: TemplateDelimiters;
  helpers?: TemplateHelper[];
  partials?: TemplatePartial[];
  globals?: Record<string, any>;
}

interface TemplateDelimiters {
  start: string;
  end: string;
  rawStart?: string;
  rawEnd?: string;
}

interface TemplateHelper {
  name: string;
  function: string;
  description?: string;
}

interface TemplatePartial {
  name: string;
  content: string;
}

interface FileCondition {
  parameter: string;
  operator: 'equals' | 'not-equals' | 'exists' | 'not-exists';
  value?: any;
}

interface FileTransformation {
  type: 'replace' | 'prepend' | 'append' | 'rename' | 'move' | 'delete';
  config: TransformationConfig;
}

interface TransformationConfig {
  pattern?: string;
  replacement?: string;
  target?: string;
  condition?: string;
}

interface TemplateDependency {
  name: string;
  type: 'npm' | 'pip' | 'maven' | 'gradle' | 'composer' | 'go' | 'cargo' | 'gem' | 'nuget';
  version: string;
  scope?: 'runtime' | 'development' | 'test' | 'optional';
  source?: string;
  registry?: string;
  integrity?: string;
  license?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  alternatives?: DependencyAlternative[];
  conflicts?: string[];
  replaces?: string[];
}

interface DependencyAlternative {
  name: string;
  version: string;
  condition?: string;
  reason?: string;
}

interface TemplateHooks {
  preGenerate?: HookConfig[];
  postGenerate?: HookConfig[];
  preBuild?: HookConfig[];
  postBuild?: HookConfig[];
  preDeploy?: HookConfig[];
  postDeploy?: HookConfig[];
  preTest?: HookConfig[];
  postTest?: HookConfig[];
  onError?: HookConfig[];
  onSuccess?: HookConfig[];
}

interface HookConfig {
  name: string;
  script: string;
  interpreter?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  retries?: number;
  continueOnError?: boolean;
  condition?: string;
  async?: boolean;
}

interface TemplateDocumentation {
  readme: string;
  changelog?: string;
  contributing?: string;
  license?: string;
  architecture?: string;
  api?: string;
  deployment?: string;
  troubleshooting?: string;
  faq?: string;
  tutorials?: TutorialDoc[];
  guides?: GuideDoc[];
  references?: ReferenceDoc[];
  multimedia?: MultimediaDoc[];
}

interface TutorialDoc {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  prerequisites: string[];
  steps: TutorialStep[];
  resources: string[];
}

interface TutorialStep {
  title: string;
  description: string;
  code?: string;
  image?: string;
  video?: string;
  tips?: string[];
  troubleshooting?: TroubleshootingItem[];
}

interface TroubleshootingItem {
  problem: string;
  solution: string;
  related: string[];
}

interface GuideDoc {
  title: string;
  description: string;
  category: string;
  content: string;
  lastUpdated: string;
  author: string;
  tags: string[];
}

interface ReferenceDoc {
  title: string;
  type: 'api' | 'configuration' | 'cli' | 'sdk';
  content: string;
  examples: CodeExample[];
}

interface CodeExample {
  title: string;
  language: string;
  code: string;
  description?: string;
  output?: string;
}

interface MultimediaDoc {
  title: string;
  type: 'video' | 'image' | 'diagram' | 'presentation';
  url: string;
  thumbnail?: string;
  duration?: number;
  description?: string;
  transcription?: string;
}

interface TemplateExample {
  name: string;
  description: string;
  parameters: Record<string, any>;
  expectedOutput: ExampleOutput;
  validation: ExampleValidation[];
}

interface ExampleOutput {
  files: string[];
  structure: string;
  preview?: string;
  demo?: string;
}

interface ExampleValidation {
  type: 'build' | 'test' | 'lint' | 'deploy' | 'functional';
  command: string;
  expectedExitCode: number;
  expectedOutput?: string;
  timeout: number;
}

interface TemplateTestingConfig {
  unit: UnitTestConfig;
  integration: IntegrationTestConfig;
  e2e: E2ETestConfig;
  performance: PerformanceTestConfig;
  security: SecurityTestConfig;
}

interface UnitTestConfig {
  framework: string;
  coverage: CoverageConfig;
  patterns: string[];
  setup: string[];
  teardown: string[];
  mocks: MockConfig[];
}

interface CoverageConfig {
  threshold: number;
  exclude: string[];
  reporters: string[];
  directory: string;
}

interface MockConfig {
  name: string;
  type: 'module' | 'function' | 'class' | 'api';
  implementation?: string;
  responses?: MockResponse[];
}

interface MockResponse {
  request: MockRequest;
  response: MockResponseData;
}

interface MockRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}

interface MockResponseData {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
}

interface IntegrationTestConfig {
  services: TestService[];
  fixtures: TestFixture[];
  scenarios: TestScenario[];
}

interface TestService {
  name: string;
  image: string;
  environment: Record<string, string>;
  ports: number[];
  healthcheck: string;
  dependsOn: string[];
}

interface TestFixture {
  name: string;
  type: 'database' | 'file' | 'api' | 'config';
  source: string;
  setup: string[];
  cleanup: string[];
}

interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
  assertions: TestAssertion[];
}

interface TestStep {
  name: string;
  action: string;
  parameters: Record<string, any>;
  expectedResult?: any;
}

interface TestAssertion {
  type: 'equals' | 'contains' | 'matches' | 'exists' | 'greater' | 'less';
  actual: string;
  expected: any;
  message?: string;
}

interface E2ETestConfig {
  browser: BrowserConfig;
  pages: PageObjectConfig[];
  tests: E2ETestSuite[];
}

interface BrowserConfig {
  type: 'chrome' | 'firefox' | 'safari' | 'edge';
  headless: boolean;
  viewport: ViewportConfig;
  timeout: number;
}

interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

interface PageObjectConfig {
  name: string;
  url: string;
  selectors: Record<string, string>;
  actions: PageAction[];
}

interface PageAction {
  name: string;
  type: 'click' | 'type' | 'select' | 'wait' | 'screenshot';
  selector?: string;
  value?: any;
  timeout?: number;
}

interface E2ETestSuite {
  name: string;
  tests: E2ETest[];
  setup?: string[];
  teardown?: string[];
}

interface E2ETest {
  name: string;
  description: string;
  steps: E2ETestStep[];
  data?: Record<string, any>;
}

interface E2ETestStep {
  description: string;
  page: string;
  action: string;
  parameters?: Record<string, any>;
  assertions?: TestAssertion[];
}

interface PerformanceTestConfig {
  load: LoadTestConfig;
  stress: StressTestConfig;
  endurance: EnduranceTestConfig;
}

interface LoadTestConfig {
  scenarios: LoadTestScenario[];
  metrics: PerformanceMetric[];
  thresholds: PerformanceThreshold[];
}

interface LoadTestScenario {
  name: string;
  users: number;
  duration: string;
  rampUp: string;
  script: string;
}

interface PerformanceMetric {
  name: string;
  type: 'counter' | 'gauge' | 'rate' | 'trend';
  unit: string;
  description: string;
}

interface PerformanceThreshold {
  metric: string;
  condition: string;
  value: number;
}

interface StressTestConfig {
  maxUsers: number;
  rampUpStep: number;
  rampUpDuration: string;
  sustainDuration: string;
  breakingPoint: BreakingPointConfig;
}

interface BreakingPointConfig {
  errorRate: number;
  responseTime: number;
  throughput: number;
}

interface EnduranceTestConfig {
  duration: string;
  users: number;
  memoryThreshold: number;
  cpuThreshold: number;
  diskThreshold: number;
}

interface SecurityTestConfig {
  sast: SASTConfig;
  dast: DASTConfig;
  dependency: DependencyCheckConfig;
  secrets: SecretScanConfig;
}

interface SASTConfig {
  tools: string[];
  rules: string[];
  exclude: string[];
  severity: string;
}

interface DASTConfig {
  targets: string[];
  authentication: AuthTestConfig;
  scans: DastScanConfig[];
}

interface AuthTestConfig {
  type: 'basic' | 'form' | 'oauth' | 'api-key';
  credentials: Record<string, string>;
}

interface DastScanConfig {
  name: string;
  type: 'full' | 'quick' | 'custom';
  scope: string[];
  exclude: string[];
}

interface DependencyCheckConfig {
  databases: string[];
  failOnCVSS: number;
  skipTestScope: boolean;
}

interface SecretScanConfig {
  patterns: string[];
  whitelist: string[];
  entropy: boolean;
}

interface TemplateDeploymentConfig {
  environments: DeploymentEnvironment[];
  strategies: DeploymentStrategy[];
  automation: DeploymentAutomation;
  monitoring: DeploymentMonitoring;
}

interface DeploymentEnvironment {
  name: string;
  type: 'development' | 'staging' | 'production' | 'testing';
  config: EnvironmentDeployConfig;
  approval?: ApprovalConfig;
  restrictions?: DeploymentRestriction[];
}

interface EnvironmentDeployConfig {
  replicas: number;
  resources: ResourceRequirement;
  networking: NetworkingConfig;
  storage: StorageConfig[];
  secrets: SecretConfig[];
  configMaps: ConfigMapConfig[];
}

interface StorageConfig {
  name: string;
  type: 'persistent' | 'temporary';
  size: string;
  accessMode: string;
  storageClass?: string;
}

interface SecretConfig {
  name: string;
  type: 'Opaque' | 'kubernetes.io/tls' | 'kubernetes.io/dockerconfigjson';
  data: Record<string, string>;
}

interface ConfigMapConfig {
  name: string;
  data: Record<string, string>;
}

interface ApprovalConfig {
  required: boolean;
  approvers: string[];
  minApprovals: number;
  timeout: number;
}

interface DeploymentRestriction {
  type: 'time' | 'branch' | 'user' | 'environment';
  condition: string;
  message?: string;
}

interface DeploymentStrategy {
  name: string;
  type: 'rolling' | 'blue-green' | 'canary' | 'recreate';
  config: StrategyConfig;
}

interface StrategyConfig {
  maxUnavailable?: string;
  maxSurge?: string;
  canaryWeight?: number;
  promotionInterval?: string;
  autoPromotion?: boolean;
  rollbackOnFailure?: boolean;
}

interface DeploymentAutomation {
  ci: CIConfig;
  cd: CDConfig;
  gitOps: GitOpsConfig;
}

interface CIConfig {
  triggers: CITrigger[];
  pipeline: CIPipeline;
}

interface CITrigger {
  type: 'push' | 'pull-request' | 'schedule' | 'manual';
  branches?: string[];
  paths?: string[];
  schedule?: string;
}

interface CIPipeline {
  stages: CIStage[];
  cache: CacheStrategy;
  artifacts: ArtifactStrategy;
}

interface CIStage {
  name: string;
  jobs: CIJob[];
  dependsOn?: string[];
  condition?: string;
}

interface CIJob {
  name: string;
  image: string;
  script: string[];
  environment?: Record<string, string>;
  artifacts?: string[];
  cache?: string[];
}

interface CacheStrategy {
  key: string;
  paths: string[];
  policy: 'pull-push' | 'pull' | 'push';
}

interface ArtifactStrategy {
  name: string;
  paths: string[];
  when: 'always' | 'on_success' | 'on_failure';
  expire: string;
}

interface CDConfig {
  environments: CDEnvironment[];
  approvals: CDApproval[];
}

interface CDEnvironment {
  name: string;
  deploymentStrategy: string;
  triggers: CDTrigger[];
  variables: Record<string, string>;
}

interface CDTrigger {
  type: 'automatic' | 'manual' | 'scheduled';
  condition?: string;
  schedule?: string;
}

interface CDApproval {
  environment: string;
  required: boolean;
  approvers: string[];
  timeout: number;
}

interface GitOpsConfig {
  enabled: boolean;
  repository: string;
  path: string;
  branch: string;
  syncPolicy: GitOpsSyncPolicy;
}

interface GitOpsSyncPolicy {
  automated: boolean;
  prune: boolean;
  selfHeal: boolean;
  syncOptions: string[];
}

interface DeploymentMonitoring {
  healthChecks: HealthCheckConfig[];
  alerts: DeploymentAlert[];
  rollback: RollbackConfig;
}

interface HealthCheckConfig {
  name: string;
  type: 'http' | 'tcp' | 'command';
  config: Record<string, any>;
  interval: string;
  timeout: string;
  retries: number;
}

interface DeploymentAlert {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  notifications: string[];
}

interface RollbackConfig {
  automatic: boolean;
  conditions: RollbackCondition[];
  strategy: string;
}

interface RollbackCondition {
  metric: string;
  operator: string;
  threshold: number;
  duration: string;
}

interface TemplateMarketplace {
  id: string;
  name: string;
  description: string;
  featured: PluginTemplate[];
  categories: TemplateCategory[];
  collections: TemplateCollection[];
  publishers: TemplatePublisher[];
  statistics: MarketplaceStats;
  curation: CurationConfig;
}

interface TemplateCollection {
  id: string;
  name: string;
  description: string;
  curator: string;
  templates: string[];
  tags: string[];
  featured: boolean;
  created: string;
  updated: string;
}

interface TemplatePublisher {
  id: string;
  name: string;
  type: 'individual' | 'organization' | 'verified';
  avatar?: string;
  bio?: string;
  website?: string;
  social: SocialLinks;
  verification: PublisherVerification;
  statistics: PublisherStats;
  templates: string[];
}

interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  blog?: string;
}

interface PublisherVerification {
  verified: boolean;
  badges: string[];
  certifications: string[];
  verifiedAt?: string;
}

interface PublisherStats {
  totalTemplates: number;
  totalDownloads: number;
  averageRating: number;
  followers: number;
}

interface MarketplaceStats {
  totalTemplates: number;
  totalDownloads: number;
  totalUsers: number;
  activeTemplates: number;
  categoriesCount: number;
  averageRating: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  topCategories: CategoryStats[];
  popularTemplates: PopularTemplate[];
  recentActivity: ActivityItem[];
}

interface CategoryStats {
  category: TemplateCategory;
  count: number;
  growth: number;
}

interface PopularTemplate {
  id: string;
  name: string;
  downloads: number;
  rating: number;
  category: TemplateCategory;
}

interface ActivityItem {
  type: 'template_published' | 'template_updated' | 'template_downloaded' | 'review_added';
  templateId?: string;
  templateName?: string;
  userId: string;
  username: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface CurationConfig {
  enabled: boolean;
  autoApproval: AutoApprovalConfig;
  reviewProcess: ReviewProcessConfig;
  qualityGates: QualityGate[];
}

interface AutoApprovalConfig {
  enabled: boolean;
  criteria: AutoApprovalCriteria[];
}

interface AutoApprovalCriteria {
  type: 'publisher_verified' | 'template_score' | 'community_rating';
  threshold: number;
  weight: number;
}

interface ReviewProcessConfig {
  stages: ReviewStage[];
  reviewers: ReviewerConfig[];
  sla: ReviewSLA;
}

interface ReviewStage {
  name: string;
  type: 'automated' | 'manual';
  required: boolean;
  criteria: ReviewCriteria[];
  reviewers?: string[];
}

interface ReviewCriteria {
  category: string;
  weight: number;
  checklist: ChecklistItem[];
}

interface ChecklistItem {
  item: string;
  required: boolean;
  automated: boolean;
}

interface ReviewerConfig {
  id: string;
  name: string;
  specialties: string[];
  capacity: number;
  timezone: string;
}

interface ReviewSLA {
  automated: number; // hours
  manual: number; // hours
  total: number; // hours
  escalation: EscalationConfig;
}

interface EscalationConfig {
  enabled: boolean;
  threshold: number;
  levels: EscalationLevel[];
}

interface EscalationLevel {
  level: number;
  delay: number;
  assignees: string[];
  actions: string[];
}

interface QualityGate {
  name: string;
  type: 'security' | 'performance' | 'compatibility' | 'documentation' | 'testing';
  enabled: boolean;
  threshold: number;
  blocking: boolean;
  checks: QualityCheck[];
}

interface QualityCheck {
  name: string;
  type: 'static_analysis' | 'vulnerability_scan' | 'license_check' | 'performance_test';
  config: Record<string, any>;
  timeout: number;
  retries: number;
}

// Storage
const templates = new Map<string, PluginTemplate>();
const collections = new Map<string, TemplateCollection>();
const publishers = new Map<string, TemplatePublisher>();
const reviews = new Map<string, TemplateReview>();
const marketplace = new Map<string, TemplateMarketplace>();

// Initialize sample templates
const initializeSampleTemplates = () => {
  const sampleTemplates: PluginTemplate[] = [
    {
      id: 'backstage-node-service',
      name: 'Node.js Microservice',
      description: 'Production-ready Node.js microservice template with TypeScript, Express, and comprehensive tooling',
      category: 'backend',
      version: '2.1.0',
      author: {
        name: 'Backstage Team',
        email: 'team@backstage.io',
        organization: 'Spotify',
        avatar: '/avatars/backstage-team.png',
        website: 'https://backstage.io',
        github: 'backstage',
        bio: 'Official Backstage development team'
      },
      metadata: {
        displayName: 'Node.js Microservice Template',
        shortDescription: 'Enterprise-grade Node.js service with best practices built-in',
        tags: ['nodejs', 'typescript', 'express', 'microservice', 'rest-api'],
        keywords: ['backend', 'api', 'service', 'node', 'express', 'typescript'],
        difficulty: 'intermediate',
        estimatedTime: 30,
        license: 'Apache-2.0',
        maintainers: ['backstage-team'],
        contributors: ['nodejs-community', 'express-maintainers'],
        repository: 'https://github.com/backstage/software-templates',
        homepage: 'https://backstage.io/docs/features/software-templates',
        features: [
          'TypeScript support',
          'Express.js framework',
          'OpenAPI documentation',
          'Docker containerization', 
          'Kubernetes deployment',
          'Health checks',
          'Metrics collection',
          'Logging configuration',
          'Database integration',
          'Authentication middleware',
          'Input validation',
          'Error handling',
          'Testing setup',
          'CI/CD pipeline'
        ],
        requirements: [
          'Node.js 18+',
          'Docker',
          'Kubernetes cluster (optional)',
          'PostgreSQL/MySQL (optional)'
        ],
        limitations: [
          'Currently supports PostgreSQL and MySQL only',
          'Redis session store required for clustering'
        ],
        screenshots: [
          '/screenshots/node-service-overview.png',
          '/screenshots/node-service-api-docs.png'
        ],
        ratings: {
          average: 4.7,
          total: 124,
          distribution: { 5: 78, 4: 32, 3: 10, 2: 3, 1: 1 },
          reviews: []
        },
        usage: {
          downloads: 15420,
          installations: 8934,
          activeInstances: 3421,
          successRate: 94.2,
          averageSetupTime: 8.5,
          popularParameters: {
            'database': 85,
            'authentication': 72,
            'monitoring': 68
          },
          weeklyTrend: [120, 135, 142, 158, 164, 171, 189],
          monthlyTrend: [580, 612, 694, 748, 832, 901]
        }
      },
      structure: {
        type: 'microservice',
        architecture: {
          pattern: 'mvc',
          layers: [
            {
              name: 'Controllers',
              type: 'presentation',
              description: 'HTTP request handlers and route definitions',
              components: ['UserController', 'HealthController', 'MetricsController'],
              dependencies: ['Services', 'Middleware']
            },
            {
              name: 'Services',
              type: 'business',
              description: 'Business logic and domain operations',
              components: ['UserService', 'AuthService', 'NotificationService'],
              dependencies: ['Repositories', 'External APIs']
            },
            {
              name: 'Repositories',
              type: 'data',
              description: 'Data access and persistence layer',
              components: ['UserRepository', 'AuditRepository'],
              dependencies: ['Database', 'Cache']
            }
          ],
          modules: [
            {
              name: 'core',
              type: 'core',
              path: './src/core',
              description: 'Core application logic and configuration',
              exports: ['App', 'Config', 'Logger'],
              imports: ['express', 'helmet', 'cors']
            },
            {
              name: 'api',
              type: 'feature',
              path: './src/api',
              description: 'REST API endpoints and controllers',
              exports: ['UserRoutes', 'HealthRoutes'],
              imports: ['core', 'services']
            }
          ],
          integrations: [
            {
              name: 'database',
              type: 'database',
              protocol: 'postgresql',
              configuration: {
                host: 'localhost',
                port: 5432,
                ssl: true,
                poolSize: 20
              }
            },
            {
              name: 'cache',
              type: 'cache',
              protocol: 'redis',
              configuration: {
                host: 'localhost',
                port: 6379,
                ttl: 3600
              }
            }
          ]
        },
        framework: 'Express.js',
        language: 'TypeScript',
        buildTool: 'npm',
        packageManager: 'npm',
        testFramework: 'Jest',
        lintingTool: 'ESLint',
        formatting: 'Prettier',
        ci: ['GitHub Actions', 'Jenkins'],
        deployment: ['Docker', 'Kubernetes', 'Helm']
      },
      configuration: {
        backstage: {
          version: '1.20.0',
          requiredPlugins: ['@backstage/plugin-catalog', '@backstage/plugin-kubernetes'],
          optionalPlugins: ['@backstage/plugin-tech-insights'],
          catalog: {
            entities: [
              {
                type: 'Component',
                spec: {
                  type: 'service',
                  lifecycle: 'production',
                  owner: 'platform-team'
                }
              }
            ],
            processors: ['UrlReaderProcessor'],
            rules: [
              {
                allow: ['Component', 'System', 'API'],
                locations: [
                  {
                    type: 'url',
                    target: 'https://github.com/{{cookiecutter.github_repo}}/blob/main/catalog-info.yaml'
                  }
                ]
              }
            ]
          },
          techDocs: {
            builder: 'local',
            generator: 'techdocs',
            publisher: {
              type: 'local'
            }
          },
          scaffolder: {
            actions: [
              {
                name: 'catalog:register',
                handler: 'builtin:catalog:register'
              }
            ],
            templates: []
          }
        },
        environment: {
          variables: [
            {
              name: 'NODE_ENV',
              value: 'production',
              description: 'Node.js environment',
              required: true,
              sensitive: false
            },
            {
              name: 'PORT',
              value: '3000',
              description: 'HTTP server port',
              required: true,
              sensitive: false
            }
          ],
          secrets: [
            {
              name: 'DATABASE_URL',
              description: 'Database connection string',
              type: 'string'
            },
            {
              name: 'JWT_SECRET',
              description: 'JWT signing secret',
              type: 'string'
            }
          ],
          volumes: [],
          networking: {
            ports: [
              {
                name: 'http',
                port: 3000,
                targetPort: 3000,
                protocol: 'TCP'
              }
            ],
            ingress: [],
            services: [
              {
                name: 'api-service',
                type: 'ClusterIP',
                ports: [
                  {
                    name: 'http',
                    port: 3000,
                    targetPort: 3000,
                    protocol: 'TCP'
                  }
                ],
                selector: { app: '{{cookiecutter.service_name}}' }
              }
            ]
          },
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi'
            },
            limits: {
              cpu: '500m',
              memory: '512Mi'
            },
            scaling: {
              minReplicas: 2,
              maxReplicas: 10,
              metrics: [
                {
                  type: 'cpu',
                  target: 70
                }
              ]
            }
          }
        },
        build: {
          steps: [
            {
              name: 'install',
              command: 'npm',
              args: ['ci']
            },
            {
              name: 'build',
              command: 'npm',
              args: ['run', 'build']
            },
            {
              name: 'test',
              command: 'npm',
              args: ['test']
            }
          ],
          artifacts: [
            {
              name: 'app-bundle',
              type: 'docker',
              source: 'dist/',
              destination: '/app'
            }
          ],
          cache: {
            enabled: true,
            key: 'node-modules-${npm_package_version}',
            paths: ['node_modules/'],
            policy: 'pull-push'
          },
          optimization: {
            minification: true,
            compression: true,
            treeshaking: true,
            bundleSplitting: false,
            lazyLoading: false,
            codeAnalysis: true
          }
        },
        runtime: {
          platform: 'node',
          version: '18',
          entrypoint: 'dist/index.js',
          healthcheck: {
            enabled: true,
            path: '/health',
            port: 3000,
            interval: 30,
            timeout: 10,
            retries: 3,
            initialDelay: 15
          },
          lifecycle: {},
          logging: {
            level: 'info',
            format: 'json',
            output: [
              {
                type: 'stdout'
              }
            ],
            rotation: {
              enabled: false,
              maxSize: '100MB',
              maxFiles: 5,
              maxAge: '30d'
            }
          },
          metrics: {
            enabled: true,
            port: 9090,
            path: '/metrics',
            collectors: [
              {
                name: 'http_requests_total',
                type: 'counter',
                help: 'Total number of HTTP requests',
                labels: ['method', 'status_code']
              }
            ]
          }
        },
        security: {
          authentication: {
            required: true,
            providers: ['jwt', 'oauth2'],
            session: {
              timeout: 3600,
              cookieSecure: true,
              cookieSameSite: 'strict'
            },
            tokens: {
              issuer: 'backstage',
              algorithm: 'RS256',
              expiration: 3600,
              refresh: true
            }
          },
          authorization: {
            enabled: true,
            provider: 'rbac',
            policies: [
              {
                name: 'admin-access',
                effect: 'allow',
                actions: ['*'],
                resources: ['*'],
                conditions: []
              }
            ],
            rbac: {
              enabled: true,
              roles: [
                {
                  name: 'admin',
                  permissions: ['*']
                },
                {
                  name: 'user',
                  permissions: ['read']
                }
              ],
              bindings: []
            }
          },
          encryption: {
            inTransit: true,
            atRest: true,
            algorithm: 'AES-256-GCM',
            keyManagement: {
              provider: 'vault',
              rotation: true,
              rotationInterval: 86400
            }
          },
          scanning: {
            enabled: true,
            types: ['sast', 'sca', 'secrets'],
            schedule: '0 2 * * *',
            thresholds: [
              {
                type: 'vulnerability',
                severity: 'high',
                limit: 0
              }
            ]
          },
          compliance: {
            frameworks: ['SOC2', 'GDPR'],
            controls: [],
            reporting: {
              enabled: true,
              schedule: '0 0 1 * *',
              format: 'json',
              recipients: ['security@company.com']
            }
          }
        },
        monitoring: {
          metrics: true,
          traces: true,
          logs: true,
          alerts: [
            {
              name: 'high-error-rate',
              condition: 'error_rate > 0.05',
              severity: 'critical',
              threshold: 5,
              duration: '5m',
              notifications: [
                {
                  type: 'slack',
                  config: { channel: '#alerts' }
                }
              ]
            }
          ],
          dashboards: []
        },
        customization: {
          themes: [
            {
              name: 'default',
              colors: {
                primary: '#1976d2',
                secondary: '#dc004e'
              },
              fonts: {
                primary: 'Roboto',
                secondary: 'Helvetica',
                monospace: 'Consolas'
              }
            }
          ],
          branding: {
            logo: '/logo.png',
            favicon: '/favicon.ico',
            title: '{{cookiecutter.service_name}}',
            colors: {
              primary: '#1976d2',
              secondary: '#dc004e',
              accent: '#ff4081',
              background: '#fafafa',
              text: '#212121'
            }
          },
          ui: {
            navigation: {
              style: 'sidebar',
              collapsible: true,
              items: []
            },
            layout: {
              grid: {
                columns: 12,
                gap: '16px',
                container: '1200px'
              },
              spacing: {
                xs: '4px',
                sm: '8px',
                md: '16px',
                lg: '24px',
                xl: '32px'
              },
              breakpoints: {
                xs: 0,
                sm: 600,
                md: 960,
                lg: 1280,
                xl: 1920
              }
            },
            components: []
          },
          features: []
        }
      },
      parameters: [
        {
          name: 'service_name',
          type: 'string',
          title: 'Service Name',
          description: 'Name of the microservice (lowercase, hyphen-separated)',
          required: true,
          pattern: '^[a-z][a-z0-9-]*[a-z0-9]$',
          minLength: 3,
          maxLength: 50,
          group: 'basic',
          order: 1
        },
        {
          name: 'description',
          type: 'textarea',
          title: 'Description',
          description: 'Brief description of the service purpose',
          required: true,
          maxLength: 500,
          group: 'basic',
          order: 2
        },
        {
          name: 'port',
          type: 'integer',
          title: 'HTTP Port',
          description: 'Port number for the HTTP server',
          required: true,
          default: 3000,
          minimum: 1024,
          maximum: 65535,
          group: 'configuration',
          order: 3
        },
        {
          name: 'database',
          type: 'select',
          title: 'Database',
          description: 'Database technology to use',
          required: true,
          default: 'postgresql',
          enum: [
            { label: 'PostgreSQL', value: 'postgresql' },
            { label: 'MySQL', value: 'mysql' },
            { label: 'MongoDB', value: 'mongodb' },
            { label: 'None', value: 'none' }
          ],
          group: 'integrations',
          order: 4
        },
        {
          name: 'authentication',
          type: 'checkbox',
          title: 'Enable Authentication',
          description: 'Add JWT-based authentication middleware',
          required: false,
          default: true,
          group: 'security',
          order: 5
        },
        {
          name: 'monitoring',
          type: 'multiselect',
          title: 'Monitoring Tools',
          description: 'Select monitoring and observability tools',
          required: false,
          enum: [
            { label: 'Prometheus', value: 'prometheus' },
            { label: 'Jaeger', value: 'jaeger' },
            { label: 'Grafana', value: 'grafana' },
            { label: 'ELK Stack', value: 'elk' }
          ],
          group: 'monitoring',
          order: 6
        }
      ],
      files: [
        {
          path: 'package.json',
          type: 'template',
          content: `{
  "name": "{{cookiecutter.service_name}}",
  "version": "1.0.0",
  "description": "{{cookiecutter.description}}",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"{% if cookiecutter.database == 'postgresql' %},
    "pg": "^8.11.3",
    "typeorm": "^0.3.17"{% endif %}{% if cookiecutter.authentication %},
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1"{% endif %}{% if 'prometheus' in cookiecutter.monitoring %},
    "prom-client": "^15.0.0"{% endif %}
  },
  "devDependencies": {
    "@types/node": "^20.5.0",
    "@types/express": "^4.17.17",
    "typescript": "^5.1.6",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.6.2",
    "@types/jest": "^29.5.4",
    "eslint": "^8.47.0",
    "prettier": "^3.0.1"
  }
}`,
          templating: {
            engine: 'jinja2',
            delimiters: {
              start: '{{',
              end: '}}'
            },
            helpers: [],
            partials: [],
            globals: {}
          },
          conditions: []
        },
        {
          path: 'src/index.ts',
          type: 'template',
          content: `import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
{% if cookiecutter.monitoring %}
import { register } from 'prom-client';
{% endif %}

dotenv.config();

const app = express();
const PORT = process.env.PORT || {{cookiecutter.port}};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

{% if 'prometheus' in cookiecutter.monitoring %}
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
{% endif %}

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
          templating: {
            engine: 'jinja2',
            delimiters: {
              start: '{{',
              end: '}}'
            },
            helpers: [],
            partials: [],
            globals: {}
          },
          conditions: []
        },
        {
          path: 'Dockerfile',
          type: 'template',
          content: `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE {{cookiecutter.port}}

USER node

CMD ["node", "dist/index.js"]`,
          templating: {
            engine: 'jinja2',
            delimiters: {
              start: '{{',
              end: '}}'
            },
            helpers: [],
            partials: [],
            globals: {}
          },
          conditions: []
        }
      ],
      dependencies: [
        {
          name: 'express',
          type: 'npm',
          version: '^4.18.2',
          scope: 'runtime',
          license: 'MIT',
          description: 'Fast, unopinionated, minimalist web framework for Node.js'
        },
        {
          name: 'typescript',
          type: 'npm',
          version: '^5.1.6',
          scope: 'development',
          license: 'Apache-2.0',
          description: 'TypeScript compiler'
        }
      ],
      hooks: {
        postGenerate: [
          {
            name: 'install-dependencies',
            script: 'npm install',
            workingDirectory: '{{cookiecutter.service_name}}',
            timeout: 300000
          },
          {
            name: 'initial-build',
            script: 'npm run build',
            workingDirectory: '{{cookiecutter.service_name}}',
            timeout: 120000
          }
        ]
      },
      documentation: {
        readme: `# {{cookiecutter.service_name}}

{{cookiecutter.description}}

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## API Documentation

The service provides RESTful APIs documented with OpenAPI/Swagger.

### Endpoints

- \`GET /health\` - Health check endpoint
{% if 'prometheus' in cookiecutter.monitoring %}- \`GET /metrics\` - Prometheus metrics{% endif %}

## Configuration

Environment variables:
- \`PORT\` - HTTP server port (default: {{cookiecutter.port}})
- \`NODE_ENV\` - Environment (development/production)
{% if cookiecutter.database != 'none' %}- \`DATABASE_URL\` - Database connection string{% endif %}

## Testing

\`\`\`bash
npm test
\`\`\`

## Deployment

### Docker

\`\`\`bash
docker build -t {{cookiecutter.service_name}} .
docker run -p {{cookiecutter.port}}:{{cookiecutter.port}} {{cookiecutter.service_name}}
\`\`\`

### Kubernetes

See \`k8s/\` directory for deployment manifests.`,
        tutorials: [
          {
            title: 'Getting Started',
            description: 'Learn how to set up and run your first microservice',
            difficulty: 'beginner',
            duration: 15,
            prerequisites: ['Node.js 18+', 'npm or yarn'],
            steps: [
              {
                title: 'Install Dependencies',
                description: 'Install the required npm packages',
                code: 'npm install'
              },
              {
                title: 'Start Development Server',
                description: 'Start the service in development mode',
                code: 'npm run dev'
              },
              {
                title: 'Test the Service',
                description: 'Verify the service is running by calling the health endpoint',
                code: 'curl http://localhost:{{cookiecutter.port}}/health'
              }
            ],
            resources: []
          }
        ],
        guides: [],
        references: [],
        multimedia: []
      },
      examples: [
        {
          name: 'Basic API Service',
          description: 'Simple REST API with health checks',
          parameters: {
            service_name: 'user-service',
            description: 'User management microservice',
            port: 3000,
            database: 'postgresql',
            authentication: true,
            monitoring: ['prometheus']
          },
          expectedOutput: {
            files: ['package.json', 'src/index.ts', 'Dockerfile', 'README.md'],
            structure: 'Node.js microservice with Express.js',
            demo: 'https://demo.example.com/user-service'
          },
          validation: [
            {
              type: 'build',
              command: 'npm run build',
              expectedExitCode: 0,
              timeout: 60000
            },
            {
              type: 'test',
              command: 'npm test',
              expectedExitCode: 0,
              timeout: 30000
            }
          ]
        }
      ],
      testing: {
        unit: {
          framework: 'jest',
          coverage: {
            threshold: 80,
            exclude: ['dist/', 'node_modules/'],
            reporters: ['text', 'lcov'],
            directory: 'coverage'
          },
          patterns: ['**/*.test.ts', '**/*.spec.ts'],
          setup: ['jest.setup.ts'],
          teardown: [],
          mocks: []
        },
        integration: {
          services: [
            {
              name: 'postgres',
              image: 'postgres:15-alpine',
              environment: {
                POSTGRES_DB: 'testdb',
                POSTGRES_USER: 'test',
                POSTGRES_PASSWORD: 'test'
              },
              ports: [5432],
              healthcheck: 'pg_isready -U test -d testdb',
              dependsOn: []
            }
          ],
          fixtures: [],
          scenarios: []
        },
        e2e: {
          browser: {
            type: 'chrome',
            headless: true,
            viewport: {
              width: 1280,
              height: 720,
              deviceScaleFactor: 1
            },
            timeout: 30000
          },
          pages: [],
          tests: []
        },
        performance: {
          load: {
            scenarios: [
              {
                name: 'health-check-load',
                users: 100,
                duration: '2m',
                rampUp: '30s',
                script: 'k6/health-check.js'
              }
            ],
            metrics: [],
            thresholds: []
          },
          stress: {
            maxUsers: 1000,
            rampUpStep: 50,
            rampUpDuration: '30s',
            sustainDuration: '5m',
            breakingPoint: {
              errorRate: 0.01,
              responseTime: 1000,
              throughput: 500
            }
          },
          endurance: {
            duration: '1h',
            users: 50,
            memoryThreshold: 90,
            cpuThreshold: 80,
            diskThreshold: 90
          }
        },
        security: {
          sast: {
            tools: ['semgrep', 'codeql'],
            rules: ['security'],
            exclude: ['node_modules/', 'dist/'],
            severity: 'high'
          },
          dast: {
            targets: ['http://localhost:3000'],
            authentication: {
              type: 'basic',
              credentials: { username: 'test', password: 'test' }
            },
            scans: []
          },
          dependency: {
            databases: ['npm-audit', 'snyk'],
            failOnCVSS: 7.0,
            skipTestScope: true
          },
          secrets: {
            patterns: ['password', 'secret', 'key'],
            whitelist: [],
            entropy: true
          }
        }
      },
      deployment: {
        environments: [
          {
            name: 'development',
            type: 'development',
            config: {
              replicas: 1,
              resources: {
                cpu: '100m',
                memory: '128Mi'
              },
              networking: {
                ports: [
                  {
                    name: 'http',
                    port: 3000,
                    targetPort: 3000,
                    protocol: 'TCP'
                  }
                ],
                ingress: [],
                services: []
              },
              storage: [],
              secrets: [],
              configMaps: []
            }
          }
        ],
        strategies: [
          {
            name: 'rolling',
            type: 'rolling',
            config: {
              maxUnavailable: '25%',
              maxSurge: '25%'
            }
          }
        ],
        automation: {
          ci: {
            triggers: [
              {
                type: 'push',
                branches: ['main', 'develop']
              }
            ],
            pipeline: {
              stages: [
                {
                  name: 'build',
                  jobs: [
                    {
                      name: 'build-and-test',
                      image: 'node:18-alpine',
                      script: ['npm ci', 'npm run build', 'npm test']
                    }
                  ]
                }
              ],
              cache: {
                key: 'node-modules-${npm_package_version}',
                paths: ['node_modules/'],
                policy: 'pull-push'
              },
              artifacts: {
                name: 'build-artifacts',
                paths: ['dist/'],
                when: 'on_success',
                expire: '1 week'
              }
            }
          },
          cd: {
            environments: [
              {
                name: 'development',
                deploymentStrategy: 'rolling',
                triggers: [
                  {
                    type: 'automatic'
                  }
                ],
                variables: {}
              }
            ],
            approvals: []
          },
          gitOps: {
            enabled: false,
            repository: '',
            path: '',
            branch: 'main',
            syncPolicy: {
              automated: false,
              prune: false,
              selfHeal: false,
              syncOptions: []
            }
          }
        },
        monitoring: {
          healthChecks: [
            {
              name: 'http-health',
              type: 'http',
              config: {
                url: '/health',
                expectedStatus: 200
              },
              interval: '30s',
              timeout: '10s',
              retries: 3
            }
          ],
          alerts: [],
          rollback: {
            automatic: true,
            conditions: [
              {
                metric: 'error_rate',
                operator: '>',
                threshold: 0.1,
                duration: '5m'
              }
            ],
            strategy: 'previous_version'
          }
        }
      },
      created: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
      updated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
    }
  ];

  sampleTemplates.forEach(template => {
    templates.set(template.id, template);
  });

  // Create sample publishers
  const samplePublishers: TemplatePublisher[] = [
    {
      id: 'backstage-official',
      name: 'Backstage Official',
      type: 'verified',
      avatar: '/avatars/backstage-team.png',
      bio: 'Official templates from the Backstage development team',
      website: 'https://backstage.io',
      social: {
        github: 'backstage',
        twitter: 'backstageio'
      },
      verification: {
        verified: true,
        badges: ['official', 'trusted'],
        certifications: ['security-reviewed'],
        verifiedAt: new Date().toISOString()
      },
      statistics: {
        totalTemplates: 12,
        totalDownloads: 45678,
        averageRating: 4.8,
        followers: 1234
      },
      templates: ['backstage-node-service']
    }
  ];

  samplePublishers.forEach(publisher => {
    publishers.set(publisher.id, publisher);
  });
};

// Initialize sample data
initializeSampleTemplates();

// Generate template from parameters
const generateFromTemplate = async (
  templateId: string,
  parameters: Record<string, any>
): Promise<{ files: Array<{ path: string; content: string }>, success: boolean }> => {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const generatedFiles: Array<{ path: string; content: string }> = [];

  // Process template files
  for (const file of template.files) {
    if (file.type === 'template' && file.content) {
      // Simple template processing (in production, use proper template engine)
      let content = file.content;
      
      // Replace cookiecutter variables
      Object.entries(parameters).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*cookiecutter\\.${key}\\s*}}`, 'g');
        content = content.replace(regex, String(value));
      });

      // Process conditional blocks (simplified)
      if (parameters.database) {
        content = content.replace(/{% if cookiecutter\.database == '([^']+)' %}(.*?){% endif %}/gs, 
          (match, dbType, block) => parameters.database === dbType ? block : '');
      }

      if (parameters.authentication) {
        content = content.replace(/{% if cookiecutter\.authentication %}(.*?){% endif %}/gs, 
          (match, block) => parameters.authentication ? block : '');
      }

      if (parameters.monitoring) {
        content = content.replace(/{% if '([^']+)' in cookiecutter\.monitoring %}(.*?){% endif %}/gs, 
          (match, tool, block) => {
            const monitoringArray = Array.isArray(parameters.monitoring) ? parameters.monitoring : [parameters.monitoring];
            return monitoringArray.includes(tool) ? block : '';
          });
      }

      generatedFiles.push({
        path: file.path.replace(/{{cookiecutter\.([^}]+)}}/g, (match, key) => String(parameters[key] || '')),
        content
      });
    } else if (file.type === 'static' && file.content) {
      generatedFiles.push({
        path: file.path,
        content: file.content
      });
    }
  }

  return { files: generatedFiles, success: true };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const template: PluginTemplate = {
          id: crypto.randomBytes(16).toString('hex'),
          name: body.name,
          description: body.description,
          category: body.category || 'custom',
          version: body.version || '1.0.0',
          author: body.author,
          metadata: body.metadata || {
            displayName: body.name,
            shortDescription: body.description,
            tags: [],
            keywords: [],
            difficulty: 'beginner',
            estimatedTime: 30,
            license: 'MIT',
            maintainers: [],
            contributors: [],
            features: [],
            requirements: [],
            ratings: {
              average: 0,
              total: 0,
              distribution: {},
              reviews: []
            },
            usage: {
              downloads: 0,
              installations: 0,
              activeInstances: 0,
              successRate: 0,
              averageSetupTime: 0,
              popularParameters: {},
              weeklyTrend: [],
              monthlyTrend: []
            }
          },
          structure: body.structure,
          configuration: body.configuration,
          parameters: body.parameters || [],
          files: body.files || [],
          dependencies: body.dependencies || [],
          hooks: body.hooks || {},
          documentation: body.documentation || { readme: '' },
          examples: body.examples || [],
          testing: body.testing,
          deployment: body.deployment,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        templates.set(template.id, template);

        return NextResponse.json({
          success: true,
          template
        });
      }

      case 'update': {
        const { id, ...updates } = body;
        const template = templates.get(id);

        if (!template) {
          return NextResponse.json({
            success: false,
            error: 'Template not found'
          }, { status: 404 });
        }

        Object.assign(template, updates, {
          updated: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          template
        });
      }

      case 'generate': {
        const { templateId, parameters } = body;
        
        const result = await generateFromTemplate(templateId, parameters);

        return NextResponse.json({
          success: result.success,
          files: result.files,
          templateId,
          parameters
        });
      }

      case 'review': {
        const { templateId, rating, title, comment } = body;
        const template = templates.get(templateId);

        if (!template) {
          return NextResponse.json({
            success: false,
            error: 'Template not found'
          }, { status: 404 });
        }

        const review: TemplateReview = {
          id: crypto.randomBytes(8).toString('hex'),
          userId: 'user-' + crypto.randomBytes(4).toString('hex'),
          username: `user${Math.floor(Math.random() * 1000)}`,
          rating,
          title,
          comment,
          helpful: 0,
          unhelpful: 0,
          verified: false,
          created: new Date().toISOString()
        };

        template.metadata.ratings.reviews.push(review);
        template.metadata.ratings.total += 1;
        template.metadata.ratings.distribution[rating] = (template.metadata.ratings.distribution[rating] || 0) + 1;
        
        // Recalculate average
        const totalStars = Object.entries(template.metadata.ratings.distribution)
          .reduce((sum, [stars, count]) => sum + (parseInt(stars) * count), 0);
        template.metadata.ratings.average = totalStars / template.metadata.ratings.total;

        reviews.set(review.id, review);

        return NextResponse.json({
          success: true,
          review
        });
      }

      case 'create_collection': {
        const collection: TemplateCollection = {
          id: crypto.randomBytes(8).toString('hex'),
          name: body.name,
          description: body.description,
          curator: body.curator || 'anonymous',
          templates: body.templates || [],
          tags: body.tags || [],
          featured: body.featured || false,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        collections.set(collection.id, collection);

        return NextResponse.json({
          success: true,
          collection
        });
      }

      case 'publish': {
        const { templateId, publisherId } = body;
        const template = templates.get(templateId);
        const publisher = publishers.get(publisherId);

        if (!template) {
          return NextResponse.json({
            success: false,
            error: 'Template not found'
          }, { status: 404 });
        }

        if (!publisher) {
          return NextResponse.json({
            success: false,
            error: 'Publisher not found'
          }, { status: 404 });
        }

        // Add template to publisher's collection
        if (!publisher.templates.includes(templateId)) {
          publisher.templates.push(templateId);
          publisher.statistics.totalTemplates += 1;
        }

        return NextResponse.json({
          success: true,
          message: 'Template published successfully'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Plugin template error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process template request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const publisherId = searchParams.get('publisher');
    const sort = searchParams.get('sort') || 'popularity';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (id) {
      const template = templates.get(id);
      if (!template) {
        return NextResponse.json({
          success: false,
          error: 'Template not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        template
      });
    }

    let templateList = Array.from(templates.values());

    // Apply filters
    if (category && category !== 'all') {
      templateList = templateList.filter(t => t.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      templateList = templateList.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.metadata.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        t.metadata.keywords.some(keyword => keyword.toLowerCase().includes(searchLower))
      );
    }

    if (publisherId) {
      const publisher = publishers.get(publisherId);
      if (publisher) {
        templateList = templateList.filter(t => publisher.templates.includes(t.id));
      }
    }

    // Apply sorting
    switch (sort) {
      case 'popularity':
        templateList.sort((a, b) => b.metadata.usage.downloads - a.metadata.usage.downloads);
        break;
      case 'rating':
        templateList.sort((a, b) => b.metadata.ratings.average - a.metadata.ratings.average);
        break;
      case 'newest':
        templateList.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        break;
      case 'updated':
        templateList.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
        break;
      case 'name':
        templateList.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // Apply pagination
    const total = templateList.length;
    templateList = templateList.slice(offset, offset + limit);

    // Get additional data
    const categoriesCount = Array.from(templates.values()).reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const featuredTemplates = Array.from(templates.values())
      .sort((a, b) => b.metadata.ratings.average - a.metadata.ratings.average)
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      templates: templateList,
      total,
      offset,
      limit,
      categories: Object.entries(categoriesCount).map(([category, count]) => ({
        category,
        count
      })),
      featured: featuredTemplates,
      publishers: Array.from(publishers.values()),
      collections: Array.from(collections.values())
    });

  } catch (error) {
    console.error('Plugin template GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch template data'
    }, { status: 500 });
  }
}