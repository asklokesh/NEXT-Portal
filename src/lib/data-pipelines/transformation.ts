// Data Transformation and Processing Engines

import { 
  TransformationStep, 
  TransformationType, 
  SchemaDefinition, 
  FieldDefinition 
} from './types';

/**
 * Spark Integration for Large-Scale Data Processing
 */
export class SparkIntegration {
  private config: SparkConfig;
  private sessionId: string | null = null;

  constructor(config: SparkConfig) {
    this.config = config;
  }

  /**
   * Create Spark session
   */
  async createSession(sessionConfig: SparkSessionConfig): Promise<string> {
    try {
      const response = await this.makeRequest('POST', '/sessions', {
        kind: sessionConfig.kind || 'spark',
        conf: {
          'spark.sql.adaptive.enabled': 'true',
          'spark.sql.adaptive.coalescePartitions.enabled': 'true',
          'spark.serializer': 'org.apache.spark.serializer.KryoSerializer',
          ...sessionConfig.conf
        },
        files: sessionConfig.files || [],
        pyFiles: sessionConfig.pyFiles || [],
        archives: sessionConfig.archives || [],
        queue: sessionConfig.queue,
        name: sessionConfig.name || 'data-pipeline-session',
        heartbeatTimeoutInSecond: sessionConfig.heartbeatTimeout || 60
      });

      this.sessionId = response.id.toString();
      console.log(`Spark session created with ID: ${this.sessionId}`);
      return this.sessionId;
    } catch (error) {
      throw new Error(`Failed to create Spark session: ${error.message}`);
    }
  }

  /**
   * Submit Spark job
   */
  async submitJob(jobConfig: SparkJobConfig): Promise<SparkJobResult> {
    if (!this.sessionId) {
      await this.createSession(jobConfig.sessionConfig || {});
    }

    try {
      let code: string;
      
      if (jobConfig.type === 'sql') {
        code = this.generateSparkSQL(jobConfig);
      } else if (jobConfig.type === 'python') {
        code = jobConfig.code!;
      } else {
        code = this.generateSparkScala(jobConfig);
      }

      const response = await this.makeRequest('POST', `/sessions/${this.sessionId}/statements`, {
        code,
        kind: jobConfig.type
      });

      // Wait for completion
      const result = await this.waitForCompletion(response.id);
      
      return {
        jobId: response.id.toString(),
        status: result.state,
        output: result.output,
        executionTime: result.progress.completedTasks || 0,
        metrics: this.extractMetrics(result)
      };
    } catch (error) {
      throw new Error(`Failed to submit Spark job: ${error.message}`);
    }
  }

  /**
   * Execute SQL query
   */
  async executeSQL(query: string): Promise<SparkSQLResult> {
    const result = await this.submitJob({
      type: 'sql',
      sql: query
    });

    return {
      schema: result.output?.data?.schema || [],
      data: result.output?.data?.data || [],
      rowCount: result.output?.data?.data?.length || 0
    };
  }

  /**
   * Read data from source
   */
  async readData(sourceConfig: SparkDataSourceConfig): Promise<SparkDataFrame> {
    const code = this.generateReadCode(sourceConfig);
    const result = await this.submitJob({
      type: 'python',
      code
    });

    return {
      id: `df_${Date.now()}`,
      schema: result.output?.schema || [],
      partitionCount: sourceConfig.partitions || 1,
      cached: false
    };
  }

  /**
   * Write data to destination
   */
  async writeData(
    dataFrameId: string, 
    destinationConfig: SparkDataSinkConfig
  ): Promise<SparkWriteResult> {
    const code = this.generateWriteCode(dataFrameId, destinationConfig);
    const result = await this.submitJob({
      type: 'python',
      code
    });

    return {
      recordsWritten: result.metrics?.recordsWritten || 0,
      bytesWritten: result.metrics?.bytesWritten || 0,
      partitions: destinationConfig.partitions || 1,
      writeMode: destinationConfig.writeMode || 'overwrite'
    };
  }

