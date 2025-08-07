import { PrismaClient } from '@prisma/client';
import { performance, PerformanceObserver } from 'perf_hooks';
import { writeFileSync } from 'fs';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

interface BenchmarkSuite {
  name: string;
  timestamp: Date;
  databaseUrl: string;
  results: BenchmarkResult[];
  summary: {
    totalOperations: number;
    totalTime: number;
    averageOpsPerSecond: number;
  };
}

class DatabasePerformanceBenchmark {
  private prisma: PrismaClient;
  private results: BenchmarkSuite;

  constructor(databaseUrl?: string) {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl || process.env.DATABASE_URL,
        },
      },
    });

    this.results = {
      name: 'Plugin Database Performance Benchmark',
      timestamp: new Date(),
      databaseUrl: databaseUrl || process.env.DATABASE_URL || 'not specified',
      results: [],
      summary: {
        totalOperations: 0,
        totalTime: 0,
        averageOpsPerSecond: 0,
      },
    };
  }

  private generateMockPlugin(id?: string) {
    const randomId = id || `plugin-${Math.random().toString(36).substr(2, 12)}`;
    return {
      id: randomId,
      name: `Plugin ${randomId}`,
      version: `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      description: `Description for ${randomId}. This is a longer description to simulate real-world data with varying length content.`,
      author: `Author ${Math.floor(Math.random() * 100)}`,
      category: ['Development', 'Monitoring', 'Security', 'Documentation', 'CI/CD'][Math.floor(Math.random() * 5)],
      tags: this.generateRandomTags(),
      icon: 'package',
      downloadCount: Math.floor(Math.random() * 10000),
      rating: Math.random() * 5,
      reviews: Math.floor(Math.random() * 500),
      lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      repository: `https://github.com/test/${randomId}`,
      homepage: `https://${randomId}.example.com`,
      license: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause'][Math.floor(Math.random() * 4)],
      size: `${(Math.random() * 10 + 0.1).toFixed(1)} MB`,
      compatibility: this.generateCompatibilityVersions(),
      config: {
        required: Math.random() > 0.5,
        schema: {
          type: 'object',
          properties: {
            apiUrl: { type: 'string', format: 'uri' },
            timeout: { type: 'number', minimum: 1000 },
            retries: { type: 'number', minimum: 0, maximum: 5 },
            enableLogging: { type: 'boolean' },
          },
        },
      },
    };
  }

  private generateRandomTags(): string[] {
    const allTags = [
      'api', 'monitoring', 'security', 'docs', 'ci/cd', 'testing', 'deployment',
      'analytics', 'logging', 'notification', 'integration', 'database',
      'kubernetes', 'docker', 'aws', 'azure', 'gcp', 'github', 'gitlab',
    ];
    const numTags = Math.floor(Math.random() * 5) + 1;
    const shuffled = allTags.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numTags);
  }

  private generateCompatibilityVersions(): string[] {
    const versions = ['1.18.0', '1.19.0', '1.20.0', '1.21.0', '1.22.0', '1.23.0'];
    const numVersions = Math.floor(Math.random() * 3) + 2;
    return versions.slice(-numVersions);
  }

  private async measureOperation<T>(
    operation: string,
    iterations: number,
    operationFn: () => Promise<T>
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let totalTime = 0;

    console.log(`Running ${operation} benchmark (${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await operationFn();
        const end = performance.now();
        const duration = end - start;
        times.push(duration);
        totalTime += duration;
      } catch (error) {
        console.error(`Error in ${operation} iteration ${i}:`, error);
        throw error;
      }

      // Progress indicator
      if ((i + 1) % Math.max(1, Math.floor(iterations / 10)) === 0) {
        console.log(`  Progress: ${i + 1}/${iterations} (${((i + 1) / iterations * 100).toFixed(1)}%)`);
      }
    }

    times.sort((a, b) => a - b);
    const averageTime = totalTime / iterations;
    const opsPerSecond = 1000 / averageTime; // Convert ms to ops/sec

    return {
      operation,
      iterations,
      totalTime,
      averageTime,
      minTime: times[0],
      maxTime: times[times.length - 1],
      opsPerSecond,
      percentiles: {
        p50: times[Math.floor(times.length * 0.5)],
        p90: times[Math.floor(times.length * 0.9)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)],
      },
    };
  }

  async benchmarkPluginCreation(iterations: number = 1000): Promise<void> {
    const result = await this.measureOperation(
      'Plugin Creation',
      iterations,
      async () => {
        const plugin = this.generateMockPlugin();
        await this.prisma.plugin.create({ data: plugin });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkPluginRetrieval(iterations: number = 1000): Promise<void> {
    // First, create some plugins to retrieve
    const pluginIds: string[] = [];
    for (let i = 0; i < Math.min(100, iterations); i++) {
      const plugin = this.generateMockPlugin();
      await this.prisma.plugin.create({ data: plugin });
      pluginIds.push(plugin.id);
    }

    const result = await this.measureOperation(
      'Plugin Retrieval by ID',
      iterations,
      async () => {
        const randomId = pluginIds[Math.floor(Math.random() * pluginIds.length)];
        await this.prisma.plugin.findUnique({ where: { id: randomId } });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkPluginUpdate(iterations: number = 500): Promise<void> {
    // Create plugins to update
    const pluginIds: string[] = [];
    for (let i = 0; i < Math.min(50, iterations); i++) {
      const plugin = this.generateMockPlugin();
      await this.prisma.plugin.create({ data: plugin });
      pluginIds.push(plugin.id);
    }

    const result = await this.measureOperation(
      'Plugin Update',
      iterations,
      async () => {
        const randomId = pluginIds[Math.floor(Math.random() * pluginIds.length)];
        await this.prisma.plugin.update({
          where: { id: randomId },
          data: {
            downloadCount: Math.floor(Math.random() * 10000),
            rating: Math.random() * 5,
            lastUpdated: new Date(),
          },
        });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkPluginSearch(iterations: number = 500): Promise<void> {
    // Create a larger dataset for search
    const searchTerms = ['api', 'monitor', 'security', 'test', 'deploy'];
    const categories = ['Development', 'Monitoring', 'Security', 'Documentation'];

    const result = await this.measureOperation(
      'Plugin Search',
      iterations,
      async () => {
        const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];

        await this.prisma.plugin.findMany({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
              { tags: { has: searchTerm } },
            ],
            AND: [
              { category: category },
              { rating: { gte: 3.0 } },
            ],
          },
          take: 20,
          orderBy: { rating: 'desc' },
        });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkPluginPagination(iterations: number = 200): Promise<void> {
    const result = await this.measureOperation(
      'Plugin Pagination',
      iterations,
      async () => {
        const page = Math.floor(Math.random() * 10);
        const pageSize = 20;
        
        await this.prisma.plugin.findMany({
          take: pageSize,
          skip: page * pageSize,
          orderBy: [
            { rating: 'desc' },
            { downloadCount: 'desc' },
          ],
        });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkComplexQueries(iterations: number = 100): Promise<void> {
    const result = await this.measureOperation(
      'Complex Plugin Queries with Relations',
      iterations,
      async () => {
        await this.prisma.plugin.findMany({
          where: {
            AND: [
              {
                OR: [
                  { category: 'Development' },
                  { category: 'Monitoring' },
                ],
              },
              { rating: { gte: 4.0 } },
              { downloadCount: { gte: 1000 } },
              {
                lastUpdated: {
                  gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // Last 6 months
                },
              },
            ],
          },
          include: {
            installations: {
              take: 5,
              orderBy: { installedAt: 'desc' },
            },
            dependencies: {
              include: {
                dependsOnPlugin: true,
              },
            },
          },
          take: 10,
          orderBy: [
            { rating: 'desc' },
            { downloadCount: 'desc' },
          ],
        });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkBatchOperations(iterations: number = 50): Promise<void> {
    const result = await this.measureOperation(
      'Batch Plugin Creation',
      iterations,
      async () => {
        const batchSize = 20;
        const plugins = Array.from({ length: batchSize }, () => this.generateMockPlugin());
        
        await this.prisma.plugin.createMany({
          data: plugins,
          skipDuplicates: true,
        });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkTransactions(iterations: number = 100): Promise<void> {
    const result = await this.measureOperation(
      'Plugin Installation Transaction',
      iterations,
      async () => {
        const plugin = this.generateMockPlugin();
        
        await this.prisma.$transaction(async (prisma) => {
          const createdPlugin = await prisma.plugin.create({ data: plugin });
          
          await prisma.pluginInstallation.create({
            data: {
              id: `installation-${Math.random().toString(36).substr(2, 12)}`,
              pluginId: createdPlugin.id,
              status: 'installed',
              version: createdPlugin.version,
              installedAt: new Date(),
              installedBy: 'benchmark-user',
              config: {},
              containerId: `container-${Math.random().toString(36).substr(2, 12)}`,
              health: 'healthy',
              lastHealthCheck: new Date(),
              metrics: {
                uptime: 100,
                errorRate: 0,
                responseTime: Math.floor(Math.random() * 100) + 10,
              },
            },
          });
        });
      }
    );

    this.results.results.push(result);
  }

  async benchmarkAggregations(iterations: number = 100): Promise<void> {
    const result = await this.measureOperation(
      'Plugin Analytics Aggregations',
      iterations,
      async () => {
        // Multiple aggregation queries
        const [
          totalPlugins,
          avgRating,
          categoryStats,
          recentInstalls,
        ] = await Promise.all([
          this.prisma.plugin.count(),
          
          this.prisma.plugin.aggregate({
            _avg: { rating: true, downloadCount: true },
            _max: { rating: true },
            _min: { rating: true },
          }),
          
          this.prisma.plugin.groupBy({
            by: ['category'],
            _count: { category: true },
            _avg: { rating: true },
            orderBy: { _count: { category: 'desc' } },
          }),
          
          this.prisma.pluginInstallation.count({
            where: {
              installedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
              },
            },
          }),
        ]);
      }
    );

    this.results.results.push(result);
  }

  private generateSummary(): void {
    this.results.summary.totalOperations = this.results.results.reduce(
      (sum, result) => sum + result.iterations,
      0
    );
    
    this.results.summary.totalTime = this.results.results.reduce(
      (sum, result) => sum + result.totalTime,
      0
    );
    
    this.results.summary.averageOpsPerSecond = this.results.results.reduce(
      (sum, result) => sum + result.opsPerSecond,
      0
    ) / this.results.results.length;
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE PERFORMANCE BENCHMARK RESULTS');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${this.results.timestamp.toISOString()}`);
    console.log(`Database: ${this.results.databaseUrl}`);
    console.log();

    this.results.results.forEach((result) => {
      console.log(`\n${result.operation}:`);
      console.log(`  Iterations: ${result.iterations.toLocaleString()}`);
      console.log(`  Total Time: ${(result.totalTime / 1000).toFixed(2)}s`);
      console.log(`  Average Time: ${result.averageTime.toFixed(2)}ms`);
      console.log(`  Min/Max Time: ${result.minTime.toFixed(2)}ms / ${result.maxTime.toFixed(2)}ms`);
      console.log(`  Operations/sec: ${result.opsPerSecond.toFixed(2)}`);
      console.log(`  Percentiles:`);
      console.log(`    P50: ${result.percentiles.p50.toFixed(2)}ms`);
      console.log(`    P90: ${result.percentiles.p90.toFixed(2)}ms`);
      console.log(`    P95: ${result.percentiles.p95.toFixed(2)}ms`);
      console.log(`    P99: ${result.percentiles.p99.toFixed(2)}ms`);
    });

    console.log(`\n${'='.repeat(40)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(40)}`);
    console.log(`Total Operations: ${this.results.summary.totalOperations.toLocaleString()}`);
    console.log(`Total Time: ${(this.results.summary.totalTime / 1000).toFixed(2)}s`);
    console.log(`Average Ops/sec: ${this.results.summary.averageOpsPerSecond.toFixed(2)}`);
  }

  private saveResults(): void {
    const filename = `db-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${filename}`);
  }

  async setupTestData(): Promise<void> {
    console.log('Setting up test data for benchmarks...');
    
    // Clean existing data
    await this.prisma.pluginInstallation.deleteMany();
    await this.prisma.pluginDependency.deleteMany();
    await this.prisma.plugin.deleteMany();
    
    // Create a substantial dataset
    const batches = 50; // Create 5000 plugins total
    const batchSize = 100;
    
    for (let batch = 0; batch < batches; batch++) {
      const plugins = Array.from({ length: batchSize }, () => 
        this.generateMockPlugin(`benchmark-plugin-${batch}-${Math.random().toString(36).substr(2, 8)}`)
      );
      
      await this.prisma.plugin.createMany({
        data: plugins,
        skipDuplicates: true,
      });
      
      console.log(`Created batch ${batch + 1}/${batches}`);
    }
    
    console.log('Test data setup completed.');
  }

  async runFullBenchmarkSuite(): Promise<void> {
    console.log('Starting comprehensive database performance benchmark...');
    
    try {
      await this.prisma.$connect();
      
      // Setup test data
      await this.setupTestData();
      
      // Run benchmarks
      await this.benchmarkPluginCreation(1000);
      await this.benchmarkPluginRetrieval(2000);
      await this.benchmarkPluginUpdate(500);
      await this.benchmarkPluginSearch(1000);
      await this.benchmarkPluginPagination(500);
      await this.benchmarkComplexQueries(200);
      await this.benchmarkBatchOperations(100);
      await this.benchmarkTransactions(200);
      await this.benchmarkAggregations(100);
      
      // Generate summary and print results
      this.generateSummary();
      this.printResults();
      this.saveResults();
      
    } catch (error) {
      console.error('Benchmark failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

// Main execution
async function main() {
  const benchmark = new DatabasePerformanceBenchmark();
  
  try {
    await benchmark.runFullBenchmarkSuite();
    process.exit(0);
  } catch (error) {
    console.error('Benchmark suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DatabasePerformanceBenchmark };