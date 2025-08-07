"""
Basic usage examples for the Backstage Python SDK
"""

import asyncio
import time
from backstage_idp_sdk import create_client, ClientConfig

# Initialize client with configuration
config = ClientConfig(
    base_url='https://portal.company.com/api',
    api_key='your-api-key-here',
    timeout=30.0,
    retries=3
)

async def check_system_health():
    """Example 1: Check system health"""
    print("🏥 Checking system health...")
    
    async with create_client(config) as client:
        try:
            health = await client.system.get_health(verbose=True)
            print(f"System Status: {health.status}")
            print("Services:")
            for service_name, service_health in health.services.items():
                print(f"  - {service_name}: {service_health.status} ({service_health.message})")
            
            hours = health.uptime // 3600
            print(f"Uptime: {hours} hours")
        except Exception as error:
            print(f"Health check failed: {error}")

async def manage_plugins():
    """Example 2: List and install plugins"""
    print("🔌 Managing plugins...")
    
    async with create_client(config) as client:
        try:
            # List available plugins
            from backstage_idp_sdk.types import QueryParams
            
            params = QueryParams(category='catalog', limit=10)
            plugins = await client.plugins.list(params)
            
            print(f"Found {plugins.total} plugins:")
            for plugin in plugins.items:
                print(f"- {plugin.name} ({plugin.version}) - {plugin.status}")
            
            # Find and install a plugin
            catalog_plugin = next(
                (p for p in plugins.items if 'catalog' in p.name.lower()),
                None
            )
            
            if catalog_plugin and catalog_plugin.status == 'available':
                print(f"Installing {catalog_plugin.name}...")
                
                from backstage_idp_sdk.types import PluginInstallRequest
                
                install_request = PluginInstallRequest(
                    plugin_id=catalog_plugin.id,
                    version=catalog_plugin.version,
                    config={
                        'enabled': True,
                        'refreshInterval': '5m'
                    }
                )
                
                result = await client.plugins.install(install_request)
                print(f"Installation result: {result.success}")
                
        except Exception as error:
            print(f"Plugin management failed: {error}")

async def workflow_management():
    """Example 3: Create and execute workflows"""
    print("⚡ Managing workflows...")
    
    async with create_client(config) as client:
        try:
            from backstage_idp_sdk.types import WorkflowRequest, WorkflowStep
            
            # Create workflow steps
            build_step = WorkflowStep(
                id='build',
                name='Build Docker Image',
                type='docker-build',
                status='pending',
                config={
                    'dockerfile': 'Dockerfile',
                    'context': '.',
                    'tags': ['latest']
                }
            )
            
            deploy_step = WorkflowStep(
                id='deploy',
                name='Deploy to Kubernetes',
                type='k8s-deploy',
                status='pending',
                config={
                    'namespace': 'production',
                    'replicas': 3,
                    'healthCheck': '/health'
                }
            )
            
            # Create workflow
            workflow_request = WorkflowRequest(
                name='Deploy Service',
                description='Automated service deployment workflow',
                steps=[build_step, deploy_step]
            )
            
            workflow = await client.workflows.create(workflow_request)
            print(f"Created workflow: {workflow.id}")
            
            # Execute workflow
            from backstage_idp_sdk.types import WorkflowExecutionRequest
            
            execution_request = WorkflowExecutionRequest(
                parameters={
                    'environment': 'staging',
                    'version': '1.2.3'
                }
            )
            
            execution = await client.workflows.execute(workflow.id, execution_request)
            print(f"Workflow execution started: {execution.execution_id}")
            
            # Monitor execution status
            status = execution.status
            while status in ['pending', 'running']:
                await asyncio.sleep(5)
                
                updated_workflow = await client.workflows.get(workflow.id)
                status = updated_workflow.status
                print(f"Workflow status: {status}")
                
        except Exception as error:
            print(f"Workflow management failed: {error}")

async def search_resources():
    """Example 4: Search portal resources"""
    print("🔍 Searching resources...")
    
    async with create_client(config) as client:
        try:
            search_results = await client.search('microservice', 'service')
            
            print(f"Found {search_results.total} results:")
            for result in search_results.results:
                print(f"- {result.title} ({result.type}) - Score: {result.score}")
                if result.description:
                    print(f"  {result.description}")
                    
        except Exception as error:
            print(f"Search failed: {error}")

async def handle_notifications():
    """Example 5: Manage notifications"""
    print("🔔 Managing notifications...")
    
    async with create_client(config) as client:
        try:
            # Get recent notifications
            notifications_response = await client.notifications.list(
                unread_only=False, 
                limit=10
            )
            
            notifications = notifications_response['notifications']
            unread_count = notifications_response.get('unreadCount', 0)
            
            print(f"You have {unread_count} unread notifications:")
            for notification in notifications:
                status = '✓' if notification.read else '○'
                print(f"{status} {notification.title} - {notification.type}")
                print(f"  {notification.message}")
            
            # Mark first notification as read
            if notifications and not notifications[0].read:
                await client.notifications.mark_as_read(notifications[0].id)
                print("Marked notification as read")
            
            # Create a new notification
            from backstage_idp_sdk.types import NotificationRequest
            
            notification_request = NotificationRequest(
                title='Python SDK Example',
                message='This is a test notification from the Python SDK',
                type='info'
            )
            
            await client.notifications.create(notification_request)
            print("Created test notification")
            
        except Exception as error:
            print(f"Notification management failed: {error}")

