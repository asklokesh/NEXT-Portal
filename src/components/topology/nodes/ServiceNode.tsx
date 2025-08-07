/**
 * Service Node Component for Topology Visualization
 * 
 * Renders individual service nodes with health status, metrics,
 * and interactive capabilities.
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ServiceTopologyNode } from '../types';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Server,
  Database,
  Globe,
  Shield,
  Zap,
  Package,
  Cloud,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Eye,
  EyeOff
} from 'lucide-react';

// =============================================
// ICON MAPPING
// =============================================

const iconMap = {
  server: Server,
  database: Database,
  api: Globe,
  gateway: Shield,
  queue: Zap,
  service: Package,
  external: Cloud,
  monitoring: Activity
};

// =============================================
// HEALTH STATUS INDICATORS
// =============================================

const HealthIndicator: React.FC<{ status: string; score: number }> = ({ status, score }) => {
  const getHealthIcon = () => {
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
    <div className="flex items-center gap-1 text-xs">
      {getHealthIcon()}
      <span className="font-medium">{score}%</span>
    </div>
  );
};

// =============================================
// METRICS DISPLAY
// =============================================

const MetricsDisplay: React.FC<{ node: ServiceTopologyNode }> = ({ node }) => {
  const { metrics } = node.data;
  
  return (
    <div className="absolute -bottom-6 left-0 right-0 bg-white border border-gray-200 rounded p-2 shadow-lg text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-blue-500" />
          <span>{metrics.cpu.current.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <MemoryStick className="w-3 h-3 text-purple-500" />
          <span>{(metrics.memory.current / 1024).toFixed(1)}GB</span>
        </div>
        <div className="flex items-center gap-1">
          <Network className="w-3 h-3 text-green-500" />
          <span>{metrics.requests.rps}rps</span>
        </div>
        <div className="flex items-center gap-1">
          <HardDrive className="w-3 h-3 text-orange-500" />
          <span>{(metrics.disk.current / 1024).toFixed(1)}GB</span>
        </div>
      </div>
    </div>
  );
};

// =============================================
// CRITICALITY INDICATOR
// =============================================

const CriticalityBadge: React.FC<{ criticality: string }> = ({ criticality }) => {
  const getBadgeColor = () => {
    switch (criticality) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`absolute -top-2 -right-2 px-1 py-0.5 rounded text-xs border ${getBadgeColor()}`}>
      {criticality.charAt(0).toUpperCase()}
    </div>
  );
};

// =============================================
// MAIN SERVICE NODE COMPONENT
// =============================================

export const ServiceNode: React.FC<NodeProps<ServiceTopologyNode['data']>> = memo(({
  id,
  data,
  selected,
  type: nodeType,
  dragging,
  xPos,
  yPos
}) => {
  const [showMetrics, setShowMetrics] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Get the appropriate icon
  const IconComponent = iconMap[data.icon as keyof typeof iconMap] || Package;

  // Calculate node size based on configuration
  const getNodeSize = useCallback(() => {
    const baseSize = {
      small: { width: 60, height: 45 },
      medium: { width: 80, height: 60 },
      large: { width: 100, height: 75 }
    };

    return baseSize[data.size] || baseSize.medium;
  }, [data.size]);

  const nodeSize = getNodeSize();

  // Get node border color based on health and selection state
  const getBorderColor = useCallback(() => {
    if (selected) return 'border-blue-500';
    if (data.focused) return 'border-purple-500';
    if (data.highlighted) return 'border-yellow-400';
    
    switch (data.health.status) {
      case 'healthy':
        return 'border-green-300';
      case 'degraded':
        return 'border-yellow-300';
      case 'unhealthy':
        return 'border-red-300';
      default:
        return 'border-gray-300';
    }
  }, [selected, data.focused, data.highlighted, data.health.status]);

  // Get background color
  const getBackgroundColor = useCallback(() => {
    if (dragging) return 'bg-blue-50';
    if (isHovered) return 'bg-gray-50';
    return 'bg-white';
  }, [dragging, isHovered]);

  // Handle click events
  const handleNodeClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    // Node click will be handled by the parent visualization engine
  }, []);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    // Toggle metrics display on double click
    setShowMetrics(!showMetrics);
  }, [showMetrics]);

  // Handle metrics toggle
  const toggleMetrics = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMetrics(!showMetrics);
  }, [showMetrics]);

  // Memoize the node style
  const nodeStyle = useMemo(() => ({
    width: nodeSize.width,
    height: nodeSize.height,
    transition: 'all 0.2s ease-in-out',
    transform: selected ? 'scale(1.1)' : 'scale(1)',
    zIndex: selected ? 1000 : isHovered ? 100 : 1
  }), [nodeSize, selected, isHovered]);

  return (
    <div
      className={`relative rounded-lg border-2 shadow-md cursor-pointer group 
                  ${getBorderColor()} ${getBackgroundColor()}`}
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
        className="w-2 h-2 bg-gray-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-gray-400 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-gray-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-gray-400 border-2 border-white"
      />

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center h-full p-2 relative">
        {/* Icon */}
        <div className="flex items-center justify-center mb-1">
          <IconComponent 
            className="w-6 h-6" 
            style={{ color: data.color }}
          />
        </div>

        {/* Label */}
        <div className="text-xs font-semibold text-center text-gray-800 line-clamp-2">
          {data.label}
        </div>

        {/* Environment/Version */}
        {data.status.environment && (
          <div className="text-xs text-gray-500 mt-1">
            {data.status.environment}
          </div>
        )}
      </div>

      {/* Health Indicator */}
      <div className="absolute top-1 left-1">
        <HealthIndicator 
          status={data.health.status} 
          score={data.health.score} 
        />
      </div>

      {/* Criticality Badge */}
      <CriticalityBadge criticality={data.criticality} />

      {/* Metrics Toggle Button */}
      <button
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 
                   transition-opacity duration-200 bg-white rounded-full p-1 
                   border border-gray-200 hover:bg-gray-50"
        onClick={toggleMetrics}
        title={showMetrics ? 'Hide metrics' : 'Show metrics'}
      >
        {showMetrics ? (
          <EyeOff className="w-3 h-3 text-gray-600" />
        ) : (
          <Eye className="w-3 h-3 text-gray-600" />
        )}
      </button>

      {/* Deployment Status Indicator */}
      {data.status.deployment !== 'deployed' && (
        <div className="absolute bottom-1 left-1">
          <div className={`w-2 h-2 rounded-full ${
            data.status.deployment === 'deploying' ? 'bg-blue-400 animate-pulse' :
            data.status.deployment === 'failed' ? 'bg-red-400' :
            'bg-gray-400'
          }`} />
        </div>
      )}

      {/* Tags */}
      {data.tags.length > 0 && isHovered && (
        <div className="absolute -bottom-4 left-0 right-0 flex flex-wrap gap-1 justify-center">
          {data.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="bg-gray-100 text-gray-600 text-xs px-1 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
          {data.tags.length > 3 && (
            <span className="bg-gray-100 text-gray-600 text-xs px-1 py-0.5 rounded">
              +{data.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Metrics Overlay */}
      {showMetrics && <MetricsDisplay node={{ id, data } as ServiceTopologyNode} />}

      {/* Focus Ring */}
      {data.focused && (
        <div className="absolute inset-0 rounded-lg border-2 border-purple-400 animate-pulse" />
      )}

      {/* Selection Ring */}
      {selected && (
        <div className="absolute inset-0 rounded-lg border-2 border-blue-500" />
      )}

      {/* Highlight Ring */}
      {data.highlighted && (
        <div className="absolute inset-0 rounded-lg border-2 border-yellow-400" />
      )}

      {/* Loading State */}
      {dragging && (
        <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
        </div>
      )}
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';

export default ServiceNode;