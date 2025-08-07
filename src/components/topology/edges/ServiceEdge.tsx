/**
 * Service Edge Component for Topology Visualization
 * 
 * Renders connections between services with protocol information,
 * health status, and interactive capabilities.
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { EdgeProps, getBezierPath, BaseEdge, EdgeLabelRenderer } from 'reactflow';
import { ServiceTopologyEdge } from '../types';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Zap,
  Clock,
  Shield,
  Database,
  Globe,
  Wifi,
  Lock,
  Unlock,
  Info
} from 'lucide-react';

// =============================================
// PROTOCOL ICONS
// =============================================

const protocolIcons = {
  http: Globe,
  https: Globe,
  grpc: Zap,
  tcp: Wifi,
  udp: Wifi,
  websocket: Activity,
  database: Database
};

// =============================================
// EDGE HEALTH INDICATOR
// =============================================

const EdgeHealthIndicator: React.FC<{ 
  healthy: boolean;
  latency?: number;
  errorRate?: number;
}> = ({ healthy, latency, errorRate }) => {
  const getHealthIcon = () => {
    if (!healthy || (errorRate && errorRate > 5)) {
      return <XCircle className="w-3 h-3 text-red-500" />;
    }
    if (latency && latency > 1000) {
      return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
    }
    return <CheckCircle className="w-3 h-3 text-green-500" />;
  };

  return (
    <div className="flex items-center gap-1 bg-white rounded px-2 py-1 border border-gray-200 shadow-sm">
      {getHealthIcon()}
      {latency && (
        <span className="text-xs font-medium text-gray-600">
          {latency}ms
        </span>
      )}
      {errorRate && errorRate > 1 && (
        <span className="text-xs font-medium text-red-600">
          {errorRate.toFixed(1)}%
        </span>
      )}
    </div>
  );
};

// =============================================
// EDGE METRICS DISPLAY
// =============================================

const EdgeMetricsDisplay: React.FC<{ edge: ServiceTopologyEdge }> = ({ edge }) => {
  const { data } = edge;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs min-w-max z-50">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-blue-600">
            <Activity className="w-3 h-3" />
            <span className="font-medium">Throughput</span>
          </div>
          <span className="text-lg font-bold text-blue-700">
            {data.throughput || 0}
          </span>
          <span className="text-xs text-gray-500">req/s</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-purple-600">
            <Clock className="w-3 h-3" />
            <span className="font-medium">Latency</span>
          </div>
          <span className="text-lg font-bold text-purple-700">
            {data.latency || 0}
          </span>
          <span className="text-xs text-gray-500">ms</span>
        </div>
      </div>
      
      {data.bandwidth && (
        <div className="border-t border-gray-200 pt-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Bandwidth:</span>
            <span className="font-medium">{data.bandwidth} Mbps</span>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================
// PROTOCOL INDICATOR
// =============================================

const ProtocolIndicator: React.FC<{ 
  protocol?: string;
  encrypted: boolean;
  authentication?: string;
}> = ({ protocol, encrypted, authentication }) => {
  const ProtocolIcon = protocol ? protocolIcons[protocol as keyof typeof protocolIcons] : Globe;
  
  return (
    <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-gray-200 shadow-sm">
      <ProtocolIcon className="w-3 h-3 text-gray-600" />
      {protocol && (
        <span className="text-xs font-medium text-gray-700 uppercase">
          {protocol}
        </span>
      )}
      {encrypted && (
        <Lock className="w-3 h-3 text-green-500" />
      )}
      {!encrypted && (
        <Unlock className="w-3 h-3 text-red-500" />
      )}
      {authentication && (
        <Shield className="w-3 h-3 text-blue-500" />
      )}
    </div>
  );
};

// =============================================
// ANIMATED FLOW PARTICLES
// =============================================

const FlowParticles: React.FC<{ 
  path: string;
  animated: boolean;
  direction: 'bidirectional' | 'unidirectional';
}> = ({ path, animated, direction }) => {
  if (!animated) return null;

  return (
    <>
      <circle r="3" fill="#3B82F6" opacity="0.8">
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path={path}
        />
      </circle>
      {direction === 'bidirectional' && (
        <circle r="2" fill="#10B981" opacity="0.6">
          <animateMotion
            dur="4s"
            repeatCount="indefinite"
            path={path}
            begin="1s"
          />
        </circle>
      )}
    </>
  );
};

// =============================================
// MAIN SERVICE EDGE COMPONENT
// =============================================

export const ServiceEdge: React.FC<EdgeProps<ServiceTopologyEdge['data']>> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  animated,
  style,
  markerEnd
}) => {
  const [showMetrics, setShowMetrics] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate the bezier path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.2
  });

  // Get edge style based on health and type
  const getEdgeStyle = useMemo(() => {
    const baseStyle = {
      strokeWidth: data?.thickness || 2,
      stroke: data?.color || '#64748B',
      strokeDasharray: data?.style === 'dashed' ? '5,5' : 
                      data?.style === 'dotted' ? '2,2' : 'none',
      opacity: selected ? 1 : isHovered ? 0.8 : 0.6,
      filter: selected ? 'drop-shadow(2px 2px 4px rgba(0,0,0,0.2))' : 'none',
      ...style
    };

    // Adjust color based on health
    if (!data?.healthy) {
      baseStyle.stroke = '#EF4444'; // red
    } else if (data?.latency && data.latency > 1000) {
      baseStyle.stroke = '#F59E0B'; // orange
    }

    return baseStyle;
  }, [data, selected, isHovered, style]);

  // Handle edge click
  const handleEdgeClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  // Toggle metrics display
  const toggleMetrics = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMetrics(!showMetrics);
  }, [showMetrics]);

  return (
    <>
      {/* Main Edge Path */}
      <BaseEdge 
        path={edgePath} 
        style={getEdgeStyle}
        markerEnd={markerEnd}
      />

      {/* Animated Flow Particles */}
      {(animated || data?.direction === 'bidirectional') && (
        <FlowParticles 
          path={edgePath}
          animated={animated || false}
          direction={data?.direction || 'unidirectional'}
        />
      )}

      {/* Hover Area (invisible, larger hit area) */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={handleEdgeClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Edge Label and Controls */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="flex flex-col items-center gap-2"
        >
          {/* Main Edge Label */}
          {data?.label && (isHovered || selected) && (
            <div className="bg-white rounded-lg px-3 py-1 border border-gray-200 shadow-sm">
              <span className="text-xs font-medium text-gray-700">
                {data.label}
              </span>
            </div>
          )}

          {/* Protocol Indicator */}
          {(data?.protocol || data?.encrypted !== undefined) && (isHovered || selected) && (
            <ProtocolIndicator
              protocol={data.protocol}
              encrypted={data.encrypted}
              authentication={data.authentication}
            />
          )}

          {/* Health Indicator */}
          {(isHovered || selected || !data?.healthy) && (
            <EdgeHealthIndicator
              healthy={data?.healthy ?? true}
              latency={data?.latency}
              errorRate={data?.errorRate}
            />
          )}

          {/* Metrics Toggle Button */}
          {(isHovered || selected) && (
            <button
              className="bg-white rounded-full p-2 border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors"
              onClick={toggleMetrics}
              title={showMetrics ? 'Hide metrics' : 'Show metrics'}
            >
              <Info className="w-3 h-3 text-gray-600" />
            </button>
          )}

          {/* Metrics Display */}
          {showMetrics && (
            <EdgeMetricsDisplay edge={{ id, data } as ServiceTopologyEdge} />
          )}

          {/* High Latency Warning */}
          {data?.latency && data.latency > 2000 && !showMetrics && (
            <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
              High Latency!
            </div>
          )}

          {/* High Error Rate Warning */}
          {data?.errorRate && data.errorRate > 10 && !showMetrics && (
            <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
              High Error Rate!
            </div>
          )}
        </div>
      </EdgeLabelRenderer>

      {/* Selection Highlight */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={(data?.thickness || 2) + 4}
          opacity={0.3}
          pointerEvents="none"
        />
      )}

      {/* Hover Highlight */}
      {isHovered && !selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#6B7280"
          strokeWidth={(data?.thickness || 2) + 2}
          opacity={0.4}
          pointerEvents="none"
        />
      )}
    </>
  );
});

ServiceEdge.displayName = 'ServiceEdge';

export default ServiceEdge;