// Data Pipeline Templates for Common ETL Patterns

import { 
  DataPipelineConfig, 
  PipelineType, 
  SourceType, 
  DestinationType,
  TransformationType,
  QualityCheckType,
  WriteMode 
} from './types';

export class PipelineTemplateEngine {
  /**
   * Generate template for database to data warehouse ETL
   */
  static databaseToWarehouse(config: DatabaseToWarehouseConfig): DataPipelineConfig {
    return {
      id: `db_to_warehouse_${config.tableName}`,
      name: `${config.tableName} Database to Warehouse ETL`,
      description: `Extract data from ${config.sourceDatabase} table ${config.tableName} and load to ${config.targetWarehouse}`,
      type: PipelineType.BATCH,
      schedule: {
        type: 'cron',
        expression: config.schedule || '0 2 * * *', // Default: 2 AM daily
        timezone: 'UTC',
        enabled: true
      },
      sources: [{
        id: 'source_db',
        type: SourceType.DATABASE,
        connection: config.sourceConnection,
        schema: config.sourceSchema
      }],
      destinations: [{
        id: 'target_warehouse',
        type: config.targetWarehouse as DestinationType,
        connection: config.targetConnection,
        writeMode: config.writeMode || WriteMode.OVERWRITE,
        schema: config.targetSchema || config.sourceSchema
      }],
      transformations: [
        {
          id: 'data_cleaning',
          name: 'Data Cleaning and Validation',
          type: TransformationType.SQL,
          config: {
            query: this.generateCleaningSQL(config.tableName)
          }
        },
        {
          id: 'business_logic',
          name: 'Business Logic Transformation',
          type: TransformationType.SQL,
          config: {
            query: config.transformationSQL || `SELECT * FROM ${config.tableName}`
          }
        }
      ],
      qualityChecks: [
        {
          id: 'row_count_check',
          name: 'Row Count Validation',
          type: QualityCheckType.ROW_COUNT,
          config: {
            table: config.tableName,
            threshold: 0,
            operator: 'gt'
          },
          severity: 'error',
          enabled: true
        },
        {
          id: 'freshness_check',
          name: 'Data Freshness Check',
          type: QualityCheckType.FRESHNESS,
          config: {
            table: config.tableName,
            threshold: 24, // 24 hours
            operator: 'lt'
          },
          severity: 'warning',
          enabled: true
        }
      ],
      metadata: {
        owner: config.owner,
        team: config.team,
        tags: ['etl', 'database', 'warehouse'],
        sla: {
          expectedRuntime: 30,
          maxRetries: 3,
          alertOnFailure: true,
          alertOnDelay: true
        },
        contacts: config.contacts || [],
        criticality: config.criticality || 'medium'
      }
    };
  }

  /**
   * Generate template for API to data lake ingestion
   */
  static apiToDataLake(config: APIToDataLakeConfig): DataPipelineConfig {
    return {
      id: `api_to_lake_${config.apiName}`,
      name: `${config.apiName} API to Data Lake`,
      description: `Extract data from ${config.apiName} API and store in data lake`,
      type: PipelineType.BATCH,
      schedule: {
        type: config.frequency === 'realtime' ? 'interval' : 'cron',
        expression: config.schedule,
        interval: config.frequency === 'realtime' ? 300000 : undefined, // 5 minutes
        timezone: 'UTC',
        enabled: true
      },
      sources: [{
        id: 'api_source',
        type: SourceType.API,
        connection: {
          host: config.apiEndpoint,
          parameters: {
            method: config.method || 'GET',
            headers: config.headers || {},
            pagination: config.paginationConfig
          }
        }
      }],
      destinations: [{
        id: 'data_lake',
        type: DestinationType.DATA_LAKE,
        connection: config.dataLakeConnection,
        writeMode: WriteMode.APPEND,
        partitioning: {
          type: 'range',
          fields: ['date', 'hour'],
          strategy: 'hive'
        }
      }],
      transformations: [
        {
          id: 'json_flattening',
          name: 'JSON Data Flattening',
          type: TransformationType.PYTHON,
          config: {
            script: this.generateJSONFlattening()
          }
        },
        {
          id: 'data_enrichment',
          name: 'Data Enrichment',
          type: TransformationType.PYTHON,
          config: {
            script: config.enrichmentScript || 'pass'
          }
        }
      ],
      qualityChecks: [
        {
          id: 'schema_validation',
          name: 'API Response Schema Validation',
          type: QualityCheckType.SCHEMA_VALIDATION,
          config: {
            expectedSchema: config.expectedSchema
          },
          severity: 'error',
          enabled: true
        }
      ],
      metadata: {
        owner: config.owner,
        team: config.team,
        tags: ['api', 'ingestion', 'data-lake'],
        sla: {
          expectedRuntime: 15,
          maxRetries: 5,
          alertOnFailure: true,
          alertOnDelay: false
        },
        contacts: config.contacts || [],
        criticality: config.criticality || 'low'
      }
    };
  }

