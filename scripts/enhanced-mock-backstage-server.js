#!/usr/bin/env node

/**
 * Enhanced Mock Backstage Server with TechCorp Demo Data
 * Provides realistic demo environment for sales and POCs
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Load demo data
let demoData = {};
let catalogEntities = [];
let pluginsData = [];

try {
  const demoDataPath = path.join(__dirname, '..', 'demo-data');
  
  if (fs.existsSync(path.join(demoDataPath, 'techcorp-demo.json'))) {
    demoData = JSON.parse(fs.readFileSync(path.join(demoDataPath, 'techcorp-demo.json'), 'utf8'));
  }
  
  if (fs.existsSync(path.join(demoDataPath, 'catalog-entities.json'))) {
    const catalogData = JSON.parse(fs.readFileSync(path.join(demoDataPath, 'catalog-entities.json'), 'utf8'));
    catalogEntities = catalogData.entities || [];
  }
  
  if (fs.existsSync(path.join(demoDataPath, 'plugins.json'))) {
    const pluginFile = JSON.parse(fs.readFileSync(path.join(demoDataPath, 'plugins.json'), 'utf8'));
    pluginsData = pluginFile.plugins || [];
  }
  
  console.log(`✅ Loaded demo data: ${catalogEntities.length} services, ${pluginsData.length} plugins`);
} catch (error) {
  console.warn('⚠️ Demo data not found, using fallback data');
  
  // Fallback data if demo data doesn't exist
  catalogEntities = [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'sample-service',
        title: 'Sample Service',
        description: 'A sample service for demonstration'
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'platform-team'
      }
    }
  ];
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    mode: 'demo',
    company: demoData.company?.name || 'TechCorp',
    services: catalogEntities.length,
    plugins: pluginsData.length
  });
});

// Catalog API endpoints
app.get('/api/catalog/entities', (req, res) => {
  const { kind, type, lifecycle, owner, tag, limit, offset } = req.query;
  
  let filtered = [...catalogEntities];
  
  // Apply filters
  if (kind) {
    filtered = filtered.filter(e => e.kind === kind);
  }
  if (type) {
    filtered = filtered.filter(e => e.spec?.type === type);
  }
  if (lifecycle) {
    filtered = filtered.filter(e => e.spec?.lifecycle === lifecycle);
  }
  if (owner) {
    filtered = filtered.filter(e => e.spec?.owner === owner);
  }
  if (tag) {
    const tags = Array.isArray(tag) ? tag : [tag];
    filtered = filtered.filter(e => {
      const entityTags = e.metadata?.tags || [];
      return tags.some(t => entityTags.includes(t));
    });
  }
  
  // Apply pagination
  const start = parseInt(offset) || 0;
  const end = limit ? start + parseInt(limit) : undefined;
  const paginated = filtered.slice(start, end);
  
  res.json({
    items: paginated,
    totalItems: filtered.length,
    pageInfo: {
      offset: start,
      limit: limit ? parseInt(limit) : filtered.length,
      total: filtered.length
    }
  });
});

// Get single entity
app.get('/api/catalog/entities/by-name/:kind/:namespace/:name', (req, res) => {
  const { kind, namespace, name } = req.params;
  
  const entity = catalogEntities.find(e => 
    e.kind === kind && 
    e.metadata.name === name &&
    (e.metadata.namespace || 'default') === namespace
  );
  
  if (entity) {
    res.json(entity);
  } else {
    res.status(404).json({ error: 'Entity not found' });
  }
});

// Plugins API
app.get('/api/plugins', (req, res) => {
  const { category, state, installed } = req.query;
  
  let filtered = [...pluginsData];
  
  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }
  if (state) {
    filtered = filtered.filter(p => p.state === state);
  }
  if (installed === 'true') {
    filtered = filtered.filter(p => p.state === 'installed' || p.state === 'updating');
  }
  
  res.json({
    plugins: filtered,
    total: filtered.length,
    categories: [...new Set(pluginsData.map(p => p.category))],
    stats: {
      installed: pluginsData.filter(p => p.state === 'installed').length,
      available: pluginsData.filter(p => p.state === 'available').length,
      updating: pluginsData.filter(p => p.state === 'updating').length
    }
  });
});

// Metrics API
app.get('/api/metrics', (req, res) => {
  res.json(demoData.metrics || {
    dora: {
      deploymentFrequency: 12.5,
      leadTime: 2.3,
      mttr: 45,
      changeFailureRate: 5.2
    }
  });
});

// Cost API
app.get('/api/costs', (req, res) => {
  res.json(demoData.costs || {
    current: { monthly: 485000, annual: 5820000 },
    optimization: { identified: 125000 }
  });
});

// Compliance API
app.get('/api/compliance', (req, res) => {
  res.json(demoData.compliance || {
    frameworks: [],
    violations: []
  });
});

// Teams API
app.get('/api/teams', (req, res) => {
  res.json({
    teams: demoData.teams || [],
    total: demoData.teams?.length || 0
  });
});

// Incidents API
app.get('/api/incidents', (req, res) => {
  res.json({
    incidents: demoData.incidents || [],
    total: demoData.incidents?.length || 0
  });
});

// Templates API
app.get('/api/scaffolder/templates', (req, res) => {
  res.json({
    templates: [
      {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'microservice-template',
          title: 'Microservice Template',
          description: 'Create a production-ready microservice',
          tags: ['backend', 'microservice', 'kubernetes-ready']
        },
        spec: {
          type: 'service',
          owner: 'platform-team'
        }
      },
      {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'react-spa-template',
          title: 'React SPA Template',
          description: 'Create a React single-page application',
          tags: ['frontend', 'react', 'typescript']
        },
        spec: {
          type: 'website',
          owner: 'frontend-team'
        }
      },
      {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'data-pipeline-template',
          title: 'Data Pipeline Template',
          description: 'Create a data processing pipeline',
          tags: ['data', 'etl', 'spark']
        },
        spec: {
          type: 'data-pipeline',
          owner: 'data-team'
        }
      },
      {
        apiVersion: 'scaffolder.backstage.io/v1beta3',
        kind: 'Template',
        metadata: {
          name: 'ml-model-template',
          title: 'ML Model Template',
          description: 'Deploy a machine learning model',
          tags: ['ml', 'python', 'tensorflow']
        },
        spec: {
          type: 'ml-model',
          owner: 'ml-team'
        }
      }
    ]
  });
});

// Tech Docs API
app.get('/api/techdocs/entities', (req, res) => {
  const docsEntities = catalogEntities
    .filter(e => e.metadata?.annotations?.['backstage.io/techdocs-ref'])
    .map(e => ({
      apiVersion: e.apiVersion,
      kind: e.kind,
      metadata: {
        name: e.metadata.name,
        namespace: e.metadata.namespace || 'default'
      },
      spec: {
        owner: e.spec?.owner
      }
    }));
  
  res.json({ items: docsEntities });
});

// Search API
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.json({ results: [] });
  }
  
  const query = q.toLowerCase();
  const results = [];
  
  // Search in services
  catalogEntities.forEach(entity => {
    if (
      entity.metadata.name?.toLowerCase().includes(query) ||
      entity.metadata.title?.toLowerCase().includes(query) ||
      entity.metadata.description?.toLowerCase().includes(query)
    ) {
      results.push({
        type: 'service',
        title: entity.metadata.title || entity.metadata.name,
        description: entity.metadata.description,
        url: `/catalog/${entity.kind.toLowerCase()}/${entity.metadata.namespace || 'default'}/${entity.metadata.name}`
      });
    }
  });
  
  // Search in plugins
  pluginsData.forEach(plugin => {
    if (
      plugin.name?.toLowerCase().includes(query) ||
      plugin.title?.toLowerCase().includes(query)
    ) {
      results.push({
        type: 'plugin',
        title: plugin.title,
        description: `Plugin by ${plugin.vendor}`,
        url: `/plugins/${plugin.id}`
      });
    }
  });
  
  res.json({ results, total: results.length });
});

// Activity feed API
app.get('/api/activity', (req, res) => {
  const activities = [
    {
      id: '1',
      type: 'deployment',
      title: 'Deployed payment-processor to production',
      user: 'Sarah Chen',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      status: 'success'
    },
    {
      id: '2',
      type: 'incident',
      title: 'Resolved database connection issue',
      user: 'Mike Johnson',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      status: 'resolved'
    },
    {
      id: '3',
      type: 'plugin',
      title: 'Installed Datadog monitoring plugin',
      user: 'Platform Team',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: 'success'
    },
    {
      id: '4',
      type: 'cost',
      title: 'Saved $25,000 by optimizing EC2 instances',
      user: 'FinOps Team',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      status: 'success'
    },
    {
      id: '5',
      type: 'compliance',
      title: 'Completed SOC2 audit successfully',
      user: 'Security Team',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      status: 'success'
    }
  ];
  
  res.json({ activities, total: activities.length });
});

// Version API
app.get('/api/version', (req, res) => {
  res.json({
    version: '1.42.0',
    gitCommit: 'abc123def',
    buildDate: '2024-08-08',
    mode: 'demo'
  });
});

// Auth API (mock)
app.post('/api/auth/guest', (req, res) => {
  res.json({
    token: 'demo-token-' + Date.now(),
    user: {
      name: 'Demo User',
      email: 'demo@techcorp.com',
      role: 'developer'
    }
  });
});

// Start server
const PORT = process.env.MOCK_BACKSTAGE_PORT || 4402;
app.listen(PORT, () => {
  console.log(`
========================================
🎭 Enhanced Mock Backstage Server
========================================
✅ Running on port ${PORT}
🏢 Company: ${demoData.company?.name || 'TechCorp'}
📊 Services: ${catalogEntities.length}
🔌 Plugins: ${pluginsData.length}
👥 Teams: ${demoData.teams?.length || 0}

API Endpoints:
• GET /api/catalog/entities
• GET /api/plugins
• GET /api/metrics
• GET /api/costs
• GET /api/compliance
• GET /api/teams
• GET /api/incidents
• GET /api/scaffolder/templates
• GET /api/search?q=query
• GET /api/activity

Demo Mode: ACTIVE
========================================
  `);
});