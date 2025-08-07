/**
 * Group Node Component for Topology Visualization
 * 
 * Specialized node component for grouping related services,
 * showing aggregate metrics and allowing expand/collapse functionality.
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ServiceTopologyNode } from '../types';
import { 
  Package, 
  ChevronDown,
  ChevronRight,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Layers,
  Building,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2
} from 'lucide-react';

// =============================================
// GROUP METRICS DISPLAY
// =============================================

const GroupMetricsDisplay: React.FC<{ node: ServiceTopologyNode }> = ({ node }) => {
  const customProps = node.data.customProperties as any;
  const memberCount = customProps?.memberCount || 0;
  const aggregateMetrics = customProps?.aggregateMetrics || {};
  
  return (
    <div className="absolute -bottom-12 left-0 right-0 bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs min-w-max z-50">
      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-blue-600">
            <Users className="w-3 h-3" />
            <span className="font-medium">Services</span>
          </div>
          <span className="text-lg font-bold text-blue-700">{memberCount}</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span className="font-medium">Healthy</span>
          </div>
          <span className="text-lg font-bold text-green-700">
            {aggregateMetrics.healthyCount || 0}
          </span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-orange-600">
            <AlertTriangle className="w-3 h-3" />
            <span className="font-medium">Degraded</span>
          </div>
          <span className="text-lg font-bold text-orange-700">
            {aggregateMetrics.degradedCount || 0}
          </span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-red-600">
            <XCircle className="w-3 h-3" />
            <span className="font-medium">Unhealthy</span>
          </div>
          <span className="text-lg font-bold text-red-700">
            {aggregateMetrics.unhealthyCount || 0}
          </span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 mt-3 pt-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-gray-500">Avg CPU</span>
            <span className="font-bold">{aggregateMetrics.avgCpu || 0}%</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-gray-500">Total RPS</span>
            <span className="font-bold">{aggregateMetrics.totalRps || 0}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-gray-500">Avg Health</span>
            <span className="font-bold">{aggregateMetrics.avgHealth || 0}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// GROUP HEALTH INDICATOR
// =============================================

const GroupHealthIndicator: React.FC<{ 
  overallHealth: number;
  healthyCount: number;
  unhealthyCount: number;
  totalCount: number;
}> = ({ overallHealth, healthyCount, unhealthyCount, totalCount }) => {
  const getHealthIcon = () => {
    const healthyPercentage = (healthyCount / totalCount) * 100;
    
    if (unhealthyCount > 0 && healthyPercentage < 50) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    } else if (unhealthyCount > 0 || healthyPercentage < 80) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    } else {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
      {getHealthIcon()}
      <div className="flex flex-col">
        <span className="font-medium">{overallHealth}%</span>
        <span className="text-xs text-gray-500">
          {healthyCount}/{totalCount} healthy
        </span>
      </div>
    </div>
  );
};

// =============================================
// GROUP TYPE INDICATOR
// =============================================

const GroupTypeIndicator: React.FC<{ 
  groupType: string; 
  domain?: string;
}> = ({ groupType, domain }) => {
  const getIcon = () => {
    switch (groupType.toLowerCase()) {
      case 'domain':
        return <Building className="w-4 h-4" />;
      case 'team':
        return <Users className="w-4 h-4" />;
      case 'system':
        return <Layers className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getColor = () => {
    switch (groupType.toLowerCase()) {
      case 'domain':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'team':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'system':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${getColor()}`}>
      {getIcon()}
      <div className="flex flex-col">
        <span className="text-sm font-medium capitalize">{groupType}</span>
        {domain && (
          <span className="text-xs opacity-75">{domain}</span>
        )}
      </div>
    </div>
  );
};

// =============================================
// MAIN GROUP NODE COMPONENT
// =============================================

export const GroupNode: React.FC<NodeProps<ServiceTopologyNode['data']>> = memo(({
  id,
  data,
  selected,
  dragging,
  xPos,
  yPos
}) => {
  const [showMetrics, setShowMetrics] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!data.collapsed);

  // Extract group-specific data
  const groupInfo = useMemo(() => {
    const customProps = data.customProperties as any;
    return {
      type: customProps?.groupType || 'group',
      domain: customProps?.domain,
      memberCount: customProps?.memberCount || 0,
      memberIds: customProps?.memberIds || [],
      bounds: customProps?.bounds,
      aggregateMetrics: customProps?.aggregateMetrics || {
        healthyCount: 0,
        degradedCount: 0,
        unhealthyCount: 0,
        avgCpu: 0,
        totalRps: 0,
        avgHealth: data.health.score
      }
    };
  }, [data.customProperties, data.health.score]);

  // Calculate node size based on member count and state
  const getNodeSize = useCallback(() => {
    const baseSize = isExpanded ? 
      { width: 200, height: 150 } : 
      { width: 160, height: 120 };
    
    // Adjust size based on member count
    const scaleFactor = Math.min(1 + (groupInfo.memberCount / 20), 1.5);
    
    return {
      width: baseSize.width * scaleFactor,
      height: baseSize.height * scaleFactor
    };
  }, [isExpanded, groupInfo.memberCount]);

  const nodeSize = getNodeSize();

  // Get border color based on group health
  const getBorderColor = useCallback(() => {
    if (selected) return 'border-blue-500';
    if (data.focused) return 'border-purple-500';
    
    const { healthyCount, unhealthyCount } = groupInfo.aggregateMetrics;
    const totalCount = groupInfo.memberCount;
    const healthyPercentage = totalCount > 0 ? (healthyCount / totalCount) * 100 : 100;
    
    if (unhealthyCount > 0 && healthyPercentage < 50) {
      return 'border-red-400';
    } else if (unhealthyCount > 0 || healthyPercentage < 80) {
      return 'border-yellow-400';
    } else {
      return 'border-green-400';
    }
  }, [selected, data.focused, groupInfo.aggregateMetrics, groupInfo.memberCount]);

  // Get background style
  const getBackgroundStyle = useCallback(() => {
    const baseStyle = {
      background: isExpanded ?
        'linear-gradient(135deg, #F8FAFC, #F1F5F9)' :
        'linear-gradient(135deg, #FFFFFF, #F8FAFC)'
    };

    if (dragging) {
      return { 
        ...baseStyle, 
        background: 'linear-gradient(135deg, #EBF8FF, #DBEAFE)' 
      };
    }
    
    if (isHovered) {
      return { 
        ...baseStyle, 
        background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)' 
      };
    }
    
    return baseStyle;
  }, [dragging, isHovered, isExpanded]);

  // Handle events
  const handleNodeClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const toggleExpanded = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const toggleMetrics = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMetrics(!showMetrics);
  }, [showMetrics]);

  // Memoize node style
  const nodeStyle = useMemo(() => ({
    width: nodeSize.width,
    height: nodeSize.height,
    transition: 'all 0.3s ease-in-out',
    transform: selected ? 'scale(1.05)' : 'scale(1)',
    zIndex: selected ? 1000 : isHovered ? 100 : 1,
    ...getBackgroundStyle()
  }), [nodeSize, selected, isHovered, getBackgroundStyle]);

  return (
    <div
      className={`relative rounded-2xl border-2 shadow-lg cursor-pointer group 
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
        className="w-4 h-4 bg-purple-400 border-2 border-white rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 bg-purple-400 border-2 border-white rounded-full"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-4 h-4 bg-purple-400 border-2 border-white rounded-full"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-4 h-4 bg-purple-400 border-2 border-white rounded-full"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleExpanded}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
          
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 line-clamp-1">
              {data.label}
            </h3>
            <p className="text-sm text-gray-500">
              {groupInfo.memberCount} services
            </p>
          </div>
        </div>

        <GroupTypeIndicator 
          groupType={groupInfo.type}
          domain={groupInfo.domain}
        />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Health Overview */}
        <div className="mb-4">
          <GroupHealthIndicator
            overallHealth={groupInfo.aggregateMetrics.avgHealth}
            healthyCount={groupInfo.aggregateMetrics.healthyCount}
            unhealthyCount={groupInfo.aggregateMetrics.unhealthyCount}
            totalCount={groupInfo.memberCount}
          />
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-gray-600">RPS:</span>
                <span className="font-semibold">{groupInfo.aggregateMetrics.totalRps}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">Avg CPU:</span>
                <span className="font-semibold">{groupInfo.aggregateMetrics.avgCpu}%</span>
              </div>
            </div>

            {/* Member Status Distribution */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="h-full flex">
                  <div 
                    className="bg-green-500"
                    style={{ 
                      width: `${(groupInfo.aggregateMetrics.healthyCount / groupInfo.memberCount) * 100}%` 
                    }}
                  />
                  <div 
                    className="bg-yellow-500"
                    style={{ 
                      width: `${(groupInfo.aggregateMetrics.degradedCount / groupInfo.memberCount) * 100}%` 
                    }}
                  />
                  <div 
                    className="bg-red-500"
                    style={{ 
                      width: `${(groupInfo.aggregateMetrics.unhealthyCount / groupInfo.memberCount) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expand/Collapse Button */}
      <button
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 
                   transition-opacity duration-200 bg-white rounded-full p-2 
                   border border-gray-200 hover:bg-gray-50 shadow-sm"
        onClick={toggleExpanded}
        title={isExpanded ? 'Collapse group' : 'Expand group'}
      >
        {isExpanded ? (
          <Minimize2 className="w-4 h-4 text-gray-600" />
        ) : (
          <Maximize2 className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Metrics Toggle Button */}
      <button
        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 
                   transition-opacity duration-200 bg-white rounded-full p-2 
                   border border-gray-200 hover:bg-gray-50 shadow-sm"
        onClick={toggleMetrics}
        title={showMetrics ? 'Hide metrics' : 'Show metrics'}
      >
        {showMetrics ? (
          <EyeOff className="w-4 h-4 text-gray-600" />
        ) : (
          <Eye className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Member Count Badge */}
      <div className="absolute -top-3 -left-3 bg-purple-500 text-white text-sm 
                     px-3 py-1 rounded-full font-medium border-2 border-white shadow-sm">
        {groupInfo.memberCount}
      </div>

      {/* Metrics Overlay */}
      {showMetrics && <GroupMetricsDisplay node={{ id, data } as ServiceTopologyNode} />}

      {/* Focus Ring */}
      {data.focused && (
        <div className="absolute inset-0 rounded-2xl border-3 border-purple-400 animate-pulse" />
      )}

      {/* Selection Ring */}
      {selected && (
        <div className="absolute inset-0 rounded-2xl border-3 border-blue-500" />
      )}

      {/* Highlight Ring */}
      {data.highlighted && (
        <div className="absolute inset-0 rounded-2xl border-3 border-yellow-400" />
      )}

      {/* Loading State */}
      {dragging && (
        <div className="absolute inset-0 bg-white bg-opacity-75 rounded-2xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
        </div>
      )}
    </div>
  );
});

GroupNode.displayName = 'GroupNode';

export default GroupNode;