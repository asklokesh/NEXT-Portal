export interface TemplateParameter {
  name: string;
  title: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: any;
  enum?: string[];
  pattern?: string;
  required?: boolean;
  ui?: {
    widget?: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number' | 'password' | 'email' | 'url';
    placeholder?: string;
    help?: string;
    rows?: number;
    autofocus?: boolean;
  };
}

export interface TemplateStep {
  id: string;
  name: string;
  action: string;
  input?: Record<string, any>;
  if?: string;
}

export interface TemplateMetadata {
  name: string;
  title: string;
  description: string;
  tags?: string[];
  links?: Array<{
    url: string;
    title?: string;
    icon?: string;
  }>;
}

export interface TemplateSpec {
  type: string;
  lifecycle?: string;
  owner: string;
  parameters: {
    required?: string[];
    properties: Record<string, TemplateParameter>;
  };
  steps: TemplateStep[];
  output?: {
    links?: Array<{
      title: string;
      url: string;
      icon?: string;
    }>;
    text?: string[];
  };
}

export interface SoftwareTemplate {
  apiVersion: string;
  kind: 'Template';
  metadata: TemplateMetadata;
  spec: TemplateSpec;
}

export interface TemplateExecution {
  id: string;
  templateRef: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  parameters: Record<string, any>;
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    output?: any;
    error?: string;
  }>;
  output?: {
    entityRef?: string;
    remoteUrl?: string;
    links?: Array<{ title: string; url: string }>;
  };
}

export interface TemplateAction {
  id: string;
  description?: string;
  examples?: Array<{
    description: string;
    example: string;
  }>;
  schema?: {
    input?: Record<string, any>;
    output?: Record<string, any>;
  };
}

export interface TemplateFilter {
  tags?: string[];
  owner?: string;
  type?: string;
  lifecycle?: string;
  search?: string;
}