// ============================================
// MONGODB SCHEMAS FOR PLUGIN MANAGEMENT
// Document Storage and Catalog Data
// ============================================

const { MongoClient, ObjectId } = require('mongodb');

// ============================================
// PLUGIN CATALOG DOCUMENTS
// ============================================

/**
 * Plugin Catalog Entry Schema
 * Stores comprehensive plugin metadata and documentation
 */
const pluginCatalogSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["pluginId", "name", "version", "metadata", "createdAt"],
    properties: {
      _id: { bsonType: "objectId" },
      pluginId: { bsonType: "string", description: "Reference to plugin in PostgreSQL" },
      tenantId: { bsonType: "string", description: "Tenant identifier" },
      
      // Basic Information
      name: { bsonType: "string", pattern: "^[@a-z0-9/-]+$" },
      displayName: { bsonType: "string" },
      version: { bsonType: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+.*$" },
      description: { bsonType: "string" },
      shortDescription: { bsonType: "string", maxLength: 160 },
      
      // Comprehensive Metadata
      metadata: {
        bsonType: "object",
        properties: {
          category: { enum: ["AUTHENTICATION", "CICD", "MONITORING", "SECURITY", "OTHER"] },
          tags: { bsonType: "array", items: { bsonType: "string" } },
          keywords: { bsonType: "array", items: { bsonType: "string" } },
          
          // Author Information
          author: {
            bsonType: "object",
            properties: {
              name: { bsonType: "string" },
              email: { bsonType: "string", pattern: "^[\\w\\.-]+@[\\w\\.-]+\\.[\\w]+$" },
              url: { bsonType: "string" },
              organization: { bsonType: "string" }
            }
          },
          
          // Repository Information
          repository: {
            bsonType: "object",
            properties: {
              type: { enum: ["git", "svn", "mercurial"] },
              url: { bsonType: "string" },
              directory: { bsonType: "string" },
              branch: { bsonType: "string", default: "main" }
            }
          },
          
          // License Information
          license: {
            bsonType: "object",
            properties: {
              type: { bsonType: "string" },
              url: { bsonType: "string" }
            }
          },
          
          // Dependencies
          dependencies: {
            bsonType: "object",
            patternProperties: {
              "^[@a-z0-9/-]+$": { bsonType: "string" }
            }
          },
          peerDependencies: {
            bsonType: "object",
            patternProperties: {
              "^[@a-z0-9/-]+$": { bsonType: "string" }
            }
          },
          
          // System Requirements
          engines: {
            bsonType: "object",
            properties: {
              node: { bsonType: "string" },
              npm: { bsonType: "string" }
            }
          },
          
          // Backstage Specific
          backstage: {
            bsonType: "object",
            properties: {
              version: { bsonType: "string" },
              role: { enum: ["frontend-plugin", "backend-plugin", "common-library", "web-library", "node-library"] },
              pluginId: { bsonType: "string" },
              pluginPackages: { bsonType: "array", items: { bsonType: "string" } }
            }
          }
        }
      },
      
      // Documentation
      documentation: {
        bsonType: "object",
        properties: {
          readme: { bsonType: "string" },
          changelog: { bsonType: "string" },
          installation: { bsonType: "string" },
          configuration: { bsonType: "string" },
          usage: { bsonType: "string" },
          examples: { bsonType: "array", items: { bsonType: "object" } },
          api: { bsonType: "object" },
          faq: { bsonType: "string" },
          troubleshooting: { bsonType: "string" }
        }
      },
      
      // Media Assets
      media: {
        bsonType: "object",
        properties: {
          logo: { bsonType: "string" },
          screenshots: { bsonType: "array", items: { bsonType: "string" } },
          videos: { bsonType: "array", items: { bsonType: "object" } },
          banner: { bsonType: "string" },
          icon: { bsonType: "string" }
        }
      },
      
      // Configuration Schema
      configSchema: {
        bsonType: "object",
        properties: {
          type: { enum: ["object", "array", "string", "number", "boolean"] },
          properties: { bsonType: "object" },
          required: { bsonType: "array", items: { bsonType: "string" } },
          examples: { bsonType: "array" }
        }
      },
      
      // Quality Metrics
      quality: {
        bsonType: "object",
        properties: {
          healthScore: { bsonType: "double", minimum: 0, maximum: 100 },
          securityScore: { bsonType: "double", minimum: 0, maximum: 100 },
          maintenanceScore: { bsonType: "double", minimum: 0, maximum: 100 },
          codeQuality: {
            bsonType: "object",
            properties: {
              coverage: { bsonType: "double", minimum: 0, maximum: 100 },
              complexity: { bsonType: "double" },
              duplicateCode: { bsonType: "double", minimum: 0, maximum: 100 },
              maintainabilityIndex: { bsonType: "double", minimum: 0, maximum: 100 }
            }
          },
          security: {
            bsonType: "object",
            properties: {
              vulnerabilities: { bsonType: "array" },
              lastScan: { bsonType: "date" },
              scanStatus: { enum: ["PASSED", "FAILED", "PENDING", "SKIPPED"] }
            }
          }
        }
      },
      
      // Statistics
      stats: {
        bsonType: "object",
        properties: {
          downloads: {
            bsonType: "object",
            properties: {
              total: { bsonType: "long" },
              monthly: { bsonType: "long" },
              weekly: { bsonType: "long" },
              daily: { bsonType: "long" }
            }
          },
          github: {
            bsonType: "object",
            properties: {
              stars: { bsonType: "int" },
              forks: { bsonType: "int" },
              issues: { bsonType: "int" },
              pullRequests: { bsonType: "int" },
              lastCommit: { bsonType: "date" }
            }
          },
          npm: {
            bsonType: "object",
            properties: {
              version: { bsonType: "string" },
              publishedAt: { bsonType: "date" },
              maintainers: { bsonType: "array" },
              size: { bsonType: "long" }
            }
          }
        }
      },
      
      // Publishing Information
      publishing: {
        bsonType: "object",
        properties: {
          status: { enum: ["DRAFT", "PUBLISHED", "DEPRECATED", "ARCHIVED"] },
          publishedAt: { bsonType: "date" },
          deprecatedAt: { bsonType: "date" },
          archivedAt: { bsonType: "date" },
          publisher: { bsonType: "string" },
          approvers: { bsonType: "array", items: { bsonType: "string" } }
        }
      },
      
      // Timestamps
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      
      // Full-text search fields
      searchText: { bsonType: "string" },
      searchKeywords: { bsonType: "array", items: { bsonType: "string" } }
    }
  }
};

