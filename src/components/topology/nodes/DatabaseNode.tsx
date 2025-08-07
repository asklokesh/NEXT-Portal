/**
 * Database Node Component for Topology Visualization
 * 
 * Specialized node component for database services with storage metrics,
 * connection pooling information, and database-specific health indicators.
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ServiceTopologyNode } from '../types';
import { 
  Database, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  HardDrive,
  Users,
  Clock,
  Zap,
  BarChart3,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';

// =============================================
// DATABASE METRICS DISPLAY
// =============================================

const DatabaseMetricsDisplay: React.FC<{ node: ServiceTopologyNode }> = ({ node }) => {
  const { metrics } = node.data;
  const customProps = node.data.customProperties as any;
  
  return (
    <div className="absolute -bottom-10 left-0 right-0 bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs min-w-max z-50">
      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-green-600">
            <Users className="w-3 h-3" />
            <span className="font-medium">Connections</span>
          </div>
          <span className="text-lg font-bold text-green-700">
            {customProps?.connections?.active || 0}
          </span>
          <span className="text-xs text-gray-500">
            /{customProps?.connections?.max || 100}
          </span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-blue-600">
            <Zap className="w-3 h-3" />
            <span className="font-medium">QPS</span>
          </div>
          <span className="text-lg font-bold text-blue-700">
            {customProps?.queries?.qps || 0}
          </span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-purple-600">
            <Clock className="w-3 h-3" />
            <span className="font-medium">Avg Query</span>
          </div>
          <span className="text-lg font-bold text-purple-700">
            {customProps?.queries?.avgTime || 0}ms
          </span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-orange-600">
            <HardDrive className="w-3 h-3" />
            <span className="font-medium">Storage</span>
          </div>
          <span className="text-lg font-bold text-orange-700">
            {((metrics.disk.current || 0) / 1024).toFixed(1)}GB
          </span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 mt-2 pt-2">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>Slow Queries: {customProps?.queries?.slow || 0}</div>
          <div>Cache Hit: {customProps?.cache?.hitRate || 0}%</div>
          <div>Replication Lag: {customProps?.replication?.lag || 0}ms</div>
          <div>Lock Waits: {customProps?.locks?.waits || 0}</div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// DATABASE HEALTH INDICATOR
// =============================================

const DatabaseHealthIndicator: React.FC<{ 
  status: string; 
  score: number; 
  connectionUtilization: number;
  replicationStatus?: string;
}> = ({ status, score, connectionUtilization, replicationStatus }) => {
  const getHealthIcon = () => {
    if (connectionUtilization > 90) {
      return <XCircle className="w-3 h-3 text-red-500" />;
    }
    
    if (replicationStatus === 'lagging') {
      return <AlertTriangle className="w-3 h-3 text-orange-500" />;
    }
    
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <AlertTriangle className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className="flex items-center gap-1 text-xs bg-white rounded px-2 py-1 border border-gray-200 shadow-sm">
      {getHealthIcon()}
      <span className="font-medium">{score}%</span>
      {connectionUtilization > 80 && (
        <span className="text-orange-500 ml-1">{connectionUtilization.toFixed(0)}% conn</span>
      )}
    </div>
  );
};

// =============================================
// DATABASE TYPE INDICATOR
// =============================================

const DatabaseTypeIndicator: React.FC<{ 
  dbType: string; 
  version?: string; 
  clustered?: boolean;
}> = ({ dbType, version, clustered }) => {
  const getTypeColor = () => {
    switch (dbType.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'mysql':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'mongodb':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'redis':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'elasticsearch':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={`flex items-center gap-1 rounded px-2 py-1 border ${getTypeColor()}`}>
      <Database className="w-3 h-3" />
      <span className="text-xs font-medium">
        {dbType}
        {version && ` ${version}`}
      </span>
      {clustered && (
        <Server className="w-3 h-3 ml-1" />
      )}
    </div>
  );
};

// =============================================
// MAIN DATABASE NODE COMPONENT
// =============================================

export const DatabaseNode: React.FC<NodeProps<ServiceTopologyNode['data']>> = memo(({
  id,
  data,
  selected,
  dragging,
  xPos,
  yPos
}) => {
  const [showMetrics, setShowMetrics] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Extract database-specific data
  const dbInfo = useMemo(() => {
    const customProps = data.customProperties as any;
    return {
      type: customProps?.dbType || 'database',
      version: customProps?.version || data.status.version,
      clustered: customProps?.clustered || false,
      encrypted: customProps?.encrypted !== false,
      connections: {
        active: customProps?.connections?.active || 0,
        max: customProps?.connections?.max || 100
      },
      replication: {
        status: customProps?.replication?.status || 'healthy',
        lag: customProps?.replication?.lag || 0
      },
      backup: {
        lastBackup: customProps?.backup?.lastBackup,
        status: customProps?.backup?.status || 'unknown'
      }
    };
  }, [data.customProperties, data.status.version]);

  const connectionUtilization = (dbInfo.connections.active / dbInfo.connections.max) * 100;

  // Calculate node size
  const getNodeSize = useCallback(() => {
    const baseSize = {
      small: { width: 100, height: 80 },
      medium: { width: 120, height: 95 },
      large: { width: 140, height: 110 }
    };

    return baseSize[data.size] || baseSize.medium;
  }, [data.size]);

  const nodeSize = getNodeSize();

  // Get node border color
  const getBorderColor = useCallback(() => {
    if (selected) return 'border-blue-500';
    if (data.focused) return 'border-purple-500';
    
    // Database-specific border colors
    if (connectionUtilization > 95) return 'border-red-500';
    if (connectionUtilization > 85) return 'border-orange-400';
    if (dbInfo.replication.status === 'lagging') return 'border-yellow-400';
    
    switch (data.health.status) {
      case 'healthy':
        return 'border-green-400';
      case 'degraded':
        return 'border-yellow-400';
      case 'unhealthy':
        return 'border-red-400';
      default:
        return 'border-gray-300';
    }
  }, [selected, data.focused, data.health.status, connectionUtilization, dbInfo.replication.status]);

  // Get background style
  const getBackgroundStyle = useCallback(() => {
    if (dragging) return { background: 'linear-gradient(135deg, #EDF2F7, #E2E8F0)' };
    if (isHovered) return { background: 'linear-gradient(135deg, #F7FAFC, #EDF2F7)' };
    return { background: 'linear-gradient(135deg, #FFFFFF, #F8FAFC)' };
  }, [dragging, isHovered]);

  // Handle events
  const handleNodeClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMetrics(!showMetrics);
  }, [showMetrics]);

  const toggleMetrics = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMetrics(!showMetrics);
  }, [showMetrics]);

  // Memoize node style
  const nodeStyle = useMemo(() => ({
    width: nodeSize.width,
    height: nodeSize.height,
    transition: 'all 0.2s ease-in-out',
    transform: selected ? 'scale(1.1)' : 'scale(1)',
    zIndex: selected ? 1000 : isHovered ? 100 : 1,
    ...getBackgroundStyle()
  }), [nodeSize, selected, isHovered, getBackgroundStyle]);

  return (
    <div
      className={`relative rounded-xl border-2 shadow-lg cursor-pointer group 
                  ${getBorderColor()}`}
      style={nodeStyle}
      onClick={handleNodeClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-500 border-2 border-white rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-gray-500 border-2 border-white rounded-full"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-500 border-2 border-white rounded-full"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-500 border-2 border-white rounded-full"
      />

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center h-full p-3 relative">
        {/* Database Icon with background */}
        <div className="flex items-center justify-center mb-2 relative">
          <div className="absolute inset-0 bg-gray-100 rounded-lg w-10 h-8 opacity-60" />
          <Database className="w-7 h-7 text-gray-700 relative z-10" />
        </div>

        {/* Database Label */}
        <div className="text-sm font-bold text-center text-gray-800 mb-1 line-clamp-1">
          {data.label}
        </div>

        {/* Database Type */}
        <div className="mb-2">
          <DatabaseTypeIndicator 
            dbType={dbInfo.type}
            version={dbInfo.version}
            clustered={dbInfo.clustered}
          />
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-green-600">
            <Users className="w-3 h-3" />
            <span>{dbInfo.connections.active}/{dbInfo.connections.max}</span>
          </div>
          {dbInfo.clustered && (
            <div className="flex items-center gap-1 text-blue-600">
              {dbInfo.replication.status === 'healthy' ? 
                <Wifi className="w-3 h-3" /> : 
                <WifiOff className="w-3 h-3" />
              }
              <span>Cluster</span>
            </div>
          )}
        </div>
      </div>

      {/* Health Indicator */}
      <div className="absolute top-2 left-2">
        <DatabaseHealthIndicator 
          status={data.health.status} 
          score={data.health.score}
          connectionUtilization={connectionUtilization}
          replicationStatus={dbInfo.replication.status}
        />
      </div>

      {/* Security Indicator */}
      <div className="absolute top-2 right-2">
        <div className={`p-1 rounded ${
          dbInfo.encrypted ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {dbInfo.encrypted ? (
            <Lock className="w-3 h-3 text-green-600" />
          ) : (
            <Unlock className="w-3 h-3 text-red-600" />
          )}
        </div>
      </div>

      {/* Backup Status */}
      {dbInfo.backup.status && isHovered && (
        <div className="absolute bottom-2 left-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
            dbInfo.backup.status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            dbInfo.backup.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-yellow-50 text-yellow-700 border border-yellow-200'
          }`}>
            <BarChart3 className="w-3 h-3" />
            <span>Backup: {dbInfo.backup.status}</span>
          </div>
        </div>
      )}

      {/* Metrics Toggle Button */}
      <button
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 
                   transition-opacity duration-200 bg-white rounded-full p-1.5 
                   border border-gray-200 hover:bg-gray-50 shadow-sm"
        onClick={toggleMetrics}
        title={showMetrics ? 'Hide metrics' : 'Show metrics'}
      >
        {showMetrics ? (
          <EyeOff className="w-3 h-3 text-gray-600" />
        ) : (
          <Eye className="w-3 h-3 text-gray-600" />
        )}
      </button>

      {/* Connection Utilization Warning */}
      {connectionUtilization > 90 && !dragging && (
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            Connections Full!
          </div>
        </div>
      )}

      {/* Replication Lag Warning */}
      {dbInfo.replication.lag > 5000 && !dragging && (
        <div className="absolute -top-1 right-1/4">
          <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
            Replication Lag
          </div>
        </div>
      )}

      {/* Metrics Overlay */}
      {showMetrics && <DatabaseMetricsDisplay node={{ id, data } as ServiceTopologyNode} />}

      {/* Focus Ring */}
      {data.focused && (
        <div className="absolute inset-0 rounded-xl border-2 border-purple-400 animate-pulse" />
      )}

      {/* Selection Ring */}
      {selected && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-500" />
      )}

      {/* Highlight Ring */}
      {data.highlighted && (
        <div className="absolute inset-0 rounded-xl border-2 border-yellow-400" />
      )}

      {/* Loading State */}
      {dragging && (
        <div className="absolute inset-0 bg-white bg-opacity-75 rounded-xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500" />
        </div>
      )}
    </div>
  );
});

DatabaseNode.displayName = 'DatabaseNode';

export default DatabaseNode;