  /**
   * Generate template for real-time streaming pipeline
   */
  static kafkaStreaming(config: KafkaStreamingConfig): DataPipelineConfig {
    return {
      id: `streaming_${config.topicName}`,
      name: `${config.topicName} Streaming Pipeline`,
      description: `Real-time processing of ${config.topicName} Kafka topic`,
      type: PipelineType.STREAMING,
      schedule: {
        type: 'event',
        enabled: true
      },
      sources: [{
        id: 'kafka_source',
        type: SourceType.KAFKA,
        connection: config.kafkaConnection,
        schema: config.schema,
        watermarks: {
          field: config.timestampField || 'timestamp',
          strategy: 'bounded',
          allowedLateness: config.allowedLateness || 5000,
          idleTimeout: 60000
        }
      }],
      destinations: config.destinations.map((dest, index) => ({
        id: `destination_${index}`,
        type: dest.type as DestinationType,
        connection: dest.connection,
        writeMode: WriteMode.APPEND
      })),
      transformations: [
        {
          id: 'stream_processing',
          name: 'Stream Processing Logic',
          type: TransformationType.FLINK_SQL,
          config: {
            query: config.processingSQL
          }
        },
        {
          id: 'windowing',
          name: 'Time Window Aggregations',
          type: TransformationType.FLINK_SQL,
          config: {
            query: this.generateWindowingSQL(config.windowSize || '5 MINUTE')
          }
        }
      ],
      qualityChecks: [
        {
          id: 'latency_check',
          name: 'Processing Latency Check',
          type: QualityCheckType.CUSTOM_SQL,
          config: {
            query: 'SELECT MAX(processing_time - event_time) as latency FROM stream',
            threshold: config.maxLatency || 1000,
            operator: 'lt'
          },
          severity: 'warning',
          enabled: true
        }
      ],
      metadata: {
        owner: config.owner,
        team: config.team,
        tags: ['streaming', 'kafka', 'real-time'],
        sla: {
          expectedRuntime: -1, // Continuous
          maxRetries: 10,
          alertOnFailure: true,
          alertOnDelay: false
        },
        contacts: config.contacts || [],
        criticality: config.criticality || 'high'
      }
    };
  }

  /**
   * Generate template for data quality monitoring pipeline
   */
  static dataQualityMonitoring(config: DataQualityConfig): DataPipelineConfig {
    return {
      id: `quality_monitor_${config.datasetName}`,
      name: `${config.datasetName} Quality Monitoring`,
      description: `Monitor data quality for ${config.datasetName}`,
      type: PipelineType.BATCH,
      schedule: {
        type: 'cron',
        expression: config.schedule || '0 */4 * * *', // Every 4 hours
        timezone: 'UTC',
        enabled: true
      },
      sources: [{
        id: 'monitored_dataset',
        type: config.sourceType as SourceType,
        connection: config.sourceConnection,
        schema: config.schema
      }],
      destinations: [{
        id: 'quality_results',
        type: DestinationType.DATABASE,
        connection: config.resultsConnection,
        writeMode: WriteMode.APPEND
      }],
      transformations: [
        {
          id: 'profiling',
          name: 'Data Profiling',
          type: TransformationType.PYTHON,
          config: {
            script: this.generateProfilingScript()
          }
        }
      ],
      qualityChecks: config.qualityRules.map((rule, index) => ({
        id: `quality_rule_${index}`,
        name: rule.name,
        type: rule.type as QualityCheckType,
        config: rule.config,
        severity: rule.severity || 'warning',
        enabled: true
      })),
      metadata: {
        owner: config.owner,
        team: config.team,
        tags: ['data-quality', 'monitoring'],
        sla: {
          expectedRuntime: 20,
          maxRetries: 2,
          alertOnFailure: true,
          alertOnDelay: true
        },
        contacts: config.contacts || [],
        criticality: 'high'
      }
    };
  }

