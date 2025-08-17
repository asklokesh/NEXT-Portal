import React from 'react';
import { useRealtimePerformance } from '@/hooks/useRealtimePerformance';

interface PerformanceMonitorProps {
  className?: string;
}

export function PerformanceMonitor({ className = '' }: PerformanceMonitorProps) {
  const { metrics, hook } = useRealtimePerformance();
  
  if (!metrics) return null;
  
  return (
    <div className={`p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs ${className}`}>
      <div className="font-semibold mb-2">Performance Monitor</div>
      <div className="grid grid-cols-2 gap-2">
        <div>UPS: {metrics.updatesPerSecond}</div>
        <div>Queue: {hook.queueSize}</div>
        <div>Avg Time: {metrics.averageUpdateTime.toFixed(1)}ms</div>
        <div>Memory: {metrics.memoryUsage.toFixed(1)}MB</div>
        <div>Dropped: {metrics.droppedUpdates}</div>
        <div className={hook.isHighLoad() ? 'text-red-600' : 'text-green-600'}>
          Load: {hook.isHighLoad() ? 'High' : 'Normal'}
        </div>
      </div>
    </div>
  );
}