/**
 * API Node Component for Topology Visualization
 * 
 * Specialized node component for API services with endpoint information,
 * request metrics, and API-specific health indicators.
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ServiceTopologyNode } from '../types';
import { 
  Globe, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Zap,
  Clock,
  TrendingUp,
  Shield,
  Key,
  Lock,
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';

// =============================================
// API METRICS DISPLAY
// =============================================

const APIMetricsDisplay: React.FC<{ node: ServiceTopologyNode }> = ({ node }) => {
  const { metrics } = node.data;
  
  return (
    <div className="absolute -bottom-8 left-0 right-0 bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs min-w-max z-50">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-blue-600">
            <Zap className="w-3 h-3" />
            <span className="font-medium">RPS</span>
          </div>
          <span className="text-lg font-bold text-blue-700">{metrics.requests.rps}</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-green-600">
            <Clock className="w-3 h-3" />
            <span className="font-medium">P95</span>
          </div>
          <span className="text-lg font-bold text-green-700">{metrics.requests.p95}ms</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="w-3 h-3" />
            <span className="font-medium">Errors</span>
          </div>
          <span className="text-lg font-bold text-red-700">{metrics.errors.rate.toFixed(2)}%</span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 mt-2 pt-2">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>P50: {metrics.requests.p50}ms</div>
          <div>P99: {metrics.requests.p99}ms</div>
          <div>4xx: {metrics.errors.by4xx}</div>
          <div>5xx: {metrics.errors.by5xx}</div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// API HEALTH INDICATOR
// =============================================

const APIHealthIndicator: React.FC<{ status: string; score: number; errorRate: number }> = ({ 
  status, 
  score, 
  errorRate 
}) => {
  const getHealthIcon = () => {
    if (errorRate > 5) {
      return <XCircle className="w-3 h-3 text-red-500" />;
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
    <div className="flex items-center gap-1 text-xs bg-white rounded px-1 py-0.5 border border-gray-200">
      {getHealthIcon()}
      <span className="font-medium">{score}%</span>
      {errorRate > 1 && (
        <span className="text-red-500 ml-1">{errorRate.toFixed(1)}% err</span>
      )}
    </div>
  );
};

// =============================================
// AUTHENTICATION INDICATORS
// =============================================

const AuthenticationIndicator: React.FC<{ 
  hasAuth: boolean; 
  authType?: string; 
  isSecure: boolean; 
}> = ({ hasAuth, authType, isSecure }) => {
  if (!hasAuth) {
    return (
      <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded px-2 py-1">
        <Unlock className="w-3 h-3 text-red-500" />
        <span className="text-xs text-red-700">No Auth</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 rounded px-2 py-1 ${
      isSecure ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
    }`}>
      {isSecure ? (
        <Lock className="w-3 h-3 text-green-500" />
      ) : (
        <Shield className="w-3 h-3 text-yellow-500" />
      )}
      <span className={`text-xs ${
        isSecure ? 'text-green-700' : 'text-yellow-700'
      }`}>
        {authType || 'Auth'}
      </span>
    </div>
  );
};

// =============================================
// MAIN API NODE COMPONENT
// =============================================

export const APINode: React.FC<NodeProps<ServiceTopologyNode['data']>> = memo(({
  id,
  data,
  selected,
  dragging,
  xPos,
  yPos
}) => {
  const [showMetrics, setShowMetrics] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Extract API-specific data from relationships or custom properties
  const apiInfo = useMemo(() => {
    const customProps = data.customProperties as any;
    return {
      endpoints: customProps?.endpoints || [],
      version: customProps?.apiVersion || data.status.version,
      authenticated: customProps?.authenticated !== false,
      authType: customProps?.authType,
      secure: customProps?.secure !== false,
      rateLimit: customProps?.rateLimit
    };
  }, [data.customProperties, data.status.version]);

  // Calculate node size based on configuration
  const getNodeSize = useCallback(() => {
    const baseSize = {
      small: { width: 90, height: 70 },
      medium: { width: 110, height: 85 },
      large: { width: 130, height: 100 }
    };

    return baseSize[data.size] || baseSize.medium;
  }, [data.size]);

  const nodeSize = getNodeSize();

  // Get node border color based on health and API status
  const getBorderColor = useCallback(() => {
    if (selected) return 'border-blue-500';
    if (data.focused) return 'border-purple-500';
    
    // API-specific border colors
    const errorRate = data.metrics.errors.rate;
    if (errorRate > 10) return 'border-red-400';
    if (errorRate > 5) return 'border-orange-400';
    
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
  }, [selected, data.focused, data.health.status, data.metrics.errors.rate]);

  // Get background gradient for API nodes
  const getBackgroundStyle = useCallback(() => {
    if (dragging) return { background: 'linear-gradient(135deg, #EBF8FF, #BFE6FF)' };
    if (isHovered) return { background: 'linear-gradient(135deg, #F7FAFC, #EDF2F7)' };
    return { background: 'linear-gradient(135deg, #FFFFFF, #F8FAFC)' };
  }, [dragging, isHovered]);

  // Handle click events
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

  // Memoize the node style
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
        className="w-3 h-3 bg-blue-400 border-2 border-white rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-400 border-2 border-white rounded-full"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-400 border-2 border-white rounded-full"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-400 border-2 border-white rounded-full"
      />

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center h-full p-3 relative">
        {/* API Icon with accent */}
        <div className="flex items-center justify-center mb-2 relative">
          <div className="absolute inset-0 bg-blue-100 rounded-full w-8 h-8 opacity-50" />
          <Globe className="w-6 h-6 text-blue-600 relative z-10" />
        </div>

        {/* API Label */}
        <div className="text-sm font-bold text-center text-gray-800 mb-1 line-clamp-1">
          {data.label}
        </div>

        {/* API Version */}
        <div className="text-xs text-blue-600 font-medium mb-2">
          v{apiInfo.version}
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-green-500" />
            <span>{data.metrics.requests.rps}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-500" />
            <span>{data.metrics.requests.p95}ms</span>
          </div>
        </div>
      </div>

      {/* Health Indicator */}
      <div className="absolute top-2 left-2">
        <APIHealthIndicator 
          status={data.health.status} 
          score={data.health.score}
          errorRate={data.metrics.errors.rate}
        />
      </div>

      {/* Authentication Indicator */}
      {(isHovered || !apiInfo.authenticated) && (
        <div className="absolute top-2 right-2">
          <AuthenticationIndicator 
            hasAuth={apiInfo.authenticated}
            authType={apiInfo.authType}
            isSecure={apiInfo.secure}
          />
        </div>
      )}

      {/* Rate Limit Indicator */}
      {apiInfo.rateLimit && isHovered && (
        <div className="absolute bottom-2 left-2 bg-blue-50 border border-blue-200 rounded px-2 py-1">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-blue-500" />
            <span className="text-xs text-blue-700">{apiInfo.rateLimit}/min</span>
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

      {/* API Status Indicator */}
      {data.status.deployment !== 'deployed' && (
        <div className="absolute bottom-3 left-3">
          <div className={`w-3 h-3 rounded-full border-2 border-white ${
            data.status.deployment === 'deploying' ? 'bg-blue-400 animate-pulse' :
            data.status.deployment === 'failed' ? 'bg-red-400' :
            'bg-gray-400'
          }`} />
        </div>
      )}

      {/* Endpoint Count Badge */}
      {apiInfo.endpoints.length > 0 && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs 
                       px-2 py-1 rounded-full font-medium border-2 border-white shadow-sm">
          {apiInfo.endpoints.length}
        </div>
      )}

      {/* Metrics Overlay */}
      {showMetrics && <APIMetricsDisplay node={{ id, data } as ServiceTopologyNode} />}

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
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Error Rate Warning */}
      {data.metrics.errors.rate > 5 && !dragging && (
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            High Error Rate!
          </div>
        </div>
      )}
    </div>
  );
});

APINode.displayName = 'APINode';

export default APINode;