  /**
   * Generate template for machine learning feature pipeline
   */
  static mlFeaturePipeline(config: MLFeatureConfig): DataPipelineConfig {
    return {
      id: `ml_features_${config.featureSetName}`,
      name: `${config.featureSetName} Feature Pipeline`,
      description: `Generate ML features for ${config.featureSetName}`,
      type: config.isRealTime ? PipelineType.STREAMING : PipelineType.BATCH,
      schedule: {
        type: config.isRealTime ? 'event' : 'cron',
        expression: config.schedule || '0 1 * * *',
        timezone: 'UTC',
        enabled: true
      },
      sources: config.dataSources.map((source, index) => ({
        id: `source_${index}`,
        type: source.type as SourceType,
        connection: source.connection,
        schema: source.schema
      })),
      destinations: [{
        id: 'feature_store',
        type: DestinationType.DATABASE,
        connection: config.featureStoreConnection,
        writeMode: WriteMode.UPSERT
      }],
      transformations: [
        {
          id: 'feature_engineering',
          name: 'Feature Engineering',
          type: TransformationType.PYTHON,
          config: {
            script: config.featureScript
          }
        },
        {
          id: 'feature_validation',
          name: 'Feature Validation',
          type: TransformationType.PYTHON,
          config: {
            script: this.generateFeatureValidation()
          }
        }
      ],
      qualityChecks: [
        {
          id: 'feature_drift',
          name: 'Feature Drift Detection',
          type: QualityCheckType.GREAT_EXPECTATIONS,
          config: {
            expectation: 'expect_column_values_to_be_between',
            column: 'feature_value',
            min_value: config.expectedRange?.min,
            max_value: config.expectedRange?.max
          },
          severity: 'warning',
          enabled: true
        }
      ],
      metadata: {
        owner: config.owner,
        team: config.team,
        tags: ['ml', 'features', 'machine-learning'],
        sla: {
          expectedRuntime: config.isRealTime ? -1 : 45,
          maxRetries: 3,
          alertOnFailure: true,
          alertOnDelay: true
        },
        contacts: config.contacts || [],
        criticality: 'high'
      }
    };
  }

  /**
   * Generate SQL for data cleaning
   */
  private static generateCleaningSQL(tableName: string): string {
    return `
      SELECT 
        *,
        CASE 
          WHEN created_at IS NULL THEN CURRENT_TIMESTAMP 
          ELSE created_at 
        END as created_at_clean,
        CASE 
          WHEN updated_at IS NULL THEN CURRENT_TIMESTAMP 
          ELSE updated_at 
        END as updated_at_clean
      FROM ${tableName}
      WHERE 
        -- Remove duplicates based on primary key
        ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) = 1
        -- Remove records with invalid data
        AND id IS NOT NULL
    `;
  }

  /**
   * Generate JSON flattening Python script
   */
  private static generateJSONFlattening(): string {
    return `
import json
import pandas as pd
from typing import Dict, Any

def flatten_json(data: Dict[str, Any], prefix: str = '') -> Dict[str, Any]:
    """Flatten nested JSON structure"""
    flattened = {}
    for key, value in data.items():
        new_key = f"{prefix}_{key}" if prefix else key
        if isinstance(value, dict):
            flattened.update(flatten_json(value, new_key))
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    flattened.update(flatten_json(item, f"{new_key}_{i}"))
                else:
                    flattened[f"{new_key}_{i}"] = item
        else:
            flattened[new_key] = value
    return flattened

def process_batch(records):
    """Process a batch of JSON records"""
    flattened_records = []
    for record in records:
        flattened = flatten_json(record)
        flattened_records.append(flattened)
    return pd.DataFrame(flattened_records)
    `;
  }

