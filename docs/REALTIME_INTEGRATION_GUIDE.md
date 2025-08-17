# Real-time Integration Guide

This guide explains how to integrate the newly implemented real-time monitoring and WebSocket features into your SaaS Internal Developer Portal.

## 🚀 Overview

The real-time integration provides:
- **Live plugin activity monitoring** with installation progress
- **WebSocket-based event streaming** from GitHub, GitLab, Azure DevOps, and NPM
- **Performance-optimized updates** with intelligent throttling
- **Live notification system** with toast and persistent notifications
- **Enhanced dashboard** with real-time metrics
- **Comprehensive health monitoring** for all platform components

## 📁 New Files Created

### Core Components
- `/src/hooks/useRealtimePlugins.ts` - Real-time plugin state management
- `/src/hooks/useRealtimePerformance.ts` - Performance optimization for live updates
- `/src/components/notifications/LiveNotificationSystem.tsx` - Live notification UI
- `/src/components/dashboard/RealtimeDashboard.tsx` - Real-time monitoring dashboard (existing)
- `/src/app/dashboard/enhanced/page.tsx` - Enhanced dashboard with real-time features

### Integration Points
- Enhanced `/src/app/plugins/page.tsx` with real-time WebSocket integration
- Updated WebSocket client at `/src/lib/websocket/client.ts`
- Real-time monitoring service integration

## 🔧 Setup Instructions

### 1. Environment Configuration

Add these environment variables to your `.env.local`:

```env
# WebSocket Configuration
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:4403
NEXT_PUBLIC_DEMO_MODE=true

# Real-time Features
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=true
```

### 2. Install Dependencies

The integration uses existing dependencies, but ensure these are installed:

```bash
npm install socket.io-client framer-motion react-hot-toast
```

### 3. Navigation Updates

Update your navigation to include the new enhanced dashboard:

```tsx
// In your navigation component
import Link from 'next/link';

<Link href="/dashboard/enhanced" className="nav-link">
  Enhanced Dashboard
</Link>
```

### 4. WebSocket Service Setup

Ensure your WebSocket service is running on port 4403 or update the environment variable accordingly.

## 💡 Usage Examples

### 1. Using Real-time Plugins Hook

```tsx
import { useRealtimePlugins } from '@/hooks/useRealtimePlugins';

function MyComponent() {
  const {
    plugins,
    stats,
    events,
    isConnected,
    performance,
    actions
  } = useRealtimePlugins();

  const handleInstall = async (pluginId: string) => {
    try {
      await actions.installPlugin(pluginId);
      // Live updates will automatically show progress
    } catch (error) {
      console.error('Installation failed:', error);
    }
  };

  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Active Plugins: {stats.active}</p>
      <p>Installing: {stats.installing}</p>
      
      {/* Performance monitoring */}
      {performance.isHighLoad && (
        <div className="alert">System under high load</div>
      )}
      
      {plugins.map(plugin => (
        <div key={plugin.id}>
          <h3>{plugin.displayName}</h3>
          <p>Status: {plugin.status}</p>
          {plugin.installProgress && (
            <progress value={plugin.installProgress} max={100} />
          )}
          <button onClick={() => handleInstall(plugin.id)}>
            Install
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Adding Live Notifications

```tsx
import { LiveNotificationSystem } from '@/components/notifications/LiveNotificationSystem';