  /**
   * Apply transformations
   */
  async applyTransformations(
    dataFrameId: string, 
    transformations: SparkTransformation[]
  ): Promise<SparkDataFrame> {
    let code = `df = spark.table("${dataFrameId}")\n`;
    
    for (const transformation of transformations) {
      code += this.generateTransformationCode(transformation) + '\n';
    }
    
    code += 'df.show()\ndf.createOrReplaceTempView("transformed_df")';

    const result = await this.submitJob({
      type: 'python',
      code
    });

    return {
      id: 'transformed_df',
      schema: result.output?.schema || [],
      partitionCount: 1,
      cached: false
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<SparkJobStatus> {
    const response = await this.makeRequest('GET', `/sessions/${this.sessionId}/statements/${jobId}`);
    
    return {
      jobId,
      state: response.state,
      output: response.output,
      progress: response.progress || { completedTasks: 0, totalTasks: 0 },
      startTime: response.started ? new Date(response.started) : new Date(),
      endTime: response.finished ? new Date(response.finished) : undefined
    };
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<void> {
    await this.makeRequest('POST', `/sessions/${this.sessionId}/statements/${jobId}/cancel`);
  }

  /**
   * Close session
   */
  async closeSession(): Promise<void> {
    if (this.sessionId) {
      await this.makeRequest('DELETE', `/sessions/${this.sessionId}`);
      this.sessionId = null;
    }
  }

  /**
   * Generate Spark SQL code
   */
  private generateSparkSQL(config: SparkJobConfig): string {
    return config.sql || 'SELECT 1 as test';
  }

  /**
   * Generate Spark Scala code
   */
  private generateSparkScala(config: SparkJobConfig): string {
    return config.code || 'println("Hello Spark")';
  }

  /**
   * Generate read code
   */
  private generateReadCode(config: SparkDataSourceConfig): string {
    let code = '';
    
    switch (config.format) {
      case 'parquet':
        code = `df = spark.read.parquet("${config.path}")`;
        break;
      case 'json':
        code = `df = spark.read.json("${config.path}")`;
        break;
      case 'csv':
        code = `df = spark.read.option("header", "true").csv("${config.path}")`;
        break;
      case 'jdbc':
        code = `df = spark.read.format("jdbc").option("url", "${config.url}").option("dbtable", "${config.table}").option("user", "${config.username}").option("password", "${config.password}").load()`;
        break;
      case 'kafka':
        code = `df = spark.readStream.format("kafka").option("kafka.bootstrap.servers", "${config.brokers}").option("subscribe", "${config.topic}").load()`;
        break;
      default:
        code = `df = spark.read.format("${config.format}").load("${config.path}")`;
    }

    code += '\ndf.createOrReplaceTempView("source_data")';
    return code;
  }

  /**
   * Generate write code
   */
  private generateWriteCode(dataFrameId: string, config: SparkDataSinkConfig): string {
    let code = `df = spark.table("${dataFrameId}")\n`;
    
    const writer = `df.write.mode("${config.writeMode || 'overwrite'}")`;
    
    switch (config.format) {
      case 'parquet':
        code += `${writer}.parquet("${config.path}")`;
        break;
      case 'json':
        code += `${writer}.json("${config.path}")`;
        break;
      case 'csv':
        code += `${writer}.option("header", "true").csv("${config.path}")`;
        break;
      case 'jdbc':
        code += `${writer}.format("jdbc").option("url", "${config.url}").option("dbtable", "${config.table}").option("user", "${config.username}").option("password", "${config.password}").save()`;
        break;
      case 'kafka':
        code += `${writer}.format("kafka").option("kafka.bootstrap.servers", "${config.brokers}").option("topic", "${config.topic}").save()`;
        break;
      default:
        code += `${writer}.format("${config.format}").save("${config.path}")`;
    }

    return code;
  }

  /**
   * Generate transformation code
   */
  private generateTransformationCode(transformation: SparkTransformation): string {
    switch (transformation.type) {
      case 'select':
        return `df = df.select(${transformation.columns?.map(c => `"${c}"`).join(', ')})`;
      
      case 'filter':
        return `df = df.filter("${transformation.condition}")`;
      
      case 'groupBy':
        const groupCols = transformation.groupByColumns?.map(c => `"${c}"`).join(', ');
        const aggCols = transformation.aggregations?.map(agg => 
          `${agg.function}("${agg.column}").alias("${agg.alias}")`
        ).join(', ');
        return `df = df.groupBy(${groupCols}).agg(${aggCols})`;
      
      case 'join':
        return `df = df.join(spark.table("${transformation.rightTable}"), "${transformation.joinKey}", "${transformation.joinType}")`;
      
      case 'withColumn':
        return `df = df.withColumn("${transformation.columnName}", ${transformation.expression})`;
      
      case 'drop':
        return `df = df.drop(${transformation.columns?.map(c => `"${c}"`).join(', ')})`;
      
      case 'rename':
        const renameClauses = Object.entries(transformation.columnMapping || {})
          .map(([old, new_]) => `"${old}", "${new_}"`);
        return renameClauses.map(clause => `df = df.withColumnRenamed(${clause})`).join('\n');
      
      default:
        return transformation.customCode || '';
    }
  }

  /**
   * Wait for job completion
   */
  private async waitForCompletion(jobId: string, timeout: number = 300000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = await this.getJobStatus(jobId);
      
      if (status.state === 'available') {
        return status;
      } else if (status.state === 'error') {
        throw new Error(`Spark job failed: ${status.output?.evalue || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Spark job timeout');
  }

  /**
   * Extract metrics from job result
   */
  private extractMetrics(result: any): SparkJobMetrics {
    return {
      recordsRead: 0,
      recordsWritten: 0,
      bytesRead: 0,
      bytesWritten: 0,
      executionTime: 0,
      cpuTime: 0,
      memoryUsed: 0
    };
  }

  /**
   * Make HTTP request to Livy API
   */
  private async makeRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${this.config.livyUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.auth) {
      const credentials = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Livy API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * DBT (Data Build Tool) Integration
 */
export class DBTIntegration {
  private config: DBTConfig;
  private projectPath: string;

  constructor(config: DBTConfig) {
    this.config = config;
    this.projectPath = config.projectPath;
  }

  /**
   * Initialize DBT project
   */
  async initProject(projectConfig: DBTProjectConfig): Promise<void> {
    try {
      // Create dbt_project.yml
      const projectYml = this.generateProjectConfig(projectConfig);
      await this.writeFile(`${this.projectPath}/dbt_project.yml`, projectYml);

      // Create directory structure
      await this.createDirectoryStructure();

      // Create profiles.yml
      const profilesYml = this.generateProfilesConfig(projectConfig.profiles);
      await this.writeFile(`${this.projectPath}/profiles.yml`, profilesYml);

      console.log(`DBT project initialized at ${this.projectPath}`);
    } catch (error) {
      throw new Error(`Failed to initialize DBT project: ${error.message}`);
    }
  }

  /**
   * Create DBT model
   */
  async createModel(modelConfig: DBTModelConfig): Promise<void> {
    try {
      const modelSQL = this.generateModelSQL(modelConfig);
      const modelPath = `${this.projectPath}/models/${modelConfig.name}.sql`;
      
      await this.writeFile(modelPath, modelSQL);

      // Create model documentation
      if (modelConfig.documentation) {
        const docsYml = this.generateModelDocs(modelConfig);
        const docsPath = `${this.projectPath}/models/${modelConfig.name}.yml`;
        await this.writeFile(docsPath, docsYml);
      }

      console.log(`DBT model ${modelConfig.name} created`);
    } catch (error) {
      throw new Error(`Failed to create DBT model: ${error.message}`);
    }
  }

  /**
   * Run DBT models
   */
  async runModels(options: DBTRunOptions = {}): Promise<DBTRunResult> {
    try {
      const command = this.buildDBTCommand('run', options);
      const result = await this.executeDBTCommand(command);
      
      return {
        success: result.exitCode === 0,
        modelsRun: this.parseModelsFromOutput(result.stdout),
        duration: result.duration,
        output: result.stdout,
        errors: result.stderr ? [result.stderr] : []
      };
    } catch (error) {
      throw new Error(`DBT run failed: ${error.message}`);
    }
  }

  /**
   * Test DBT models
   */
  async testModels(options: DBTTestOptions = {}): Promise<DBTTestResult> {
    try {
      const command = this.buildDBTCommand('test', options);
      const result = await this.executeDBTCommand(command);
      
      return {
        success: result.exitCode === 0,
        testsRun: this.parseTestsFromOutput(result.stdout),
        testsPassed: result.exitCode === 0 ? this.parseTestsFromOutput(result.stdout) : 0,
        testsFailed: result.exitCode === 0 ? 0 : this.parseTestsFromOutput(result.stdout),
        duration: result.duration,
        output: result.stdout,
        errors: result.stderr ? [result.stderr] : []
      };
    } catch (error) {
      throw new Error(`DBT test failed: ${error.message}`);
    }
  }

  /**
   * Generate DBT documentation
   */
  async generateDocs(): Promise<void> {
    try {
      await this.executeDBTCommand(['docs', 'generate']);
      await this.executeDBTCommand(['docs', 'serve', '--port', '8080']);
      console.log('DBT documentation generated and served on port 8080');
    } catch (error) {
      throw new Error(`DBT docs generation failed: ${error.message}`);
    }
  }

  /**
   * Create DBT snapshot
   */
  async createSnapshot(snapshotConfig: DBTSnapshotConfig): Promise<void> {
    try {
      const snapshotSQL = this.generateSnapshotSQL(snapshotConfig);
      const snapshotPath = `${this.projectPath}/snapshots/${snapshotConfig.name}.sql`;
      
      await this.writeFile(snapshotPath, snapshotSQL);
      console.log(`DBT snapshot ${snapshotConfig.name} created`);
    } catch (error) {
      throw new Error(`Failed to create DBT snapshot: ${error.message}`);
    }
  }

  /**
   * Run DBT snapshots
   */
  async runSnapshots(): Promise<DBTRunResult> {
    try {
      const result = await this.executeDBTCommand(['snapshot']);
      
      return {
        success: result.exitCode === 0,
        modelsRun: this.parseModelsFromOutput(result.stdout),
        duration: result.duration,
        output: result.stdout,
        errors: result.stderr ? [result.stderr] : []
      };
    } catch (error) {
      throw new Error(`DBT snapshot run failed: ${error.message}`);
    }
  }

  /**
   * Generate project configuration
   */
  private generateProjectConfig(config: DBTProjectConfig): string {
    return `
name: '${config.name}'
version: '${config.version || '1.0.0'}'
config-version: 2

profile: '${config.profile || config.name}'

model-paths: ["models"]
analysis-paths: ["analysis"]
test-paths: ["tests"]
seed-paths: ["data"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

target-path: "target"
clean-targets:
  - "target"
  - "dbt_packages"

models:
  ${config.name}:
    materialized: ${config.defaultMaterialization || 'table'}
    ${config.modelConfig ? this.yamlStringify(config.modelConfig, 4) : ''}

vars:
  ${config.vars ? this.yamlStringify(config.vars, 2) : ''}
`;
  }

  /**
   * Generate profiles configuration
   */
  private generateProfilesConfig(profiles: Record<string, any>): string {
    return this.yamlStringify(profiles, 0);
  }

  /**
   * Generate model SQL
   */
  private generateModelSQL(config: DBTModelConfig): string {
    let sql = '';
    
    // Add config block
    if (config.materialized || config.unique_key || config.indexes) {
      sql += '{{ config(\n';
      
      const configOptions = [];
      if (config.materialized) configOptions.push(`  materialized='${config.materialized}'`);
      if (config.unique_key) configOptions.push(`  unique_key='${config.unique_key}'`);
      if (config.indexes) configOptions.push(`  indexes=${JSON.stringify(config.indexes)}`);
      
      sql += configOptions.join(',\n');
      sql += '\n) }}\n\n';
    }

    // Add dependencies
    if (config.dependencies && config.dependencies.length > 0) {
      config.dependencies.forEach(dep => {
        sql += `-- depends_on: {{ ref('${dep}') }}\n`;
      });
      sql += '\n';
    }

    // Add the main SQL
    sql += config.sql;

    return sql;
  }

  /**
   * Generate model documentation
   */
  private generateModelDocs(config: DBTModelConfig): string {
    return `
version: 2

models:
  - name: ${config.name}
    description: "${config.documentation?.description || ''}"
    columns:
      ${config.documentation?.columns?.map(col => `
      - name: ${col.name}
        description: "${col.description}"
        tests:
          ${col.tests?.map(test => `- ${test}`).join('\n          ') || ''}
      `).join('') || ''}
`;
  }

  /**
   * Generate snapshot SQL
   */
  private generateSnapshotSQL(config: DBTSnapshotConfig): string {
    return `
{% snapshot ${config.name} %}

    {{
        config(
          target_database='${config.targetDatabase}',
          target_schema='${config.targetSchema}',
          unique_key='${config.uniqueKey}',
          strategy='${config.strategy}',
          updated_at='${config.updatedAt}'
        )
    }}

    ${config.sql}

{% endsnapshot %}
`;
  }

  /**
   * Build DBT command
   */
  private buildDBTCommand(command: string, options: any = {}): string[] {
    const cmd = ['dbt', command];
    
    if (options.models) cmd.push('--models', options.models);
    if (options.exclude) cmd.push('--exclude', options.exclude);
    if (options.select) cmd.push('--select', options.select);
    if (options.threads) cmd.push('--threads', options.threads.toString());
    if (options.profiles_dir) cmd.push('--profiles-dir', options.profiles_dir);
    
    return cmd;
  }

  /**
   * Execute DBT command
   */
  private async executeDBTCommand(command: string[]): Promise<CommandResult> {
    // Mock implementation - in reality, this would execute the actual DBT command
    const startTime = Date.now();
    
    console.log(`Executing: ${command.join(' ')}`);
    
    // Simulate command execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      exitCode: 0,
      stdout: 'DBT command executed successfully',
      stderr: '',
      duration: Date.now() - startTime
    };
  }

  /**
   * Parse models from DBT output
   */
  private parseModelsFromOutput(output: string): number {
    // Parse DBT output to extract number of models run
    const matches = output.match(/Completed successfully (\d+) model/);
    return matches ? parseInt(matches[1]) : 0;
  }

  /**
   * Parse tests from DBT output
   */
  private parseTestsFromOutput(output: string): number {
    // Parse DBT output to extract number of tests run
    const matches = output.match(/Completed (\d+) test/);
    return matches ? parseInt(matches[1]) : 0;
  }

  /**
   * Create directory structure
   */
  private async createDirectoryStructure(): Promise<void> {
    const dirs = [
      'models',
      'analysis',
      'tests',
      'data',
      'macros',
      'snapshots'
    ];

    for (const dir of dirs) {
      // In a real implementation, create the directories
      console.log(`Creating directory: ${this.projectPath}/${dir}`);
    }
  }

  /**
   * Write file (mock implementation)
   */
  private async writeFile(path: string, content: string): Promise<void> {
    console.log(`Writing file: ${path}`);
    // In a real implementation, write the actual file
  }

  /**
   * Convert object to YAML string
   */
  private yamlStringify(obj: any, indent: number): string {
    // Simple YAML stringification - in reality, use a proper YAML library
    const spaces = ' '.repeat(indent);
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${spaces}${key}:`);
        lines.push(this.yamlStringify(value, indent + 2));
      } else {
        lines.push(`${spaces}${key}: ${value}`);
      }
    }
    
    return lines.join('\n');
  }
}

/**
 * Transformation Engine for Custom Logic
 */
export class TransformationEngine {
  private transformations: Map<string, TransformationFunction> = new Map();

  /**
   * Register transformation function
   */
  registerTransformation(name: string, func: TransformationFunction): void {
    this.transformations.set(name, func);
  }

  /**
   * Execute transformation pipeline
   */
  async executePipeline(data: any[], steps: TransformationStep[]): Promise<TransformationResult> {
    try {
      let currentData = [...data];
      const results: StepResult[] = [];
      const startTime = Date.now();

      for (const step of steps) {
        const stepStartTime = Date.now();
        
        if (step.type === TransformationType.SQL) {
          currentData = await this.executeSQLTransformation(currentData, step);
        } else if (step.type === TransformationType.PYTHON) {
          currentData = await this.executePythonTransformation(currentData, step);
        } else {
          const func = this.transformations.get(step.name);
          if (func) {
            currentData = await func(currentData, step.config);
          } else {
            throw new Error(`Unknown transformation: ${step.name}`);
          }
        }

        results.push({
          stepId: step.id,
          stepName: step.name,
          recordsIn: data.length,
          recordsOut: currentData.length,
          executionTime: Date.now() - stepStartTime,
          success: true
        });
      }

      return {
        success: true,
        data: currentData,
        executionTime: Date.now() - startTime,
        steps: results,
        recordsProcessed: data.length,
        recordsOutput: currentData.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        executionTime: Date.now() - Date.now(),
        steps: [],
        recordsProcessed: data.length,
        recordsOutput: 0,
        error: error.message
      };
    }
  }

  /**
   * Execute SQL transformation
   */
  private async executeSQLTransformation(data: any[], step: TransformationStep): Promise<any[]> {
    // Mock SQL execution - in reality, use a SQL engine like DuckDB or similar
    const query = step.config.query;
    
    // Simple filter example
    if (query.toLowerCase().includes('where')) {
      // Parse simple WHERE clause
      const whereMatch = query.match(/where\s+(\w+)\s*=\s*'([^']+)'/i);
      if (whereMatch) {
        const [, column, value] = whereMatch;
        return data.filter(row => row[column] === value);
      }
    }

    return data;
  }

  /**
   * Execute Python transformation
   */
  private async executePythonTransformation(data: any[], step: TransformationStep): Promise<any[]> {
    // Mock Python execution - in reality, use a Python runtime
    const script = step.config.script;
    
    if (script.includes('df.fillna')) {
      // Fill null values
      return data.map(row => {
        const newRow = { ...row };
        for (const key in newRow) {
          if (newRow[key] == null) {
            newRow[key] = '';
          }
        }
        return newRow;
      });
    }

    return data;
  }

  /**
   * Validate transformation pipeline
   */
  validatePipeline(steps: TransformationStep[]): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Check for missing dependencies
    const stepIds = new Set(steps.map(s => s.id));
    for (const step of steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            issues.push({
              type: 'missing_dependency',
              stepId: step.id,
              message: `Missing dependency: ${dep}`,
              severity: 'error'
            });
          }
        }
      }
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(steps);
    if (circularDeps.length > 0) {
      issues.push({
        type: 'circular_dependency',
        message: `Circular dependency detected: ${circularDeps.join(' -> ')}`,
        severity: 'error'
      });
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(steps: TransformationStep[]): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    for (const step of steps) {
      if (!visited.has(step.id)) {
        const cycle = this.detectCycleDFS(step.id, steps, visited, recursionStack, []);
        if (cycle.length > 0) {
          return cycle;
        }
      }
    }

    return [];
  }