  /**
   * Generate windowing SQL for streaming
   */
  private static generateWindowingSQL(windowSize: string): string {
    return `
      SELECT 
        window_start,
        window_end,
        COUNT(*) as event_count,
        AVG(value) as avg_value,
        MAX(value) as max_value,
        MIN(value) as min_value
      FROM TABLE(
        TUMBLE(TABLE source_stream, DESCRIPTOR(event_time), INTERVAL '${windowSize}')
      )
      GROUP BY window_start, window_end
    `;
  }

  /**
   * Generate data profiling script
   */
  private static generateProfilingScript(): string {
    return `
import pandas as pd
import numpy as np
from typing import Dict, Any

def profile_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate comprehensive data profile"""
    profile = {
        'row_count': len(df),
        'column_count': len(df.columns),
        'null_percentages': {},
        'data_types': {},
        'unique_counts': {},
        'summary_stats': {}
    }
    
    for column in df.columns:
        # Null percentage
        null_pct = (df[column].isnull().sum() / len(df)) * 100
        profile['null_percentages'][column] = null_pct
        
        # Data type
        profile['data_types'][column] = str(df[column].dtype)
        
        # Unique count
        profile['unique_counts'][column] = df[column].nunique()
        
        # Summary statistics for numeric columns
        if df[column].dtype in ['int64', 'float64']:
            profile['summary_stats'][column] = {
                'mean': df[column].mean(),
                'median': df[column].median(),
                'std': df[column].std(),
                'min': df[column].min(),
                'max': df[column].max()
            }
    
    return profile
    `;
  }

  /**
   * Generate feature validation script
   */
  private static generateFeatureValidation(): string {
    return `
import pandas as pd
import numpy as np

def validate_features(df: pd.DataFrame) -> Dict[str, bool]:
    """Validate ML features"""
    validation_results = {}
    
    for column in df.columns:
        # Check for infinite values
        has_inf = np.isinf(df[column]).any() if df[column].dtype in ['float64', 'int64'] else False
        validation_results[f"{column}_no_infinity"] = not has_inf
        
        # Check for null values
        has_nulls = df[column].isnull().any()
        validation_results[f"{column}_no_nulls"] = not has_nulls
        
        # Check for reasonable range (for numeric features)
        if df[column].dtype in ['float64', 'int64']:
            within_range = (df[column] >= -1e6).all() and (df[column] <= 1e6).all()
            validation_results[f"{column}_within_range"] = within_range
    
    return validation_results
    `;
  }
}

/**
 * Template configuration interfaces
 */
export interface DatabaseToWarehouseConfig {
  tableName: string;
  sourceDatabase: string;
  targetWarehouse: 'bigquery' | 'snowflake' | 'redshift';
  sourceConnection: any;
  targetConnection: any;
  sourceSchema?: any;
  targetSchema?: any;
  transformationSQL?: string;
  writeMode?: WriteMode;
  schedule?: string;
  owner: string;
  team: string;
  contacts?: any[];
  criticality?: 'low' | 'medium' | 'high' | 'critical';
}

export interface APIToDataLakeConfig {
  apiName: string;
  apiEndpoint: string;
  method?: string;
  headers?: Record<string, string>;
  paginationConfig?: any;
  dataLakeConnection: any;
  expectedSchema?: any;
  enrichmentScript?: string;
  frequency: 'hourly' | 'daily' | 'realtime';
  schedule?: string;
  owner: string;
  team: string;
  contacts?: any[];
  criticality?: 'low' | 'medium' | 'high' | 'critical';
}

