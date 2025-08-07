import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface FederationNode {
  id: string;
  name: string;
  url: string;
  description?: string;
  type: 'primary' | 'replica' | 'peer';
  status: 'active' | 'inactive' | 'syncing' | 'error';
  lastSync?: string;
  plugins: number;
  sharedPlugins: string[];
  trustedBy: string[];
  trustLevel: 'full' | 'partial' | 'read-only';
  apiKey?: string;
  publicKey?: string;
  metadata?: Record<string, any>;
}

interface FederationRequest {
  nodeId: string;
  nodeName: string;
  nodeUrl: string;
  requestType: 'join' | 'share' | 'sync';
  plugins?: string[];
  trustLevel?: 'full' | 'partial' | 'read-only';
  apiKey?: string;
  publicKey?: string;
}

interface SharedPlugin {
  id: string;
  name: string;
  version: string;
  sourceNode: string;
  sharedAt: string;
  visibility: 'public' | 'private' | 'restricted';
  allowedNodes?: string[];
  downloads: number;
  metadata?: Record<string, any>;
}

// In-memory storage for demo
const federationNodes = new Map<string, FederationNode>();
const sharedPlugins = new Map<string, SharedPlugin>();
const federationRequests = new Map<string, FederationRequest>();

// Initialize with sample federation data
const initializeFederation = () => {
  // Primary node (this instance)
  federationNodes.set('primary', {
    id: 'primary',
    name: 'Main Backstage Hub',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    type: 'primary',
    status: 'active',
    lastSync: new Date().toISOString(),
    plugins: 150,
    sharedPlugins: ['github-actions', 'kubernetes', 'sonarqube'],
    trustedBy: [],
    trustLevel: 'full'
  });

  // Sample peer nodes
  federationNodes.set('spotify-hub', {
    id: 'spotify-hub',
    name: 'Spotify Plugin Hub',
    url: 'https://plugins.spotify.backstage.io',
    description: 'Official Spotify Backstage plugins',
    type: 'peer',
    status: 'active',
    lastSync: new Date(Date.now() - 3600000).toISOString(),
    plugins: 87,
    sharedPlugins: ['spotify-api', 'playlist-manager', 'artist-insights'],
    trustedBy: ['primary'],
    trustLevel: 'full'
  });

  federationNodes.set('community-hub', {
    id: 'community-hub',
    name: 'Community Plugin Registry',
    url: 'https://community.backstage.io',
    description: 'Community-contributed Backstage plugins',
    type: 'peer',
    status: 'active',
    lastSync: new Date(Date.now() - 7200000).toISOString(),
    plugins: 342,
    sharedPlugins: ['custom-auth', 'metrics-dashboard', 'cost-insights'],
    trustedBy: ['primary'],
    trustLevel: 'partial'
  });

  // Sample shared plugins
  sharedPlugins.set('github-actions-shared', {
    id: 'github-actions-shared',
    name: '@backstage/plugin-github-actions',
    version: '0.6.15',
    sourceNode: 'primary',
    sharedAt: new Date(Date.now() - 86400000).toISOString(),
    visibility: 'public',
    downloads: 1250
  });

  sharedPlugins.set('spotify-api-shared', {
    id: 'spotify-api-shared',
    name: '@spotify/plugin-spotify-api',
    version: '1.2.3',
    sourceNode: 'spotify-hub',
    sharedAt: new Date(Date.now() - 172800000).toISOString(),
    visibility: 'restricted',
    allowedNodes: ['primary', 'trusted-partner'],
    downloads: 456
  });
};

initializeFederation();

// GET - List federation nodes and status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    let nodes = Array.from(federationNodes.values());

    // Apply filters
    if (type) {
      nodes = nodes.filter(n => n.type === type);
    }

    if (status) {
      nodes = nodes.filter(n => n.status === status);
    }

    // Get shared plugins summary
    const sharedPluginsList = Array.from(sharedPlugins.values());
    
    return NextResponse.json({
      nodes,
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => n.status === 'active').length,
      totalSharedPlugins: sharedPluginsList.length,
      federationStatus: {
        healthy: nodes.every(n => n.status === 'active'),
        lastSync: nodes.reduce((latest, node) => {
          const nodeSync = node.lastSync ? new Date(node.lastSync).getTime() : 0;
          return nodeSync > latest ? nodeSync : latest;
        }, 0)
      }
    });

  } catch (error) {
    console.error('Failed to fetch federation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch federation status' },
      { status: 500 }
    );
  }
}