/**
 * Plugin Configuration Templates Schema
 * Stores configuration templates and examples
 */
const configurationTemplateSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["templateId", "pluginId", "name", "template", "createdAt"],
    properties: {
      _id: { bsonType: "objectId" },
      templateId: { bsonType: "string" },
      pluginId: { bsonType: "string" },
      tenantId: { bsonType: "string" },
      
      name: { bsonType: "string" },
      displayName: { bsonType: "string" },
      description: { bsonType: "string" },
      category: { enum: ["BASIC", "ADVANCED", "PRODUCTION", "DEVELOPMENT", "TESTING"] },
      
      template: {
        bsonType: "object",
        properties: {
          config: { bsonType: "object" },
          environment: { bsonType: "string" },
          variables: { bsonType: "object" },
          secrets: { bsonType: "array", items: { bsonType: "string" } }
        }
      },
      
      metadata: {
        bsonType: "object",
        properties: {
          version: { bsonType: "string" },
          compatibility: { bsonType: "array", items: { bsonType: "string" } },
          tags: { bsonType: "array", items: { bsonType: "string" } },
          author: { bsonType: "string" },
          isOfficial: { bsonType: "bool", default: false },
          isPublic: { bsonType: "bool", default: false },
          usageCount: { bsonType: "long", default: 0 }
        }
      },
      
      validation: {
        bsonType: "object",
        properties: {
          schema: { bsonType: "object" },
          rules: { bsonType: "array" },
          required: { bsonType: "array", items: { bsonType: "string" } }
        }
      },
      
      examples: {
        bsonType: "array",
        items: {
          bsonType: "object",
          properties: {
            name: { bsonType: "string" },
            description: { bsonType: "string" },
            config: { bsonType: "object" }
          }
        }
      },
      
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  }
};