  /**
   * DFS for cycle detection
   */
  private detectCycleDFS(
    stepId: string,
    steps: TransformationStep[],
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] {
    visited.add(stepId);
    recursionStack.add(stepId);
    path.push(stepId);

    const step = steps.find(s => s.id === stepId);
    if (step?.dependencies) {
      for (const dep of step.dependencies) {
        if (recursionStack.has(dep)) {
          return [...path.slice(path.indexOf(dep)), dep];
        }
        
        if (!visited.has(dep)) {
          const cycle = this.detectCycleDFS(dep, steps, visited, recursionStack, [...path]);
          if (cycle.length > 0) {
            return cycle;
          }
        }
      }
    }

    recursionStack.delete(stepId);
    return [];
  }
}

/**
 * Type definitions
 */
export interface SparkConfig {
  livyUrl: string;
  auth?: {
    username: string;
    password: string;
  };
}

export interface SparkSessionConfig {
  kind?: 'spark' | 'pyspark' | 'sparkr' | 'sql';
  conf?: Record<string, string>;
  files?: string[];
  pyFiles?: string[];
  archives?: string[];
  queue?: string;
  name?: string;
  heartbeatTimeout?: number;
}

export interface SparkJobConfig {
  type: 'sql' | 'python' | 'scala';
  sql?: string;
  code?: string;
  sessionConfig?: SparkSessionConfig;
}