function AppLayout({ children }) {
  return (
    <div>
      <header>
        <nav>
          {/* Other nav items */}
          <LiveNotificationSystem 
            maxNotifications={50}
            autoHideDelay={5000}
            showSettings={true}
          />
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

### 3. Performance Monitoring

```tsx
import { useRealtimePerformance, PerformanceMonitor } from '@/hooks/useRealtimePerformance';

function AdminDashboard() {
  const performance = useRealtimePerformance({
    throttleInterval: 100,
    maxUpdatesPerSecond: 30,
    enableMetrics: true,
    autoAdjust: true
  });

  return (
    <div>
      <PerformanceMonitor hook={performance} />
      {/* Rest of your admin dashboard */}
    </div>
  );
}
```

## 🎯 Key Features

### 1. Live Plugin Management
- **Real-time installation progress** with progress bars
- **Live status updates** (installing, updating, active, inactive)
- **Quality score monitoring** with live grade updates
- **Health monitoring** with degradation alerts

### 2. WebSocket Event Streaming
- **GitHub integration**: Push events, PR updates, releases
- **GitLab integration**: Pipeline status, merge requests
- **Azure DevOps**: Build status, work items
- **NPM integration**: Package publications, downloads

### 3. Smart Notifications
- **Toast notifications** for immediate feedback
- **Persistent notifications** for critical issues
- **Categorized alerts** (plugin, security, system, quality)
- **Priority-based display** with sound alerts for critical issues
- **Acknowledgment system** for tracking alert resolution

### 4. Performance Optimization
- **Intelligent throttling** prevents UI overload
- **Batch processing** for efficient updates
- **Auto-adjustment** based on system load
- **Memory management** with update queue limits
- **Metrics tracking** for performance monitoring

## 🔍 Monitoring & Debugging

### Performance Metrics
The system automatically tracks:
- Updates per second
- Average update processing time
- Dropped updates count
- Memory usage
- Queue size

### Debug Mode
Enable detailed logging:

```tsx
// In your component
const { performance } = useRealtimePlugins();

console.log('Performance metrics:', performance.metrics);
console.log('Is high load:', performance.isHighLoad);
console.log('Queue size:', performance.queueSize);
```

### Connection Status
Monitor WebSocket connectivity:

```tsx
import { useWebSocket } from '@/lib/websocket/client';

function ConnectionStatus() {
  const { isConnected } = useWebSocket();
  
  return (
    <div className={isConnected ? 'connected' : 'disconnected'}>
      {isConnected ? 'Live' : 'Offline'}
    </div>
  );
}
```

## 🚀 Accessing the Features

### 1. Enhanced Dashboard
Visit `/dashboard/enhanced` to see the new real-time dashboard with:
- Live plugin activity feed
- Real-time metrics
- WebSocket connection status
- Performance monitoring
- Interactive tabs for different views

### 2. Plugin Portal with Live Updates
The existing `/plugins` page now includes:
- Live installation progress
- Real-time status updates
- WebSocket connectivity indicator
- Enhanced plugin cards with live data

### 3. Live Notifications
The notification bell appears in the top navigation and provides:
- Real-time event notifications
- Categorized alerts
- Sound notifications for critical events
- Persistent notification history
- User preferences for notification types

## 🛠 Customization Options

### Throttling Configuration
```tsx
const performance = useRealtimePerformance({
  throttleInterval: 200,    // Min time between updates (ms)
  maxUpdatesPerSecond: 25,  // Max updates per second
  batchSize: 5,            // Updates per batch
  autoAdjust: true         // Auto-adjust based on load
});
```

### Notification Preferences
```tsx
<LiveNotificationSystem
  maxNotifications={100}     // Max stored notifications
  autoHideDelay={6000}      // Auto-hide delay (ms)
  showSettings={true}       // Show preferences panel
/>
```

## 🔧 Troubleshooting

### Common Issues

1. **WebSocket not connecting**
   - Check NEXT_PUBLIC_WEBSOCKET_URL environment variable
   - Ensure WebSocket service is running
   - Verify firewall/proxy settings

2. **High performance load**
   - The system auto-adjusts, but you can manually reduce update frequency
   - Check performance metrics in the debug panel
   - Consider increasing throttle intervals

3. **Notifications not appearing**
   - Check browser notification permissions
   - Verify NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
   - Check notification preferences in the UI

### Performance Optimization Tips

1. **For high-traffic environments**:
   ```tsx
   const performance = useRealtimePerformance({
     throttleInterval: 500,
     maxUpdatesPerSecond: 15,
     batchSize: 3
   });
   ```

2. **For low-latency requirements**:
   ```tsx
   const performance = useRealtimePerformance({
     throttleInterval: 50,
     maxUpdatesPerSecond: 60,
     batchSize: 10
   });
   ```

## 📊 Monitoring Dashboard

The real-time dashboard includes:
- **Live event stream** from all connected sources
- **Plugin activity monitoring** with installation progress
- **Security alerts** with real-time vulnerability detection
- **Quality metrics** with continuous evaluation
- **System health** monitoring
- **WebSocket connection status** for all integrations

## 🎉 Success Metrics

After integration, you should see:
- ✅ Live plugin installation progress
- ✅ Real-time status updates
- ✅ WebSocket connectivity indicators
- ✅ Toast notifications for events
- ✅ Performance metrics tracking
- ✅ Responsive UI with optimized updates

The integration provides a seamless real-time experience that enhances your Spotify Portal-style interface without overwhelming users with excessive updates.