/**
 * Plugin Usage Analytics Documents Schema
 * Stores detailed usage analytics and user behavior
 */
const usageAnalyticsSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["sessionId", "pluginId", "timestamp"],
    properties: {
      _id: { bsonType: "objectId" },
      sessionId: { bsonType: "string" },
      pluginId: { bsonType: "string" },
      tenantId: { bsonType: "string" },
      userId: { bsonType: "string" },
      
      event: {
        bsonType: "object",
        required: ["type", "timestamp"],
        properties: {
          type: { enum: ["VIEW", "INSTALL", "CONFIGURE", "ERROR", "INTERACTION"] },
          timestamp: { bsonType: "date" },
          duration: { bsonType: "long" },
          source: { enum: ["WEB", "API", "CLI", "MOBILE"] }
        }
      },
      
      context: {
        bsonType: "object",
        properties: {
          userAgent: { bsonType: "string" },
          platform: { bsonType: "string" },
          browser: { bsonType: "string" },
          version: { bsonType: "string" },
          viewport: {
            bsonType: "object",
            properties: {
              width: { bsonType: "int" },
              height: { bsonType: "int" }
            }
          },
          location: {
            bsonType: "object",
            properties: {
              country: { bsonType: "string" },
              region: { bsonType: "string" },
              city: { bsonType: "string" },
              timezone: { bsonType: "string" }
            }
          }
        }
      },
      
      interaction: {
        bsonType: "object",
        properties: {
          element: { bsonType: "string" },
          action: { enum: ["CLICK", "HOVER", "SCROLL", "FOCUS", "INPUT"] },
          coordinates: {
            bsonType: "object",
            properties: {
              x: { bsonType: "int" },
              y: { bsonType: "int" }
            }
          },
          value: { bsonType: "string" }
        }
      },
      
      performance: {
        bsonType: "object",
        properties: {
          loadTime: { bsonType: "double" },
          renderTime: { bsonType: "double" },
          memoryUsage: { bsonType: "long" },
          networkLatency: { bsonType: "double" },
          bundleSize: { bsonType: "long" }
        }
      },
      
      error: {
        bsonType: "object",
        properties: {
          message: { bsonType: "string" },
          stack: { bsonType: "string" },
          code: { bsonType: "string" },
          severity: { enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }
        }
      },
      
      metadata: { bsonType: "object" },
      
      timestamp: { bsonType: "date" }
    }
  }
};

/**
 * Plugin Knowledge Base Schema
 * Stores documentation, tutorials, and community content
 */
const knowledgeBaseSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["contentId", "type", "title", "content", "createdAt"],
    properties: {
      _id: { bsonType: "objectId" },
      contentId: { bsonType: "string" },
      pluginId: { bsonType: "string" },
      tenantId: { bsonType: "string" },
      
      type: { enum: ["DOCUMENTATION", "TUTORIAL", "FAQ", "TROUBLESHOOTING", "BEST_PRACTICES", "EXAMPLES"] },
      category: { bsonType: "string" },
      
      title: { bsonType: "string" },
      subtitle: { bsonType: "string" },
      summary: { bsonType: "string", maxLength: 300 },
      
      content: {
        bsonType: "object",
        properties: {
          markdown: { bsonType: "string" },
          html: { bsonType: "string" },
          blocks: { bsonType: "array" }, // For block-based editors
          metadata: {
            bsonType: "object",
            properties: {
              readingTime: { bsonType: "int" },
              wordCount: { bsonType: "int" },
              language: { bsonType: "string", default: "en" }
            }
          }
        }
      },
      
      structure: {
        bsonType: "object",
        properties: {
          headings: { bsonType: "array" },
          toc: { bsonType: "array" },
          sections: { bsonType: "array" }
        }
      },
      
      media: {
        bsonType: "object",
        properties: {
          images: { bsonType: "array" },
          videos: { bsonType: "array" },
          attachments: { bsonType: "array" }
        }
      },
      
      tags: { bsonType: "array", items: { bsonType: "string" } },
      difficulty: { enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] },
      
      // Authoring
      author: {
        bsonType: "object",
        properties: {
          id: { bsonType: "string" },
          name: { bsonType: "string" },
          avatar: { bsonType: "string" },
          role: { bsonType: "string" }
        }
      },
      
      contributors: {
        bsonType: "array",
        items: {
          bsonType: "object",
          properties: {
            id: { bsonType: "string" },
            name: { bsonType: "string" },
            contribution: { bsonType: "string" }
          }
        }
      },
      
      // Publishing
      status: { enum: ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] },
      visibility: { enum: ["PUBLIC", "INTERNAL", "PRIVATE"] },
      publishedAt: { bsonType: "date" },
      
      // Engagement
      stats: {
        bsonType: "object",
        properties: {
          views: { bsonType: "long", default: 0 },
          likes: { bsonType: "long", default: 0 },
          shares: { bsonType: "long", default: 0 },
          bookmarks: { bsonType: "long", default: 0 },
          comments: { bsonType: "long", default: 0 },
          rating: {
            bsonType: "object",
            properties: {
              average: { bsonType: "double" },
              count: { bsonType: "long" }
            }
          }
        }
      },
      
      // SEO
      seo: {
        bsonType: "object",
        properties: {
          slug: { bsonType: "string" },
          metaDescription: { bsonType: "string" },
          metaKeywords: { bsonType: "array", items: { bsonType: "string" } },
          canonicalUrl: { bsonType: "string" }
        }
      },
      
      // Versioning
      version: { bsonType: "string", default: "1.0.0" },
      previousVersions: { bsonType: "array" },
      
      // Full-text search
      searchText: { bsonType: "string" },
      
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  }
};

// ============================================
// COLLECTION CONFIGURATIONS
// ============================================

const collections = {
  pluginCatalog: {
    name: 'pluginCatalog',
    schema: pluginCatalogSchema,
    indexes: [
      { key: { pluginId: 1 }, unique: true },
      { key: { tenantId: 1, "metadata.category": 1 } },
      { key: { name: 1, version: 1 } },
      { key: { "metadata.tags": 1 } },
      { key: { "metadata.keywords": 1 } },
      { key: { searchText: "text", searchKeywords: "text", name: "text" } },
      { key: { "quality.healthScore": -1 } },
      { key: { "stats.downloads.total": -1 } },
      { key: { "publishing.status": 1, "publishing.publishedAt": -1 } },
      { key: { createdAt: -1 } },
      { key: { updatedAt: -1 } }
    ]
  },
  
  configurationTemplates: {
    name: 'configurationTemplates',
    schema: configurationTemplateSchema,
    indexes: [
      { key: { templateId: 1 }, unique: true },
      { key: { pluginId: 1, category: 1 } },
      { key: { tenantId: 1, "metadata.isPublic": 1 } },
      { key: { "metadata.tags": 1 } },
      { key: { "metadata.usageCount": -1 } },
      { key: { createdAt: -1 } }
    ]
  },
  
  usageAnalytics: {
    name: 'usageAnalytics',
    schema: usageAnalyticsSchema,
    indexes: [
      { key: { pluginId: 1, timestamp: -1 } },
      { key: { tenantId: 1, timestamp: -1 } },
      { key: { userId: 1, timestamp: -1 } },
      { key: { sessionId: 1 } },
      { key: { "event.type": 1, timestamp: -1 } },
      { key: { timestamp: -1 }, expireAfterSeconds: 31536000 } // TTL: 1 year
    ]
  },
  
  knowledgeBase: {
    name: 'knowledgeBase',
    schema: knowledgeBaseSchema,
    indexes: [
      { key: { contentId: 1 }, unique: true },
      { key: { pluginId: 1, type: 1 } },
      { key: { tenantId: 1, visibility: 1 } },
      { key: { tags: 1 } },
      { key: { status: 1, publishedAt: -1 } },
      { key: { searchText: "text", title: "text", summary: "text" } },
      { key: { "stats.views": -1 } },
      { key: { "stats.rating.average": -1 } },
      { key: { createdAt: -1 } }
    ]
  }
};