export interface SparkJobResult {
  jobId: string;
  status: string;
  output: any;
  executionTime: number;
  metrics: SparkJobMetrics;
}

export interface SparkJobMetrics {
  recordsRead: number;
  recordsWritten: number;
  bytesRead: number;
  bytesWritten: number;
  executionTime: number;
  cpuTime: number;
  memoryUsed: number;
}

export interface SparkSQLResult {
  schema: string[];
  data: any[][];
  rowCount: number;
}

export interface SparkDataSourceConfig {
  format: 'parquet' | 'json' | 'csv' | 'jdbc' | 'kafka';
  path?: string;
  url?: string;
  table?: string;
  username?: string;
  password?: string;
  brokers?: string;
  topic?: string;
  partitions?: number;
  options?: Record<string, string>;
}

export interface SparkDataSinkConfig {
  format: 'parquet' | 'json' | 'csv' | 'jdbc' | 'kafka';
  path?: string;
  url?: string;
  table?: string;
  username?: string;
  password?: string;
  brokers?: string;
  topic?: string;
  writeMode?: 'overwrite' | 'append' | 'ignore' | 'error';
  partitions?: number;
  options?: Record<string, string>;
}

export interface SparkDataFrame {
  id: string;
  schema: string[];
  partitionCount: number;
  cached: boolean;
}

