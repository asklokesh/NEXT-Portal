/**
 * Data Flow Edge Component for Topology Visualization
 * 
 * Specialized edge component for data flow connections with 
 * bandwidth visualization, data type indicators, and flow direction.
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { EdgeProps, getBezierPath, BaseEdge, EdgeLabelRenderer } from 'reactflow';
import { ServiceTopologyEdge } from '../types';
import { 
  Activity, 
  Database,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  BarChart3,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  Zap,
  Clock,
  HardDrive
} from 'lucide-react';

// =============================================
// DATA TYPE ICONS
// =============================================

const dataTypeIcons = {
  json: FileText,
  xml: FileText,
  csv: BarChart3,
  binary: Archive,
  image: Image,
  video: Film,
  audio: Music,
  database: Database,
  stream: Activity,
  batch: HardDrive
};

// =============================================
// DATA FLOW METRICS DISPLAY
// =============================================

const DataFlowMetricsDisplay: React.FC<{ edge: ServiceTopologyEdge }> = ({ edge }) => {
  const { data } = edge;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg text-xs min-w-max z-50">
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-blue-600">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">Bandwidth</span>
          </div>
          <span className="text-xl font-bold text-blue-700">
            {data.bandwidth || 0}
          </span>
          <span className="text-xs text-gray-500">Mbps</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-green-600">
            <Activity className="w-4 h-4" />
            <span className="font-medium">Throughput</span>
          </div>
          <span className="text-xl font-bold text-green-700">
            {data.throughput || 0}
          </span>
          <span className="text-xs text-gray-500">MB/s</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-purple-600">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Latency</span>
          </div>
          <span className="text-xl font-bold text-purple-700">
            {data.latency || 0}
          </span>
          <span className="text-xs text-gray-500">ms</span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-3">
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Last Active:</span>
            <span className="font-medium">
              {data.lastActive ? new Date(data.lastActive).toLocaleTimeString() : 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Reliability:</span>
            <span className="font-medium text-green-600">99.9%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// DATA TYPE INDICATOR
// =============================================

const DataTypeIndicator: React.FC<{ 
  dataType?: string;
  format?: string;
}> = ({ dataType, format }) => {
  const DataTypeIcon = dataType ? dataTypeIcons[dataType as keyof typeof dataTypeIcons] || FileText : FileText;
  
  return (
    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
      <DataTypeIcon className="w-4 h-4 text-indigo-600" />
      <div className="flex flex-col">
        {dataType && (
          <span className="text-xs font-medium text-gray-700 uppercase">
            {dataType}
          </span>
        )}
        {format && (
          <span className="text-xs text-gray-500">
            {format}
          </span>
        )}
      </div>
    </div>
  );
};

// =============================================
// FLOW DIRECTION INDICATOR
// =============================================

const FlowDirectionIndicator: React.FC<{ 
  direction: 'bidirectional' | 'unidirectional';
  bandwidth?: number;
}> = ({ direction, bandwidth }) => {
  const getDirectionIcon = () => {
    switch (direction) {
      case 'bidirectional':
        return <ArrowUpDown className="w-4 h-4 text-blue-600" />;
      default:
        return <ArrowRight className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBandwidthColor = () => {
    if (!bandwidth) return 'text-gray-500';
    if (bandwidth > 100) return 'text-red-600';
    if (bandwidth > 50) return 'text-orange-600';
    if (bandwidth > 10) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
      {getDirectionIcon()}
      {bandwidth && (
        <div className="flex flex-col items-center">
          <span className={`text-xs font-bold ${getBandwidthColor()}`}>
            {bandwidth}
          </span>
          <span className="text-xs text-gray-500">Mbps</span>
        </div>
      )}
    </div>
  );
};

// =============================================
// ANIMATED DATA PARTICLES
// =============================================

const DataParticles: React.FC<{ 
  path: string;
  animated: boolean;
  direction: 'bidirectional' | 'unidirectional';
  bandwidth?: number;
}> = ({ path, animated, direction, bandwidth }) => {
  if (!animated) return null;

  const particleCount = bandwidth ? Math.min(Math.floor(bandwidth / 10), 5) : 1;
  const particles = Array.from({ length: particleCount }, (_, i) => i);

  return (
    <>
      {particles.map((index) => (
        <g key={index}>
          {/* Forward flow particles */}
          <circle 
            r={bandwidth ? Math.min(bandwidth / 20, 4) : 2} 
            fill="#3B82F6" 
            opacity="0.7"
          >
            <animateMotion
              dur={`${2 + index * 0.5}s`}
              repeatCount="indefinite"
              path={path}
              begin={`${index * 0.3}s`}
            />
          </circle>
          
          {/* Bidirectional flow particles */}
          {direction === 'bidirectional' && (
            <circle 
              r={bandwidth ? Math.min(bandwidth / 30, 3) : 1.5} 
              fill="#10B981" 
              opacity="0.6"
            >
              <animateMotion
                dur={`${3 + index * 0.4}s`}
                repeatCount="indefinite"
                path={path}
                begin={`${index * 0.5 + 1}s`}
                keyPoints="1;0"
                keyTimes="0;1"
              />
            </circle>
          )}
          
          {/* High-bandwidth additional particles */}
          {bandwidth && bandwidth > 50 && (
            <circle 
              r="1" 
              fill="#8B5CF6" 
              opacity="0.5"
            >
              <animateMotion
                dur={`${1.5 + index * 0.2}s`}
                repeatCount="indefinite"
                path={path}
                begin={`${index * 0.2}s`}
              />
            </circle>
          )}
        </g>
      ))}
    </>
  );
};