async def manage_tenants():
    """Example 6: Tenant management"""
    print("🏢 Managing tenants...")
    
    async with create_client(config) as client:
        try:
            # Get current tenant info
            current_tenant_response = await client.tenants.get_current()
            tenant = current_tenant_response['tenant']
            user_role = current_tenant_response.get('userRole')
            is_owner = current_tenant_response.get('isOwner', False)
            
            print(f"Current tenant: {tenant.name}")
            print(f"User role: {user_role}")
            print(f"Is owner: {is_owner}")
            
            # Get tenant analytics
            analytics_response = await client.tenants.get_analytics(30)
            analytics = analytics_response['analytics']
            
            print("Tenant analytics (30 days):")
            print(f"- Users: {analytics.user_count}")
            print(f"- Plugins: {analytics.plugin_count}")
            print(f"- API requests: {analytics.api_requests}")
            print(f"- Storage used: {analytics.storage_used} MB")
            
        except Exception as error:
            print(f"Tenant management failed: {error}")

async def use_graphql_queries():
    """Example 7: GraphQL queries"""
    print("📊 Using GraphQL queries...")
    
    async with create_client(config) as client:
        try:
            # Use GraphQL client for complex queries
            plugins_query = """
                query GetPlugins($limit: Int, $category: String) {
                    plugins(limit: $limit, category: $category) {
                        items {
                            id
                            name
                            version
                            status
                            description
                        }
                        total
                    }
                }
            """
            
            plugins_result = await client.graphql.query(
                plugins_query,
                variables={'limit': 5, 'category': 'monitoring'}
            )
            
            print("GraphQL plugins result:")
            if 'plugins' in plugins_result:
                for plugin in plugins_result['plugins']['items']:
                    print(f"- {plugin['name']} ({plugin['version']})")
            
            # Health query
            health_query = """
                query GetSystemHealth($verbose: Boolean) {
                    systemHealth(verbose: $verbose) {
                        status
                        timestamp
                        version
                        uptime
                        services {
                            database { status message }
                            backstage { status message }
                            cache { status message }
                        }
                    }
                }
            """
            
            health_result = await client.graphql.query(
                health_query,
                variables={'verbose': True}
            )
            
            if 'systemHealth' in health_result:
                health = health_result['systemHealth']
                print(f"GraphQL health result: {health['status']}")
            
        except Exception as error:
            print(f"GraphQL operations failed: {error}")

async def batch_operations():
    """Example 8: Batch operations"""
    print("📦 Running batch operations...")
    
    async with create_client(config) as client:
        try:
            # Execute multiple operations in batch
            operations = [
                {
                    'method': 'GET',
                    'path': '/health',
                    'data': None
                },
                {
                    'method': 'GET', 
                    'path': '/plugins',
                    'data': None
                },
                {
                    'method': 'GET',
                    'path': '/workflows',
                    'data': None
                }
            ]
            
            results = await client.batch_execute(operations)
            
            print("Batch operation results:")
            for i, result in enumerate(results):
                print(f"Operation {i+1}: Status {result.get('status', 'unknown')}")
                
        except Exception as error:
            print(f"Batch operations failed: {error}")

async def handle_realtime_events():
    """Example 9: Real-time event handling"""
    print("📡 Setting up real-time event handling...")
    
    async with create_client(config) as client:
        try:
            # Connect WebSocket
            await client.connect()
            
            # Subscribe to events
            def on_plugin_event(event):
                print(f"Plugin event: {event['type']} - {event.get('data', {})}")
            
            def on_workflow_event(event):
                print(f"Workflow event: {event['type']} - {event.get('data', {})}")
            
            def on_system_event(event):
                print(f"System event: {event['type']} - {event.get('data', {})}")
            
            # Set up event handlers
            plugin_sub = await client.events.on_plugin_event(on_plugin_event)
            workflow_sub = await client.events.on_workflow_event(on_workflow_event)
            system_sub = await client.events.on_system_event(on_system_event)
            
            print("Event subscriptions active. Listening for events...")
            
            # Listen for events for 30 seconds
            await asyncio.sleep(30)
            
            # Clean up subscriptions
            if plugin_sub:
                await client.events.unsubscribe(plugin_sub)
            if workflow_sub:
                await client.events.unsubscribe(workflow_sub)
            if system_sub:
                await client.events.unsubscribe(system_sub)
            
        except Exception as error:
            print(f"Real-time event handling failed: {error}")

async def main():
    """Main execution function"""
    print("🚀 Starting Backstage Python SDK examples...\n")
    
    examples = [
        ("System Health", check_system_health),
        ("Plugin Management", manage_plugins),
        ("Workflow Management", workflow_management),
        ("Search Resources", search_resources),
        ("Notifications", handle_notifications),
        ("Tenant Management", manage_tenants),
        ("GraphQL Queries", use_graphql_queries),
        ("Batch Operations", batch_operations),
    ]
    
    # Run all examples
    for name, example_func in examples:
        try:
            print(f"\n=== {name} ===")
            await example_func()
        except Exception as error:
            print(f"Example '{name}' failed: {error}")
        
        # Wait between examples
        await asyncio.sleep(1)
    
    # Run real-time example last (it has its own cleanup)
    print("\n=== Real-time Events ===")
    await handle_realtime_events()
    
    print("\n✅ All examples completed!")

if __name__ == "__main__":
    # Run the examples
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️ Examples interrupted by user")
    except Exception as error:
        print(f"\n❌ Example execution failed: {error}")
        exit(1)