// POST - Join federation or share plugins
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'join': {
        // Join a federation network
        const { nodeUrl, nodeName, trustLevel = 'read-only' } = body;
        
        if (!nodeUrl || !nodeName) {
          return NextResponse.json(
            { error: 'Node URL and name are required' },
            { status: 400 }
          );
        }

        const nodeId = crypto.randomBytes(8).toString('hex');
        const apiKey = crypto.randomBytes(32).toString('hex');

        const newNode: FederationNode = {
          id: nodeId,
          name: nodeName,
          url: nodeUrl,
          type: 'peer',
          status: 'syncing',
          plugins: 0,
          sharedPlugins: [],
          trustedBy: ['primary'],
          trustLevel,
          apiKey
        };

        federationNodes.set(nodeId, newNode);

        // Simulate sync process
        setTimeout(() => {
          const node = federationNodes.get(nodeId);
          if (node) {
            node.status = 'active';
            node.lastSync = new Date().toISOString();
            node.plugins = Math.floor(Math.random() * 100) + 10;
          }
        }, 3000);

        return NextResponse.json({
          message: 'Successfully joined federation',
          node: newNode,
          apiKey
        });
      }

      case 'share': {
        // Share plugins with federation
        const { plugins, targetNodes, visibility = 'public' } = body;
        
        if (!plugins || plugins.length === 0) {
          return NextResponse.json(
            { error: 'No plugins specified for sharing' },
            { status: 400 }
          );
        }

        const sharedPluginIds = [];
        
        for (const pluginId of plugins) {
          const sharedId = `${pluginId}-shared-${Date.now()}`;
          const sharedPlugin: SharedPlugin = {
            id: sharedId,
            name: pluginId,
            version: 'latest',
            sourceNode: 'primary',
            sharedAt: new Date().toISOString(),
            visibility,
            allowedNodes: targetNodes,
            downloads: 0
          };
          
          sharedPlugins.set(sharedId, sharedPlugin);
          sharedPluginIds.push(sharedId);
        }

        return NextResponse.json({
          message: `Successfully shared ${plugins.length} plugins`,
          sharedPlugins: sharedPluginIds
        });
      }

      case 'sync': {
        // Sync with federation nodes
        const { nodeId } = body;
        
        if (nodeId) {
          const node = federationNodes.get(nodeId);
          if (!node) {
            return NextResponse.json(
              { error: 'Node not found' },
              { status: 404 }
            );
          }
          
          node.status = 'syncing';
          
          // Simulate sync
          setTimeout(() => {
            node.status = 'active';
            node.lastSync = new Date().toISOString();
          }, 2000);
          
          return NextResponse.json({
            message: `Syncing with ${node.name}`,
            node
          });
        } else {
          // Sync all nodes
          const syncPromises = Array.from(federationNodes.values()).map(node => {
            node.status = 'syncing';
            return new Promise(resolve => {
              setTimeout(() => {
                node.status = 'active';
                node.lastSync = new Date().toISOString();
                resolve(node);
              }, Math.random() * 3000);
            });
          });
          
          await Promise.all(syncPromises);
          
          return NextResponse.json({
            message: 'Syncing with all federation nodes',
            nodes: Array.from(federationNodes.values())
          });
        }
      }

      case 'leave': {
        // Leave federation
        const { nodeId } = body;
        
        if (!nodeId) {
          return NextResponse.json(
            { error: 'Node ID is required' },
            { status: 400 }
          );
        }

        const node = federationNodes.get(nodeId);
        if (!node) {
          return NextResponse.json(
            { error: 'Node not found' },
            { status: 404 }
          );
        }

        federationNodes.delete(nodeId);

        // Remove shared plugins from this node
        Array.from(sharedPlugins.values()).forEach(plugin => {
          if (plugin.sourceNode === nodeId) {
            sharedPlugins.delete(plugin.id);
          }
        });

        return NextResponse.json({
          message: `Successfully left federation with ${node.name}`
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Federation operation failed:', error);
    return NextResponse.json(
      { error: 'Federation operation failed' },
      { status: 500 }
    );
  }
}

// PUT - Update federation settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId, updates } = body;

    if (!nodeId) {
      return NextResponse.json(
        { error: 'Node ID is required' },
        { status: 400 }
      );
    }

    const node = federationNodes.get(nodeId);
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    // Update node properties
    Object.assign(node, updates);

    return NextResponse.json({
      message: 'Federation node updated successfully',
      node
    });

  } catch (error) {
    console.error('Failed to update federation node:', error);
    return NextResponse.json(
      { error: 'Failed to update federation node' },
      { status: 500 }
    );
  }
}