// =============================================
// BANDWIDTH VISUALIZATION
// =============================================

const BandwidthVisualization: React.FC<{ 
  bandwidth?: number;
  path: string;
}> = ({ bandwidth, path }) => {
  if (!bandwidth || bandwidth < 5) return null;

  // Create a thicker path to represent high bandwidth
  const thickness = Math.min(bandwidth / 10, 10);
  
  return (
    <path
      d={path}
      fill="none"
      stroke="url(#bandwidthGradient)"
      strokeWidth={thickness}
      opacity={0.2}
      pointerEvents="none"
    />
  );
};

// =============================================
// MAIN DATA FLOW EDGE COMPONENT
// =============================================

export const DataFlowEdge: React.FC<EdgeProps<ServiceTopologyEdge['data']>> = memo(({
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
    curvature: 0.3
  });

  // Extract data flow specific properties
  const dataFlowProps = useMemo(() => ({
    bandwidth: data?.bandwidth || 0,
    dataType: (data as any)?.dataType || 'json',
    format: (data as any)?.format,
    compression: (data as any)?.compression,
    encryption: data?.encrypted
  }), [data]);

  // Get edge style based on bandwidth and health
  const getEdgeStyle = useMemo(() => {
    const baseWidth = 2;
    const bandwidthWidth = dataFlowProps.bandwidth ? Math.min(dataFlowProps.bandwidth / 20, 8) : 0;
    const totalWidth = baseWidth + bandwidthWidth;

    const baseStyle = {
      strokeWidth: totalWidth,
      stroke: data?.color || '#3B82F6',
      strokeDasharray: data?.style === 'dashed' ? '8,4' : 
                      data?.style === 'dotted' ? '3,3' : 'none',
      opacity: selected ? 1 : isHovered ? 0.9 : 0.7,
      filter: selected ? 'drop-shadow(3px 3px 6px rgba(0,0,0,0.3))' : 
              isHovered ? 'drop-shadow(2px 2px 4px rgba(0,0,0,0.2))' : 'none',
      ...style
    };

    // Adjust color based on data flow health
    if (!data?.healthy) {
      baseStyle.stroke = '#EF4444'; // red
    } else if (dataFlowProps.bandwidth > 100) {
      baseStyle.stroke = '#8B5CF6'; // purple for high bandwidth
    } else if (dataFlowProps.bandwidth > 50) {
      baseStyle.stroke = '#3B82F6'; // blue for medium bandwidth
    } else {
      baseStyle.stroke = '#10B981'; // green for low bandwidth
    }

    return baseStyle;
  }, [data, selected, isHovered, dataFlowProps.bandwidth, style]);

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
      {/* Gradient Definitions */}
      <defs>
        <linearGradient id="bandwidthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
        </linearGradient>
        
        <linearGradient id="highBandwidthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Bandwidth Background Visualization */}
      <BandwidthVisualization 
        bandwidth={dataFlowProps.bandwidth}
        path={edgePath}
      />

      {/* Main Edge Path */}
      <BaseEdge 
        path={edgePath} 
        style={getEdgeStyle}
        markerEnd={markerEnd}
      />

      {/* High Bandwidth Warning Path */}
      {dataFlowProps.bandwidth > 100 && (
        <path
          d={edgePath}
          fill="none"
          stroke="url(#highBandwidthGradient)"
          strokeWidth={2}
          opacity={0.6}
          pointerEvents="none"
          strokeDasharray="10,5"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;-15"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Animated Data Particles */}
      <DataParticles 
        path={edgePath}
        animated={animated || dataFlowProps.bandwidth > 10}
        direction={data?.direction || 'unidirectional'}
        bandwidth={dataFlowProps.bandwidth}
      />

      {/* Hover Area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(20, getEdgeStyle.strokeWidth + 10)}
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
          {/* Data Flow Label */}
          {data?.label && (isHovered || selected) && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg px-3 py-2 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {data.label}
                </span>
              </div>
            </div>
          )}

          {/* Flow Direction Indicator */}
          {(isHovered || selected) && (
            <FlowDirectionIndicator
              direction={data?.direction || 'unidirectional'}
              bandwidth={dataFlowProps.bandwidth}
            />
          )}

          {/* Data Type Indicator */}
          {(isHovered || selected) && dataFlowProps.dataType && (
            <DataTypeIndicator
              dataType={dataFlowProps.dataType}
              format={dataFlowProps.format}
            />
          )}

          {/* Quick Metrics */}
          {(isHovered || selected) && !showMetrics && (
            <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
              {dataFlowProps.bandwidth > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="w-3 h-3 text-blue-500" />
                  <span className="font-medium">{dataFlowProps.bandwidth}Mbps</span>
                </div>
              )}
              {data?.latency && (
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3 text-purple-500" />
                  <span className="font-medium">{data.latency}ms</span>
                </div>
              )}
              {dataFlowProps.encryption && (
                <div className="flex items-center gap-1 text-xs">
                  <Zap className="w-3 h-3 text-green-500" />
                  <span className="font-medium">Encrypted</span>
                </div>
              )}
            </div>
          )}

          {/* Metrics Toggle Button */}
          {(isHovered || selected) && (
            <button
              className="bg-white rounded-full p-2 border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors"
              onClick={toggleMetrics}
              title={showMetrics ? 'Hide metrics' : 'Show metrics'}
            >
              <BarChart3 className="w-4 h-4 text-gray-600" />
            </button>
          )}

          {/* Detailed Metrics Display */}
          {showMetrics && (
            <DataFlowMetricsDisplay edge={{ id, data } as ServiceTopologyEdge} />
          )}

          {/* High Bandwidth Warning */}
          {dataFlowProps.bandwidth > 100 && !showMetrics && (
            <div className="bg-red-500 text-white text-xs px-3 py-1 rounded-full animate-pulse">
              High Bandwidth Usage!
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
          strokeWidth={getEdgeStyle.strokeWidth + 6}
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
          strokeWidth={getEdgeStyle.strokeWidth + 3}
          opacity={0.4}
          pointerEvents="none"
        />
      )}
    </>
  );
});

DataFlowEdge.displayName = 'DataFlowEdge';

export default DataFlowEdge;