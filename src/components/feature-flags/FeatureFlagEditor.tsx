/**
 * Feature Flag Editor Component
 * Modal for creating and editing feature flags
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  X, 
  AlertTriangle, 
  Settings,
  Target,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { FeatureFlag, FlagType, TargetingRule, TargetingCondition, FlagVariation } from '@/lib/feature-flags/types';

interface FeatureFlagEditorProps {
  flag?: FeatureFlag | null;
  environment: string;
  onSave: (flag: Partial<FeatureFlag>) => void;
  onCancel: () => void;
}

export function FeatureFlagEditor({ 
  flag, 
  environment, 
  onSave, 
  onCancel 
}: FeatureFlagEditorProps) {
  const isEdit = flag !== null && flag !== undefined;
  
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    enabled: false,
    type: 'boolean' as FlagType,
    tags: [] as string[],
    expiresAt: '',
    
    // Rollout configuration
    rolloutEnabled: false,
    rolloutPercentage: 0,
    rolloutStrategy: 'percentage' as any,
    
    // Targeting configuration
    targetingEnabled: false,
    targetingRules: [] as TargetingRule[],
    
    // Variations
    variations: [] as FlagVariation[],
  });

  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with flag data
  useEffect(() => {
    if (flag) {
      setFormData({
        key: flag.key,
        name: flag.name,
        description: flag.description || '',
        enabled: flag.enabled,
        type: flag.type,
        tags: flag.tags || [],
        expiresAt: flag.expiresAt ? new Date(flag.expiresAt).toISOString().split('T')[0] : '',
        
        rolloutEnabled: flag.rollout?.enabled || false,
        rolloutPercentage: flag.rollout?.percentage || 0,
        rolloutStrategy: flag.rollout?.strategy || 'percentage',
        
        targetingEnabled: flag.targeting?.enabled || false,
        targetingRules: flag.targeting?.rules || [],
        
        variations: flag.variations || [],
      });
    }
  }, [flag]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.key.trim()) {
      newErrors.key = 'Flag key is required';
    } else if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(formData.key)) {
      newErrors.key = 'Flag key must start with a letter and contain only alphanumeric characters, dots, underscores, and hyphens';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Flag name is required';
    }

    if (formData.rolloutEnabled && (formData.rolloutPercentage < 0 || formData.rolloutPercentage > 100)) {
      newErrors.rolloutPercentage = 'Rollout percentage must be between 0 and 100';
    }

    if (formData.variations.length > 0) {
      const totalWeight = formData.variations.reduce((sum, v) => sum + v.weight, 0);
      if (totalWeight > 100) {
        newErrors.variations = 'Total variation weights cannot exceed 100%';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const flagData: Partial<FeatureFlag> = {
      key: formData.key,
      name: formData.name,
      description: formData.description || undefined,
      enabled: formData.enabled,
      type: formData.type,
      tags: formData.tags,
      environment,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
      
      rollout: {
        enabled: formData.rolloutEnabled,
        percentage: formData.rolloutPercentage,
        strategy: formData.rolloutStrategy,
      },
      
      targeting: {
        enabled: formData.targetingEnabled,
        rules: formData.targetingRules,
        fallback: { strategy: 'default' }
      },
      
      variations: formData.variations.length > 0 ? formData.variations : undefined,
    };

    onSave(flagData);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ 
        ...prev, 
        tags: [...prev.tags, newTag.trim()] 
      }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const addVariation = () => {
    const newVariation: FlagVariation = {
      id: `var_${Date.now()}`,
      key: `variation_${formData.variations.length + 1}`,
      name: `Variation ${formData.variations.length + 1}`,
      value: formData.type === 'boolean' ? true : '',
      weight: 0,
    };

    setFormData(prev => ({
      ...prev,
      variations: [...prev.variations, newVariation]
    }));
  };

  const updateVariation = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    }));
  };

  const removeVariation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.filter((_, i) => i !== index)
    }));
  };

  const addTargetingRule = () => {
    const newRule: TargetingRule = {
      id: `rule_${Date.now()}`,
      name: `Rule ${formData.targetingRules.length + 1}`,
      enabled: true,
      conditions: [],
      operator: 'and',
      priority: formData.targetingRules.length + 1,
    };

    setFormData(prev => ({
      ...prev,
      targetingRules: [...prev.targetingRules, newRule]
    }));
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Feature Flag' : 'Create Feature Flag'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="rollout">Rollout</TabsTrigger>
            <TabsTrigger value="targeting">Targeting</TabsTrigger>
            <TabsTrigger value="variations">Variations</TabsTrigger>
          </TabsList>

          {/* Basic Configuration */}
          <TabsContent value="basic" className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="flag-key">Flag Key *</Label>
                <Input
                  id="flag-key"
                  value={formData.key}
                  onChange={(e) => handleInputChange('key', e.target.value)}
                  placeholder="my-feature-flag"
                  disabled={isEdit}
                />
                {errors.key && (
                  <p className="text-sm text-red-600">{errors.key}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="flag-name">Flag Name *</Label>
                <Input
                  id="flag-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="My Feature Flag"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="flag-description">Description</Label>
              <Textarea
                id="flag-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Description of what this flag controls..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="flag-type">Flag Type</Label>
                <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="kill_switch">Kill Switch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires-at">Expires At (Optional)</Label>
                <Input
                  id="expires-at"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => handleInputChange('expiresAt', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="flag-enabled"
                checked={formData.enabled}
                onCheckedChange={(enabled) => handleInputChange('enabled', enabled)}
              />
              <Label htmlFor="flag-enabled">Enable this flag</Label>
            </div>
          </TabsContent>

          {/* Rollout Configuration */}
          <TabsContent value="rollout" className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="rollout-enabled"
                checked={formData.rolloutEnabled}
                onCheckedChange={(enabled) => handleInputChange('rolloutEnabled', enabled)}
              />
              <Label htmlFor="rollout-enabled">Enable Rollout</Label>
            </div>

            {formData.rolloutEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Rollout Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rollout-percentage">Percentage</Label>
                      <Input
                        id="rollout-percentage"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.rolloutPercentage}
                        onChange={(e) => handleInputChange('rolloutPercentage', parseInt(e.target.value) || 0)}
                      />
                      {errors.rolloutPercentage && (
                        <p className="text-sm text-red-600">{errors.rolloutPercentage}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rollout-strategy">Strategy</Label>
                      <Select 
                        value={formData.rolloutStrategy} 
                        onValueChange={(value) => handleInputChange('rolloutStrategy', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="user_id">User ID</SelectItem>
                          <SelectItem value="segment">Segment</SelectItem>
                          <SelectItem value="sticky">Sticky</SelectItem>
                          <SelectItem value="gradual">Gradual</SelectItem>
                          <SelectItem value="canary">Canary</SelectItem>
                          <SelectItem value="blue_green">Blue-Green</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Rollout Preview</h4>
                    <p className="text-sm text-muted-foreground">
                      {formData.rolloutPercentage}% of users will see the enabled variation using {formData.rolloutStrategy} strategy.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Targeting Configuration */}
          <TabsContent value="targeting" className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="targeting-enabled"
                checked={formData.targetingEnabled}
                onCheckedChange={(enabled) => handleInputChange('targetingEnabled', enabled)}
              />
              <Label htmlFor="targeting-enabled">Enable Targeting</Label>
            </div>

            {formData.targetingEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Targeting Rules
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addTargetingRule}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.targetingRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No targeting rules configured. Add a rule to get started.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.targetingRules.map((rule, index) => (
                        <Card key={rule.id} className="border-dashed">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <Input
                                value={rule.name || ''}
                                onChange={(e) => {
                                  const newRules = [...formData.targetingRules];
                                  newRules[index].name = e.target.value;
                                  handleInputChange('targetingRules', newRules);
                                }}
                                placeholder="Rule name"
                                className="font-medium"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newRules = formData.targetingRules.filter((_, i) => i !== index);
                                  handleInputChange('targetingRules', newRules);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Rule configuration will be expanded here
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Variations Configuration */}
          <TabsContent value="variations" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Flag Variations</h3>
                <p className="text-sm text-muted-foreground">
                  Configure different variations for A/B testing
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addVariation}>
                <Plus className="h-4 w-4 mr-2" />
                Add Variation
              </Button>
            </div>

            {formData.variations.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    No variations configured. The flag will use boolean true/false values.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {formData.variations.map((variation, index) => (
                  <Card key={variation.id}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-3">
                          <Label>Key</Label>
                          <Input
                            value={variation.key}
                            onChange={(e) => updateVariation(index, 'key', e.target.value)}
                            placeholder="variation_key"
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <Label>Name</Label>
                          <Input
                            value={variation.name}
                            onChange={(e) => updateVariation(index, 'name', e.target.value)}
                            placeholder="Variation Name"
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <Label>Value</Label>
                          <Input
                            value={String(variation.value)}
                            onChange={(e) => updateVariation(index, 'value', e.target.value)}
                            placeholder="Variation value"
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <Label>Weight (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={variation.weight}
                            onChange={(e) => updateVariation(index, 'weight', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        
                        <div className="col-span-1 pt-6">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariation(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {variation.description && (
                        <div className="mt-2">
                          <Label>Description</Label>
                          <Input
                            value={variation.description}
                            onChange={(e) => updateVariation(index, 'description', e.target.value)}
                            placeholder="Variation description"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {errors.variations && (
                  <p className="text-sm text-red-600">{errors.variations}</p>
                )}
                
                <Card className="bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Total Weight: {formData.variations.reduce((sum, v) => sum + v.weight, 0)}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Weights should add up to 100% for proper distribution
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            {isEdit ? 'Update Flag' : 'Create Flag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}