// ============================================
// DATABASE INITIALIZATION AND UTILITIES
// ============================================

class PluginMongoDBManager {
  constructor(connectionString, databaseName = 'plugin_management') {
    this.connectionString = connectionString;
    this.databaseName = databaseName;
    this.client = null;
    this.db = null;
  }
  
  async connect() {
    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      console.log('Connected to MongoDB');
      return true;
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      return false;
    }
  }
  
  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    }
  }
  
  async initializeCollections() {
    for (const [key, config] of Object.entries(collections)) {
      try {
        // Create collection with schema validation
        await this.db.createCollection(config.name, {
          validator: config.schema
        });
        console.log(`Created collection: ${config.name}`);
        
        // Create indexes
        for (const index of config.indexes) {
          await this.db.collection(config.name).createIndex(index.key, index);
        }
        console.log(`Created indexes for: ${config.name}`);
        
      } catch (error) {
        if (error.code === 48) {
          console.log(`Collection ${config.name} already exists`);
        } else {
          console.error(`Error creating collection ${config.name}:`, error);
        }
      }
    }
  }
  
  // Plugin Catalog Operations
  async createPluginCatalogEntry(entry) {
    entry.createdAt = new Date();
    entry.updatedAt = new Date();
    entry.searchText = this.generateSearchText(entry);
    entry.searchKeywords = this.generateSearchKeywords(entry);
    
    return await this.db.collection('pluginCatalog').insertOne(entry);
  }
  
  async updatePluginCatalogEntry(pluginId, update) {
    update.updatedAt = new Date();
    if (update.name || update.description || update.metadata) {
      update.searchText = this.generateSearchText({ ...update });
      update.searchKeywords = this.generateSearchKeywords({ ...update });
    }
    
    return await this.db.collection('pluginCatalog').updateOne(
      { pluginId },
      { $set: update }
    );
  }
  
  async searchPlugins(query, filters = {}, options = {}) {
    const pipeline = [];
    
    // Text search
    if (query) {
      pipeline.push({
        $match: {
          $text: { $search: query }
        }
      });
      pipeline.push({
        $addFields: {
          score: { $meta: "textScore" }
        }
      });
    }
    
    // Filters
    if (Object.keys(filters).length > 0) {
      pipeline.push({ $match: filters });
    }
    
    // Sorting
    const sort = query ? { score: { $meta: "textScore" } } : { "stats.downloads.total": -1 };
    pipeline.push({ $sort: { ...sort, ...options.sort } });
    
    // Pagination
    if (options.skip) pipeline.push({ $skip: options.skip });
    if (options.limit) pipeline.push({ $limit: options.limit });
    
    return await this.db.collection('pluginCatalog').aggregate(pipeline).toArray();
  }
  
  // Analytics Operations
  async recordUsageEvent(event) {
    event.timestamp = new Date();
    return await this.db.collection('usageAnalytics').insertOne(event);
  }
  
  async getUsageAnalytics(pluginId, timeRange = '30d') {
    const startDate = new Date();
    const days = parseInt(timeRange.replace('d', ''));
    startDate.setDate(startDate.getDate() - days);
    
    return await this.db.collection('usageAnalytics').aggregate([
      {
        $match: {
          pluginId: pluginId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            event: "$event.type"
          },
          count: { $sum: 1 },
          avgDuration: { $avg: "$event.duration" }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]).toArray();
  }
  
  // Knowledge Base Operations
  async createKnowledgeBaseEntry(entry) {
    entry.createdAt = new Date();
    entry.updatedAt = new Date();
    entry.searchText = `${entry.title} ${entry.summary} ${entry.content.markdown}`;
    
    return await this.db.collection('knowledgeBase').insertOne(entry);
  }
  
  async searchKnowledgeBase(query, pluginId = null) {
    const matchStage = {
      $text: { $search: query },
      status: 'PUBLISHED'
    };
    
    if (pluginId) {
      matchStage.pluginId = pluginId;
    }
    
    return await this.db.collection('knowledgeBase').find(matchStage)
      .sort({ score: { $meta: "textScore" } })
      .limit(20)
      .toArray();
  }
  
  // Utility Methods
  generateSearchText(entry) {
    const parts = [
      entry.name,
      entry.displayName,
      entry.description,
      entry.metadata?.tags?.join(' ') || '',
      entry.metadata?.keywords?.join(' ') || '',
      entry.metadata?.author?.name || ''
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  }
  
  generateSearchKeywords(entry) {
    const keywords = new Set();
    
    if (entry.name) keywords.add(entry.name.toLowerCase());
    if (entry.displayName) keywords.add(entry.displayName.toLowerCase());
    if (entry.metadata?.tags) entry.metadata.tags.forEach(tag => keywords.add(tag.toLowerCase()));
    if (entry.metadata?.keywords) entry.metadata.keywords.forEach(kw => keywords.add(kw.toLowerCase()));
    
    return Array.from(keywords);
  }
}

// ============================================
// AGGREGATION PIPELINES
// ============================================

const aggregationPipelines = {
  // Plugin popularity ranking
  pluginPopularity: [
    {
      $match: {
        "publishing.status": "PUBLISHED"
      }
    },
    {
      $addFields: {
        popularityScore: {
          $add: [
            { $multiply: ["$stats.downloads.total", 0.4] },
            { $multiply: ["$stats.github.stars", 0.3] },
            { $multiply: ["$quality.healthScore", 0.2] },
            { $multiply: ["$stats.github.forks", 0.1] }
          ]
        }
      }
    },
    {
      $sort: { popularityScore: -1 }
    },
    {
      $limit: 50
    }
  ],
  
  // Category-wise plugin distribution
  categoryDistribution: [
    {
      $match: {
        "publishing.status": "PUBLISHED"
      }
    },
    {
      $group: {
        _id: "$metadata.category",
        count: { $sum: 1 },
        avgHealthScore: { $avg: "$quality.healthScore" },
        totalDownloads: { $sum: "$stats.downloads.total" }
      }
    },
    {
      $sort: { count: -1 }
    }
  ],
  
  // Plugin health report
  pluginHealthReport: [
    {
      $match: {
        "publishing.status": "PUBLISHED"
      }
    },
    {
      $addFields: {
        healthCategory: {
          $switch: {
            branches: [
              { case: { $gte: ["$quality.healthScore", 80] }, then: "Excellent" },
              { case: { $gte: ["$quality.healthScore", 60] }, then: "Good" },
              { case: { $gte: ["$quality.healthScore", 40] }, then: "Fair" },
              { case: { $gte: ["$quality.healthScore", 20] }, then: "Poor" }
            ],
            default: "Critical"
          }
        }
      }
    },
    {
      $group: {
        _id: "$healthCategory",
        count: { $sum: 1 },
        plugins: { $push: { name: "$name", score: "$quality.healthScore" } }
      }
    }
  ]
};

module.exports = {
  PluginMongoDBManager,
  collections,
  aggregationPipelines,
  schemas: {
    pluginCatalogSchema,
    configurationTemplateSchema,
    usageAnalyticsSchema,
    knowledgeBaseSchema
  }
};

// ============================================
// USAGE EXAMPLE
// ============================================

/*
const { PluginMongoDBManager } = require('./mongodb_schemas');

async function example() {
  const manager = new PluginMongoDBManager('mongodb://localhost:27017');
  
  await manager.connect();
  await manager.initializeCollections();
  
  // Create a plugin catalog entry
  await manager.createPluginCatalogEntry({
    pluginId: 'plugin-123',
    name: '@backstage/plugin-kubernetes',
    displayName: 'Kubernetes Plugin',
    version: '1.0.0',
    description: 'Kubernetes integration for Backstage',
    metadata: {
      category: 'MONITORING',
      tags: ['kubernetes', 'monitoring', 'devops'],
      author: {
        name: 'Backstage Team',
        email: 'team@backstage.io'
      }
    }
  });
  
  // Search plugins
  const results = await manager.searchPlugins('kubernetes monitoring', {
    'metadata.category': 'MONITORING'
  });
  
  await manager.disconnect();
}
*/