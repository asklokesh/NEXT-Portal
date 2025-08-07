'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X, 
  Upload, 
  Download,
  BarChart3,
  Filter
} from 'lucide-react';
import { TechRadarEntry, TechRadarConfig, TechRadarStats, DEFAULT_QUADRANTS, DEFAULT_RINGS } from '@/lib/techradar/types';
import { techRadarClient } from '@/lib/techradar/client';
import { toast } from 'react-hot-toast';

interface TechRadarManagerProps {
  onEntryChange?: (entry: TechRadarEntry) => void;
}

export function TechRadarManager({ onEntryChange }: TechRadarManagerProps) {
  const [config, setConfig] = useState<TechRadarConfig | null>(null);
  const [entries, setEntries] = useState<TechRadarEntry[]>([]);
  const [stats, setStats] = useState<TechRadarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<TechRadarEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<string>('');

  // Form state for new/edited entries
  const [entryForm, setEntryForm] = useState({
    name: '',
    quadrant: '',
    ring: '',
    description: '',
    tags: '',
    maturity: 'stable' as const,
    isNew: false,
    moved: 0 as 0 | 1 | -1,
    url: '',
    owner: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [configData, statsData] = await Promise.all([
        techRadarClient.getRadarConfig(),
        techRadarClient.getStats()
      ]);
      
      setConfig(configData);
      setEntries(configData.entries);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load tech radar data:', error);
      toast.error('Failed to load tech radar data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEntryForm({
      name: '',
      quadrant: '',
      ring: '',
      description: '',
      tags: '',
      maturity: 'stable',
      isNew: false,
      moved: 0,
      url: '',
      owner: ''
    });
  };

  const handleEditEntry = (entry: TechRadarEntry) => {
    setEditingEntry(entry);
    setEntryForm({
      name: entry.name,
      quadrant: entry.quadrant.id,
      ring: entry.ring.id,
      description: entry.description || '',
      tags: entry.tags?.join(', ') || '',
      maturity: entry.maturity || 'stable',
      isNew: entry.isNew || false,
      moved: entry.moved || 0,
      url: entry.url || '',
      owner: entry.owner || ''
    });
    setIsDialogOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!entryForm.name || !entryForm.quadrant || !entryForm.ring || !config) {
      toast.error('Name, quadrant, and ring are required');
      return;
    }

    try {
      const quadrant = config.quadrants.find(q => q.id === entryForm.quadrant);
      const ring = config.rings.find(r => r.id === entryForm.ring);
      
      if (!quadrant || !ring) {
        toast.error('Invalid quadrant or ring selected');
        return;
      }

      const entry: Omit<TechRadarEntry, 'id'> | TechRadarEntry = {
        ...(editingEntry && { id: editingEntry.id }),
        name: entryForm.name,
        quadrant,
        ring,
        description: entryForm.description,
        tags: entryForm.tags ? entryForm.tags.split(',').map(t => t.trim()) : undefined,
        maturity: entryForm.maturity,
        isNew: entryForm.isNew,
        moved: entryForm.moved,
        url: entryForm.url || undefined,
        owner: entryForm.owner || undefined,
        lastUpdated: new Date().toISOString()
      };

      const savedEntry = await techRadarClient.saveEntry(entry);
      
      // Update local state
      if (editingEntry) {
        setEntries(prev => prev.map(e => e.id === savedEntry.id ? savedEntry : e));
        toast.success('Entry updated successfully');
      } else {
        setEntries(prev => [...prev, savedEntry]);
        toast.success('Entry created successfully');
      }

      onEntryChange?.(savedEntry);
      
      // Reset form and close dialog
      resetForm();
      setEditingEntry(null);
      setIsDialogOpen(false);
      
      // Reload stats
      const newStats = await techRadarClient.getStats();
      setStats(newStats);
      
    } catch (error) {
      console.error('Failed to save entry:', error);
      toast.error('Failed to save entry');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await techRadarClient.deleteEntry(entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast.success('Entry deleted successfully');
      
      // Reload stats
      const newStats = await techRadarClient.getStats();
      setStats(newStats);
      
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    }
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
      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export data:', error);
      toast.error('Failed to export data');
    }
  };

  const filteredEntries = entries.filter(entry =>
    entry.name.toLowerCase().includes(filter.toLowerCase()) ||
    entry.description?.toLowerCase().includes(filter.toLowerCase()) ||
    entry.tags?.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <span>Loading tech radar management...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tech Radar Management</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => exportData('json')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button onClick={() => exportData('csv')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setEditingEntry(null); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Edit Entry' : 'Add New Entry'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={entryForm.name}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Technology name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quadrant">Quadrant *</Label>
                    <Select
                      value={entryForm.quadrant}
                      onValueChange={(value) => setEntryForm(prev => ({ ...prev, quadrant: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select quadrant" />
                      </SelectTrigger>
                      <SelectContent>
                        {config?.quadrants.map(quadrant => (
                          <SelectItem key={quadrant.id} value={quadrant.id}>
                            {quadrant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="ring">Ring *</Label>
                    <Select
                      value={entryForm.ring}
                      onValueChange={(value) => setEntryForm(prev => ({ ...prev, ring: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ring" />
                      </SelectTrigger>
                      <SelectContent>
                        {config?.rings.map(ring => (
                          <SelectItem key={ring.id} value={ring.id}>
                            {ring.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={entryForm.description}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the technology"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={entryForm.tags}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maturity">Maturity</Label>
                    <Select
                      value={entryForm.maturity}
                      onValueChange={(value: any) => setEntryForm(prev => ({ ...prev, maturity: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="experimental">Experimental</SelectItem>
                        <SelectItem value="alpha">Alpha</SelectItem>
                        <SelectItem value="beta">Beta</SelectItem>
                        <SelectItem value="stable">Stable</SelectItem>
                        <SelectItem value="deprecated">Deprecated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="moved">Movement</Label>
                    <Select
                      value={entryForm.moved.toString()}
                      onValueChange={(value) => setEntryForm(prev => ({ 
                        ...prev, 
                        moved: parseInt(value) as 0 | 1 | -1 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No Change</SelectItem>
                        <SelectItem value="1">Moved Up/Out</SelectItem>
                        <SelectItem value="-1">Moved Down/In</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={entryForm.url}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="owner">Owner</Label>
                  <Input
                    id="owner"
                    value={entryForm.owner}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, owner: e.target.value }))}
                    placeholder="Team or person responsible"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isNew"
                    checked={entryForm.isNew}
                    onCheckedChange={(checked) => 
                      setEntryForm(prev => ({ ...prev, isNew: !!checked }))
                    }
                  />
                  <Label htmlFor="isNew">Mark as new entry</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setEditingEntry(null);
                      setIsDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEntry}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tech Radar Entries ({filteredEntries.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter entries..."
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{entry.name}</h3>
                        <Badge style={{ backgroundColor: entry.quadrant.color }}>
                          {entry.quadrant.name}
                        </Badge>
                        <Badge variant="outline">
                          {entry.ring.name}
                        </Badge>
                        {entry.isNew && (
                          <Badge className="bg-orange-100 text-orange-800">NEW</Badge>
                        )}
                        {entry.moved === 1 && (
                          <Badge className="bg-green-100 text-green-800">↑</Badge>
                        )}
                        {entry.moved === -1 && (
                          <Badge className="bg-red-100 text-red-800">↓</Badge>
                        )}
                      </div>
                      
                      {entry.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {entry.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {entry.maturity && <span>Maturity: {entry.maturity}</span>}
                        {entry.owner && <span>Owner: {entry.owner}</span>}
                        {entry.lastUpdated && (
                          <span>Updated: {new Date(entry.lastUpdated).toLocaleDateString()}</span>
                        )}
                      </div>
                      
                      {entry.tags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entry.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEntry(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalEntries}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">New Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.newEntries}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Moved Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <div>
                      <div className="text-lg font-bold text-green-600">{stats.movedUp}</div>
                      <div className="text-xs text-muted-foreground">Moved Up</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-600">{stats.movedDown}</div>
                      <div className="text-xs text-muted-foreground">Moved Down</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">By Quadrant</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.byQuadrant).map(([quadrant, count]) => (
                      <div key={quadrant} className="flex justify-between text-sm">
                        <span>{quadrant}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">By Ring</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.byRing).map(([ring, count]) => (
                      <div key={ring} className="flex justify-between text-sm">
                        <span>{ring}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">By Maturity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.byMaturity).map(([maturity, count]) => (
                      <div key={maturity} className="flex justify-between text-sm">
                        <span className="capitalize">{maturity}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}