export interface CommunicationConfig {
  defaultChannel: NotificationChannel;
  retryAttempts: number;
  retryDelay: number;
  deliveryTimeout: number;
  batchSize: number;
  aggregationWindow: number;
  rateLimits: ChannelRateLimits;
  channels: ChannelConfigs;
  ai: {
    enabled: boolean;
    confidenceThreshold: number;
    learningRate: number;
    aggregationModel: string;
    routingModel: string;
  };
  analytics: {
    enabled: boolean;
    trackingDuration: number;
    metricsRetention: number;
  };
}

export interface ChannelRateLimits {
  [channel: string]: {
    requestsPerMinute: number;
    burstLimit: number;
    concurrentRequests: number;
  };
}

export interface ChannelConfigs {
  slack: SlackConfig;
  teams: TeamsConfig;
  email: EmailConfig;
  sms: SmsConfig;
  webhook: WebhookConfig;
  push: PushConfig;
  discord: DiscordConfig;
}

export interface SlackConfig {
  enabled: boolean;
  botToken: string;
  signingSecret: string;
  defaultChannel: string;
  threadReplies: boolean;
  maxMessageLength: number;
  rateLimitPerMinute: number;
}

export interface TeamsConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
  tenantId: string;
  defaultTeam: string;
  maxMessageLength: number;
  rateLimitPerMinute: number;
}

export interface EmailConfig {
  enabled: boolean;
  provider: 'sendgrid' | 'ses' | 'mailgun' | 'postmark';
  apiKey: string;
  fromAddress: string;
  fromName: string;
  replyTo: string;
  templates: {
    base: string;
    notification: string;
    digest: string;
    alert: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export interface SmsConfig {
  enabled: boolean;
  provider: 'twilio' | 'aws-sns' | 'nexmo';
  apiKey: string;
  apiSecret?: string;
  fromNumber: string;
  maxMessageLength: number;
}

export interface WebhookConfig {
  enabled: boolean;
  timeout: number;
  retries: number;
  security: {
    signRequests: boolean;
    secretKey: string;
    algorithm: 'sha256' | 'sha512';
  };
}

export interface PushConfig {
  enabled: boolean;
  firebase: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  };
  apns: {
    keyId: string;
    teamId: string;
    privateKey: string;
    production: boolean;
  };
}

export interface DiscordConfig {
  enabled: boolean;
  botToken: string;
  defaultGuild: string;
  defaultChannel: string;
  maxMessageLength: number;
}

export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  TEAMS = 'teams',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  PUSH = 'push',
  DISCORD = 'discord'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

export enum NotificationType {
  ALERT = 'alert',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
  DIGEST = 'digest',
  MARKETING = 'marketing',
  SYSTEM = 'system'
}

export const DEFAULT_CONFIG: CommunicationConfig = {
  defaultChannel: NotificationChannel.EMAIL,
  retryAttempts: 3,
  retryDelay: 1000,
  deliveryTimeout: 30000,
  batchSize: 100,
  aggregationWindow: 300000, // 5 minutes
  rateLimits: {
    email: { requestsPerMinute: 100, burstLimit: 200, concurrentRequests: 10 },
    slack: { requestsPerMinute: 50, burstLimit: 100, concurrentRequests: 5 },
    teams: { requestsPerMinute: 30, burstLimit: 60, concurrentRequests: 3 },
    sms: { requestsPerMinute: 10, burstLimit: 20, concurrentRequests: 2 },
    webhook: { requestsPerMinute: 200, burstLimit: 400, concurrentRequests: 20 },
    push: { requestsPerMinute: 500, burstLimit: 1000, concurrentRequests: 50 },
    discord: { requestsPerMinute: 40, burstLimit: 80, concurrentRequests: 4 }
  },
  channels: {
    slack: {
      enabled: false,
      botToken: '',
      signingSecret: '',
      defaultChannel: '#general',
      threadReplies: true,
      maxMessageLength: 3000,
      rateLimitPerMinute: 50
    },
    teams: {
      enabled: false,
      appId: '',
      appSecret: '',
      tenantId: '',
      defaultTeam: '',
      maxMessageLength: 2000,
      rateLimitPerMinute: 30
    },
    email: {
      enabled: true,
      provider: 'sendgrid',
      apiKey: '',
      fromAddress: 'noreply@example.com',
      fromName: 'SaaS IDP Platform',
      replyTo: 'support@example.com',
      templates: {
        base: 'base-template',
        notification: 'notification-template',
        digest: 'digest-template',
        alert: 'alert-template'
      }
    },
    sms: {
      enabled: false,
      provider: 'twilio',
      apiKey: '',
      fromNumber: '',
      maxMessageLength: 160
    },
    webhook: {
      enabled: true,
      timeout: 10000,
      retries: 3,
      security: {
        signRequests: true,
        secretKey: '',
        algorithm: 'sha256'
      }
    },
    push: {
      enabled: false,
      firebase: {
        projectId: '',
        privateKey: '',
        clientEmail: ''
      },
      apns: {
        keyId: '',
        teamId: '',
        privateKey: '',
        production: false
      }
    },
    discord: {
      enabled: false,
      botToken: '',
      defaultGuild: '',
      defaultChannel: '',
      maxMessageLength: 2000
    }
  },
  ai: {
    enabled: true,
    confidenceThreshold: 0.8,
    learningRate: 0.01,
    aggregationModel: 'notification-aggregation-v1',
    routingModel: 'notification-routing-v1'
  },
  analytics: {
    enabled: true,
    trackingDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
    metricsRetention: 90 * 24 * 60 * 60 * 1000 // 90 days
  }
};