export interface SparkWriteResult {
  recordsWritten: number;
  bytesWritten: number;
  partitions: number;
  writeMode: string;
}

export interface SparkTransformation {
  type: 'select' | 'filter' | 'groupBy' | 'join' | 'withColumn' | 'drop' | 'rename';
  columns?: string[];
  condition?: string;
  groupByColumns?: string[];
  aggregations?: Array<{
    function: string;
    column: string;
    alias: string;
  }>;
  rightTable?: string;
  joinKey?: string;
  joinType?: string;
  columnName?: string;
  expression?: string;
  columnMapping?: Record<string, string>;
  customCode?: string;
}

export interface SparkJobStatus {
  jobId: string;
  state: string;
  output: any;
  progress: {
    completedTasks: number;
    totalTasks: number;
  };
  startTime: Date;
  endTime?: Date;
}

export interface DBTConfig {
  projectPath: string;
  profilesPath?: string;
}

export interface DBTProjectConfig {
  name: string;
  version?: string;
  profile?: string;
  defaultMaterialization?: string;
  modelConfig?: Record<string, any>;
  vars?: Record<string, any>;
  profiles: Record<string, any>;
}

export interface DBTModelConfig {
  name: string;
  sql: string;
  materialized?: 'table' | 'view' | 'incremental' | 'ephemeral';
  unique_key?: string;
  indexes?: string[];
  dependencies?: string[];
  documentation?: {
    description: string;
    columns?: Array<{
      name: string;
      description: string;
      tests?: string[];
    }>;
  };
}