export interface KafkaStreamingConfig {
  topicName: string;
  kafkaConnection: any;
  schema: any;
  destinations: Array<{ type: string; connection: any }>;
  processingSQL: string;
  timestampField?: string;
  allowedLateness?: number;
  windowSize?: string;
  maxLatency?: number;
  owner: string;
  team: string;
  contacts?: any[];
  criticality?: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataQualityConfig {
  datasetName: string;
  sourceType: string;
  sourceConnection: any;
  resultsConnection: any;
  schema: any;
  qualityRules: Array<{
    name: string;
    type: string;
    config: any;
    severity?: 'error' | 'warning' | 'info';
  }>;
  schedule?: string;
  owner: string;
  team: string;
  contacts?: any[];
}

export interface MLFeatureConfig {
  featureSetName: string;
  isRealTime: boolean;
  dataSources: Array<{
    type: string;
    connection: any;
    schema: any;
  }>;
  featureStoreConnection: any;
  featureScript: string;
  expectedRange?: {
    min: number;
    max: number;
  };
  schedule?: string;
  owner: string;
  team: string;
  contacts?: any[];
}

/**
 * Pipeline Template Registry
 */
export class PipelineTemplateRegistry {
  private static templates = new Map<string, Function>();

  static registerTemplate(name: string, generator: Function) {
    this.templates.set(name, generator);
  }

  static getTemplate(name: string): Function | undefined {
    return this.templates.get(name);
  }

  static listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  static getTemplateMetadata(name: string): TemplateMetadata | undefined {
    const metadata: Record<string, TemplateMetadata> = {
      'database-to-warehouse': {
        name: 'Database to Data Warehouse ETL',
        description: 'Extract data from a database table and load to a data warehouse',
        category: 'ETL',
        complexity: 'Medium',
        estimatedSetupTime: '30 minutes',
        requiredParams: ['tableName', 'sourceConnection', 'targetConnection', 'owner', 'team'],
        optionalParams: ['transformationSQL', 'schedule', 'writeMode']
      },
      'api-to-data-lake': {
        name: 'API to Data Lake Ingestion',
        description: 'Ingest data from REST APIs to a data lake',
        category: 'Ingestion',
        complexity: 'Low',
        estimatedSetupTime: '15 minutes',
        requiredParams: ['apiName', 'apiEndpoint', 'dataLakeConnection', 'owner', 'team'],
        optionalParams: ['headers', 'paginationConfig', 'enrichmentScript']
      },
      'kafka-streaming': {
        name: 'Kafka Real-time Streaming',
        description: 'Process Kafka streams in real-time with windowing',
        category: 'Streaming',
        complexity: 'High',
        estimatedSetupTime: '60 minutes',
        requiredParams: ['topicName', 'kafkaConnection', 'destinations', 'processingSQL', 'owner', 'team'],
        optionalParams: ['windowSize', 'allowedLateness', 'maxLatency']
      },
      'data-quality-monitoring': {
        name: 'Data Quality Monitoring',
        description: 'Monitor data quality with automated checks and alerts',
        category: 'Quality',
        complexity: 'Medium',
        estimatedSetupTime: '45 minutes',
        requiredParams: ['datasetName', 'sourceConnection', 'qualityRules', 'owner', 'team'],
        optionalParams: ['schedule', 'resultsConnection']
      },
      'ml-feature-pipeline': {
        name: 'ML Feature Pipeline',
        description: 'Generate and validate machine learning features',
        category: 'ML',
        complexity: 'High',
        estimatedSetupTime: '90 minutes',
        requiredParams: ['featureSetName', 'dataSources', 'featureScript', 'owner', 'team'],
        optionalParams: ['isRealTime', 'expectedRange', 'schedule']
      }
    };

    return metadata[name];
  }
}

export interface TemplateMetadata {
  name: string;
  description: string;
  category: string;
  complexity: 'Low' | 'Medium' | 'High';
  estimatedSetupTime: string;
  requiredParams: string[];
  optionalParams: string[];
}

// Initialize templates
PipelineTemplateRegistry.registerTemplate('database-to-warehouse', PipelineTemplateEngine.databaseToWarehouse);
PipelineTemplateRegistry.registerTemplate('api-to-data-lake', PipelineTemplateEngine.apiToDataLake);
PipelineTemplateRegistry.registerTemplate('kafka-streaming', PipelineTemplateEngine.kafkaStreaming);
PipelineTemplateRegistry.registerTemplate('data-quality-monitoring', PipelineTemplateEngine.dataQualityMonitoring);
PipelineTemplateRegistry.registerTemplate('ml-feature-pipeline', PipelineTemplateEngine.mlFeaturePipeline);