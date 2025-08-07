'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Radar,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Filter,
  Search,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';
import { TechRadarConfig, TechRadarEntry, TechRadarFilters, DEFAULT_QUADRANTS, DEFAULT_RINGS } from '@/lib/techradar/types';
import { techRadarClient } from '@/lib/techradar/client';

interface TechRadarProps {
  width?: number;
  height?: number;
  showLegend?: boolean;
  interactive?: boolean;
}

interface RadarPoint {
  entry: TechRadarEntry;
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export function TechRadar({ 
  width = 800, 
  height = 800, 
  showLegend = true, 
  interactive = true 
}: TechRadarProps) {
  const [config, setConfig] = useState<TechRadarConfig | null>(null);
  const [filteredEntries, setFilteredEntries] = useState<TechRadarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TechRadarEntry | null>(null);
  const [filters, setFilters] = useState<TechRadarFilters>({});
  const [visibleQuadrants, setVisibleQuadrants] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 50;

  useEffect(() => {
    loadRadarData();
  }, []);

  useEffect(() => {
    if (config) {
      setVisibleQuadrants(new Set(config.quadrants.map(q => q.id)));
      applyFilters();
    }
  }, [config, filters]);

  const loadRadarData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const radarConfig = await techRadarClient.getRadarConfig();
      setConfig(radarConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tech radar data');
      console.error('Failed to load tech radar:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    if (!config) return;

    let entries = config.entries.filter(entry => 
      visibleQuadrants.has(entry.quadrant.id)
    );

    if (filters.quadrant) {
      entries = entries.filter(e => e.quadrant.id === filters.quadrant);
    }
    
    if (filters.ring) {
      entries = entries.filter(e => e.ring.id === filters.ring);
    }
    
    if (filters.isNew !== undefined) {
      entries = entries.filter(e => e.isNew === filters.isNew);
    }
    
    if (filters.moved !== undefined) {
      entries = entries.filter(e => e.moved === filters.moved);
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      entries = entries.filter(e => 
        e.name.toLowerCase().includes(search) ||
        e.description?.toLowerCase().includes(search) ||
        e.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    setFilteredEntries(entries);
  };

  const calculatePosition = (entry: TechRadarEntry): RadarPoint => {
    if (!config) throw new Error('No config available');

    const quadrantIndex = config.quadrants.findIndex(q => q.id === entry.quadrant.id);
    const ringRadius = (entry.ring.radius / 400) * maxRadius; // Scale to our canvas

    // Calculate angle based on quadrant (90 degrees per quadrant)
    const baseAngle = (quadrantIndex * 90) - 45; // Offset by -45 to center in quadrant
    const angleVariation = (Math.random() - 0.5) * 80; // ±40 degrees variation
    const angle = (baseAngle + angleVariation) * (Math.PI / 180);
    
    // Add some random radius variation within the ring
    const radiusVariation = (Math.random() - 0.5) * 30;
    const radius = Math.max(20, Math.min(ringRadius + radiusVariation, maxRadius));
    
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    return { entry, x, y, angle, radius };
  };

  const toggleQuadrantVisibility = (quadrantId: string) => {
    const newVisible = new Set(visibleQuadrants);
    if (newVisible.has(quadrantId)) {
      newVisible.delete(quadrantId);
    } else {
      newVisible.add(quadrantId);
    }
    setVisibleQuadrants(newVisible);
  };

  const exportData = async (format: 'json' | 'csv' = 'json') => {
    try {
      const response = await fetch(`/api/techradar/export?format=${format}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `techradar.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading tech radar...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadRadarData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) return null;

  const radarPoints = filteredEntries.map(calculatePosition);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Radar className="h-6 w-6" />
            {config.title}
          </h2>
          {config.description && (
            <p className="text-muted-foreground mt-1">{config.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadRadarData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => exportData('json')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Radar Chart */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="relative">
                <svg
                  ref={svgRef}
                  width={width}
                  height={height}
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full max-w-full h-auto border rounded-lg bg-white dark:bg-gray-900"
                >
                  {/* Rings */}
                  {config.rings.map((ring, index) => {
                    const radius = (ring.radius / 400) * maxRadius;
                    return (
                      <g key={ring.id}>
                        <circle
                          cx={centerX}
                          cy={centerY}
                          r={radius}
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="1"
                          strokeDasharray="5,5"
                        />
                        <text
                          x={centerX + 5}
                          y={centerY - radius + 15}
                          fontSize="12"
                          fill="#6b7280"
                          className="font-medium"
                        >
                          {ring.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Quadrant Dividers */}
                  <line
                    x1={centerX}
                    y1={centerY - maxRadius}
                    x2={centerX}
                    y2={centerY + maxRadius}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <line
                    x1={centerX - maxRadius}
                    y1={centerY}
                    x2={centerX + maxRadius}
                    y2={centerY}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />

                  {/* Quadrant Labels */}
                  {config.quadrants.map((quadrant, index) => {
                    const angle = (index * 90 - 45) * (Math.PI / 180);
                    const labelRadius = maxRadius - 30;
                    const x = centerX + labelRadius * Math.cos(angle);
                    const y = centerY + labelRadius * Math.sin(angle);
                    
                    return (
                      <text
                        key={quadrant.id}
                        x={x}
                        y={y}
                        fontSize="14"
                        fontWeight="600"
                        fill={quadrant.color}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="cursor-pointer"
                        onClick={() => interactive && toggleQuadrantVisibility(quadrant.id)}
                      >
                        {quadrant.name}
                      </text>
                    );
                  })}

                  {/* Entry Points */}
                  {radarPoints.map((point, index) => (
                    <g key={point.entry.id}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={point.entry.isNew ? 8 : 6}
                        fill={point.entry.quadrant.color}
                        stroke={point.entry.moved ? (point.entry.moved > 0 ? '#10b981' : '#ef4444') : 'none'}
                        strokeWidth={point.entry.moved ? 3 : 0}
                        className={`cursor-pointer transition-all ${
                          selectedEntry?.id === point.entry.id ? 'r-10' : ''
                        }`}
                        onClick={() => interactive && setSelectedEntry(point.entry)}
                      />
                      
                      {/* Entry Number */}
                      <text
                        x={point.x}
                        y={point.y + 1}
                        fontSize="10"
                        fontWeight="600"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none"
                      >
                        {index + 1}
                      </text>
                      
                      {/* New indicator */}
                      {point.entry.isNew && (
                        <circle
                          cx={point.x + 8}
                          cy={point.y - 8}
                          r="3"
                          fill="#f59e0b"
                          className="pointer-events-none"
                        />
                      )}
                    </g>
                  ))}
                </svg>

                {/* Selected Entry Details */}
                {selectedEntry && (
                  <Card className="absolute top-4 right-4 w-80 max-w-sm bg-white/95 dark:bg-gray-900/95 backdrop-blur">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        {selectedEntry.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(null)}
                        >
                          ×
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge style={{ backgroundColor: selectedEntry.quadrant.color }}>
                            {selectedEntry.quadrant.name}
                          </Badge>
                          <Badge variant="outline">
                            {selectedEntry.ring.name}
                          </Badge>
                        </div>
                        
                        {selectedEntry.description && (
                          <p className="text-sm text-muted-foreground">
                            {selectedEntry.description}
                          </p>
                        )}
                        
                        {selectedEntry.tags && (
                          <div className="flex flex-wrap gap-1">
                            {selectedEntry.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground space-y-1">
                          {selectedEntry.maturity && (
                            <div>Maturity: {selectedEntry.maturity}</div>
                          )}
                          {selectedEntry.owner && (
                            <div>Owner: {selectedEntry.owner}</div>
                          )}
                          {selectedEntry.lastUpdated && (
                            <div>Updated: {new Date(selectedEntry.lastUpdated).toLocaleDateString()}</div>
                          )}
                        </div>
                        
                        {selectedEntry.url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={selectedEntry.url} target="_blank" rel="noopener noreferrer">
                              Learn More
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Legend and Controls */}
        {showLegend && (
          <div className="space-y-4">
            {/* Quadrant Toggle */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quadrants</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {config.quadrants.map(quadrant => (
                    <div key={quadrant.id} className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleQuadrantVisibility(quadrant.id)}
                        className="h-6 px-2"
                      >
                        {visibleQuadrants.has(quadrant.id) ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </Button>
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: quadrant.color }}
                      />
                      <span className="text-sm">{quadrant.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Legend</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-400" />
                    <span>New Entry</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-green-500" />
                    <span>Moved Up/Out</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-red-500" />
                    <span>Moved Down/In</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Entry List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Entries ({filteredEntries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1 max-h-80 overflow-y-auto text-xs">
                  {radarPoints.map((point, index) => (
                    <div
                      key={point.entry.id}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        selectedEntry?.id === point.entry.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setSelectedEntry(point.entry)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-center font-mono">{index + 1}</span>
                        <span className="flex-1">{point.entry.name}</span>
                        {point.entry.isNew && (
                          <Badge className="text-xs px-1" variant="secondary">NEW</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}