/**
 * Basic usage examples for the Backstage TypeScript SDK
 */

import { createBackstageClient } from '@backstage-idp/sdk-typescript';

// Initialize client with API key
const client = createBackstageClient({
  baseURL: 'https://portal.company.com/api',
  apiKey: 'your-api-key-here',
  timeout: 30000,
  retries: 3
});

// Example 1: Check system health
async function checkSystemHealth() {
  console.log('🏥 Checking system health...');
  
  try {
    const health = await client.system.getHealth(true);
    console.log('System Status:', health.status);
    console.log('Services:', health.services);
    console.log('Uptime:', `${Math.floor(health.uptime / 3600)} hours`);
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Example 2: List and install plugins
async function managePlugins() {
  console.log('🔌 Managing plugins...');
  
  try {
    // List available plugins
    const plugins = await client.plugins.list({
      category: 'catalog',
      limit: 10
    });
    
    console.log(`Found ${plugins.total} plugins:`);
    plugins.items.forEach(plugin => {
      console.log(`- ${plugin.name} (${plugin.version}) - ${plugin.status}`);
    });
    
    // Install a plugin
    const catalogPlugin = plugins.items.find(p => p.name.includes('catalog'));
    if (catalogPlugin && catalogPlugin.status === 'available') {
      console.log(`Installing ${catalogPlugin.name}...`);
      
      const result = await client.plugins.install({
        pluginId: catalogPlugin.id,
        version: catalogPlugin.version,
        config: {
          enabled: true,
          refreshInterval: '5m'
        }
      });
      
      console.log('Installation result:', result);
    }
  } catch (error) {
    console.error('Plugin management failed:', error.message);
  }
}

// Example 3: Create and execute workflows
async function workflowManagement() {
  console.log('⚡ Managing workflows...');
  
  try {
    // Create a new workflow
    const workflow = await client.workflows.create({
      name: 'Deploy Service',
      description: 'Automated service deployment workflow',
      steps: [
        {
          id: 'build',
          name: 'Build Docker Image',
          type: 'docker-build',
          status: 'pending',
          config: {
            dockerfile: 'Dockerfile',
            context: '.',
            tags: ['latest']
          }
        },
        {
          id: 'deploy',
          name: 'Deploy to Kubernetes',
          type: 'k8s-deploy',
          status: 'pending',
          config: {
            namespace: 'production',
            replicas: 3,
            healthCheck: '/health'
          }
        }
      ]
    });
    
    console.log('Created workflow:', workflow.id);
    
    // Execute the workflow
    const execution = await client.workflows.execute(workflow.id, {
      parameters: {
        environment: 'staging',
        version: '1.2.3'
      }
    });
    
    console.log('Workflow execution started:', execution.executionId);
    
    // Monitor execution status
    let status = execution.status;
    while (status === 'pending' || status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const updated = await client.workflows.get(workflow.id);
      status = updated.status;
      console.log('Workflow status:', status);
    }
    
  } catch (error) {
    console.error('Workflow management failed:', error.message);
  }
}

// Example 4: Search portal resources
async function searchResources() {
  console.log('🔍 Searching resources...');
  
  try {
    const searchResults = await client.search('microservice', 'service');
    
    console.log(`Found ${searchResults.total} results:`);
    searchResults.results.forEach(result => {
      console.log(`- ${result.title} (${result.type}) - Score: ${result.score}`);
      if (result.description) {
        console.log(`  ${result.description}`);
      }
    });
  } catch (error) {
    console.error('Search failed:', error.message);
  }
}

// Example 5: Manage notifications
async function handleNotifications() {
  console.log('🔔 Managing notifications...');
  
  try {
    // Get recent notifications
    const notifications = await client.notifications.list(false, 10);
    
    console.log(`You have ${notifications.unreadCount} unread notifications:`);
    notifications.notifications.forEach(notification => {
      const status = notification.read ? '✓' : '○';
      console.log(`${status} ${notification.title} - ${notification.type}`);
      console.log(`  ${notification.message}`);
    });
    
    // Mark first notification as read
    if (notifications.notifications.length > 0 && !notifications.notifications[0].read) {
      await client.notifications.markAsRead(notifications.notifications[0].id);
      console.log('Marked notification as read');
    }
    
    // Create a new notification
    await client.notifications.create({
      title: 'SDK Example',
      message: 'This is a test notification from the TypeScript SDK',
      type: 'info'
    });
    
    console.log('Created test notification');
    
  } catch (error) {
    console.error('Notification management failed:', error.message);
  }
}

// Example 6: Real-time event handling with WebSocket
async function handleRealtimeEvents() {
  console.log('📡 Setting up real-time event handling...');
  
  try {
    // Connect to WebSocket
    await client.connect();
    
    // Subscribe to plugin events
    const pluginSubscription = client.events.onPluginEvent((event) => {
      console.log('Plugin event:', event.type, event.data);
    });
    
    // Subscribe to workflow events
    const workflowSubscription = client.events.onWorkflowEvent((event) => {
      console.log('Workflow event:', event.type, event.data);
    });
    
    // Subscribe to system events
    const systemSubscription = client.events.onSystemEvent((event) => {
      console.log('System event:', event.type, event.data);
    });
    
    console.log('Event subscriptions active. Listening for events...');
    
    // Keep alive for 30 seconds to receive events
    setTimeout(() => {
      console.log('Cleaning up subscriptions...');
      client.disconnect();
    }, 30000);
    
  } catch (error) {
    console.error('Real-time event handling failed:', error.message);
  }
}

// Example 7: Tenant management
async function manageTenants() {
  console.log('🏢 Managing tenants...');
  
  try {
    // Get current tenant info
    const currentTenant = await client.tenants.getCurrent();
    console.log('Current tenant:', currentTenant.tenant.name);
    console.log('User role:', currentTenant.userRole);
    console.log('Is owner:', currentTenant.isOwner);
    
    // Get tenant analytics
    const analytics = await client.tenants.getAnalytics(30);
    console.log('Tenant analytics (30 days):');
    console.log('- Users:', analytics.analytics.userCount);
    console.log('- Plugins:', analytics.analytics.pluginCount);
    console.log('- API requests:', analytics.analytics.apiRequests);
    console.log('- Storage used:', `${analytics.analytics.storageUsed} MB`);
    
  } catch (error) {
    console.error('Tenant management failed:', error.message);
  }
}

// Example 8: GraphQL queries
async function useGraphQLQueries() {
  console.log('📊 Using GraphQL queries...');
  
  try {
    // Use pre-defined query for plugins
    const pluginsData = await client.graphql.query(
      client.graphql.queries.getPlugins,
      { limit: 5, category: 'monitoring' }
    );
    
    console.log('GraphQL plugins result:', pluginsData.plugins);
    
    // Use pre-defined query for system health
    const healthData = await client.graphql.query(
      client.graphql.queries.getSystemHealth,
      { verbose: true }
    );
    
    console.log('GraphQL health result:', healthData.systemHealth);
    
    // Execute a custom GraphQL mutation
    const notificationResult = await client.graphql.mutate(
      client.graphql.mutations.createNotification,
      {
        title: 'GraphQL Test',
        message: 'This notification was created using GraphQL',
        type: 'INFO'
      }
    );
    
    console.log('GraphQL mutation result:', notificationResult);
    
  } catch (error) {
    console.error('GraphQL operations failed:', error.message);
  }
}

// Main execution function
async function main() {
  console.log('🚀 Starting Backstage SDK examples...\n');
  
  const examples = [
    { name: 'System Health', fn: checkSystemHealth },
    { name: 'Plugin Management', fn: managePlugins },
    { name: 'Workflow Management', fn: workflowManagement },
    { name: 'Search Resources', fn: searchResources },
    { name: 'Notifications', fn: handleNotifications },
    { name: 'Tenant Management', fn: manageTenants },
    { name: 'GraphQL Queries', fn: useGraphQLQueries }
  ];
  
  // Run all examples
  for (const example of examples) {
    try {
      console.log(`\n=== ${example.name} ===`);
      await example.fn();
    } catch (error) {
      console.error(`Example "${example.name}" failed:`, error.message);
    }
    
    // Wait between examples
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Run real-time example last (it has its own cleanup)
  console.log('\n=== Real-time Events ===');
  await handleRealtimeEvents();
  
  console.log('\n✅ All examples completed!');
}

// Error handling wrapper
async function runExamples() {
  try {
    await main();
  } catch (error) {
    console.error('❌ Example execution failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    client.dispose();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runExamples();
}

export {
  checkSystemHealth,
  managePlugins,
  workflowManagement,
  searchResources,
  handleNotifications,
  handleRealtimeEvents,
  manageTenants,
  useGraphQLQueries
};