export interface DBTRunOptions {
  models?: string;
  exclude?: string;
  select?: string;
  threads?: number;
  profiles_dir?: string;
}

export interface DBTTestOptions {
  models?: string;
  exclude?: string;
  select?: string;
  data?: boolean;
  schema?: boolean;
}

export interface DBTRunResult {
  success: boolean;
  modelsRun: number;
  duration: number;
  output: string;
  errors: string[];
}

export interface DBTTestResult {
  success: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  duration: number;
  output: string;
  errors: string[];
}

export interface DBTSnapshotConfig {
  name: string;
  sql: string;
  targetDatabase: string;
  targetSchema: string;
  uniqueKey: string;
  strategy: 'timestamp' | 'check';
  updatedAt: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface TransformationResult {
  success: boolean;
  data: any[];
  executionTime: number;
  steps: StepResult[];
  recordsProcessed: number;
  recordsOutput: number;
  error?: string;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  recordsIn: number;
  recordsOut: number;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: string;
  stepId?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export type TransformationFunction = (data: any[], config: any) => Promise<any[]>;

// Register common transformations
const transformationEngine = new TransformationEngine();

transformationEngine.registerTransformation('deduplicate', async (data: any[], config: any) => {
  const seen = new Set();
  const key = config.key || 'id';
  
  return data.filter(row => {
    const keyValue = row[key];
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
});

transformationEngine.registerTransformation('normalize', async (data: any[], config: any) => {
  const column = config.column;
  const values = data.map(row => Number(row[column])).filter(v => !isNaN(v));
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  return data.map(row => ({
    ...row,
    [column]: (Number(row[column]) - min) / (max - min)
  }));
});

transformationEngine.registerTransformation('aggregate', async (data: any[], config: any) => {
  const groupBy = config.groupBy;
  const aggregations = config.aggregations || [];
  
  const groups = new Map();
  
  for (const row of data) {
    const key = groupBy.map((col: string) => row[col]).join('|');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }
  
  const result = [];
  for (const [key, groupData] of groups.entries()) {
    const groupKeys = key.split('|');
    const aggregatedRow: any = {};
    
    groupBy.forEach((col: string, index: number) => {
      aggregatedRow[col] = groupKeys[index];
    });
    
    for (const agg of aggregations) {
      const column = agg.column;
      const func = agg.function;
      const values = groupData.map((row: any) => Number(row[column])).filter((v: number) => !isNaN(v));
      
      switch (func) {
        case 'sum':
          aggregatedRow[`${column}_sum`] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggregatedRow[`${column}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggregatedRow[`${column}_count`] = groupData.length;
          break;
        case 'max':
          aggregatedRow[`${column}_max`] = Math.max(...values);
          break;
        case 'min':
          aggregatedRow[`${column}_min`] = Math.min(...values);
          break;
      }
    }
    
    result.push(aggregatedRow);
  }
  
  return result;
});

export { transformationEngine };