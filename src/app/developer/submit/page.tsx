'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Upload,
  GitBranch,
  Shield,
  FileText,
  Code,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Info,
  Terminal,
  Book,
  Image,
  Lock,
  Users,
  DollarSign,
  Zap,
  ChevronRight,
  FileJson,
  Github,
  Globe
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

interface PluginSubmission {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  author: {
    name: string;
    email: string;
    url?: string;
  };
  repository: {
    type: string;
    url: string;
  };
  homepage?: string;
  documentation?: string;
  license: string;
  keywords: string[];
  tags: string[];
  compatibility: {
    backstage: string;
    node: string;
  };
  pricing?: {
    model: 'free' | 'paid' | 'freemium';
    price?: number;
    currency?: string;
  };
  screenshots?: string[];
  readme?: string;
  changelog?: string;
}

const categories = [
  'ci-cd',
  'monitoring',
  'security',
  'cloud',
  'database',
  'developer-tools',
  'infrastructure',
  'analytics',
  'automation',
  'ai-ml',
  'communication'
];

const licenses = [
  'MIT',
  'Apache-2.0',
  'GPL-3.0',
  'BSD-3-Clause',
  'ISC',
  'Proprietary'
];

export default function SubmitPluginPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [scanningPackage, setScanningPackage] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [scanResults, setScanResults] = useState<any>(null);
  
  const [submission, setSubmission] = useState<PluginSubmission>({
    name: '',
    displayName: '',
    description: '',
    category: '',
    version: '1.0.0',
    author: {
      name: '',
      email: ''
    },
    repository: {
      type: 'git',
      url: ''
    },
    license: 'MIT',
    keywords: [],
    tags: [],
    compatibility: {
      backstage: '>=1.0.0',
      node: '>=16.0.0'
    },
    pricing: {
      model: 'free'
    }
  });

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToGuidelines, setAgreedToGuidelines] = useState(false);

  const validatePlugin = async () => {
    setValidating(true);
    
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Basic validation
    if (!submission.name.startsWith('@')) {
      results.warnings.push('Plugin name should be scoped (e.g., @yourorg/plugin-name)');
    }
    
    if (submission.description.length < 50) {
      results.warnings.push('Description should be at least 50 characters for better discoverability');
    }
    
    if (submission.keywords.length < 3) {
      results.suggestions.push('Add more keywords to improve search visibility');
    }
    
    if (!submission.documentation) {
      results.suggestions.push('Adding documentation URL helps users get started');
    }
    
    setValidationResults(results);
    setValidating(false);
    
    return results.valid;
  };

  const scanPackage = async () => {
    setScanningPackage(true);
    
    // Simulate security scan
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const results = {
      securityScore: 92,
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 1,
        low: 2
      },
      dependencies: {
        total: 24,
        outdated: 3,
        vulnerable: 1
      },
      codeQuality: {
        score: 88,
        issues: 5
      },
      licenseCompatibility: true,
      recommendations: [
        'Update axios to version 1.6.0 to fix medium severity vulnerability',
        'Consider updating 3 outdated dependencies'
      ]
    };
    
    setScanResults(results);
    setScanningPackage(false);
    
    return results.securityScore >= 70;
  };

  const handleSubmit = async () => {
    if (!agreedToTerms || !agreedToGuidelines) {
      toast.error('Please agree to the terms and guidelines');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Validate plugin
      const isValid = await validatePlugin();
      if (!isValid) {
        toast.error('Plugin validation failed');
        setSubmitting(false);
        return;
      }
      
      // Run security scan
      const scanPassed = await scanPackage();
      if (!scanPassed) {
        toast.error('Security scan failed. Please address the issues and try again.');
        setSubmitting(false);
        return;
      }
      
      // Submit plugin
      const response = await fetch('/api/marketplace/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });
      
      if (!response.ok) {
        throw new Error('Submission failed');
      }
      
      toast.success('Plugin submitted successfully! It will be reviewed shortly.');
      router.push('/marketplace');
      
    } catch (error) {
      toast.error('Failed to submit plugin');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Submit Your Plugin</h1>
        <p className="text-muted-foreground">
          Share your Backstage plugin with the community
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { step: 1, title: 'Basic Info' },
            { step: 2, title: 'Technical Details' },
            { step: 3, title: 'Validation' },
            { step: 4, title: 'Review & Submit' }
          ].map((item, index) => (
            <div key={item.step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${currentStep >= item.step 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'}
                `}>
                  {currentStep > item.step ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    item.step
                  )}
                </div>
                <span className="text-sm mt-2">{item.title}</span>
              </div>
              {index < 3 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  currentStep > item.step ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Package Name*</Label>
                  <Input
                    id="name"
                    placeholder="@yourorg/plugin-name"
                    value={submission.name}
                    onChange={(e) => setSubmission({
                      ...submission,
                      name: e.target.value
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    NPM package name (must be unique)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name*</Label>
                  <Input
                    id="displayName"
                    placeholder="My Awesome Plugin"
                    value={submission.displayName}
                    onChange={(e) => setSubmission({
                      ...submission,
                      displayName: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description*</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what your plugin does and its key features..."
                  rows={4}
                  value={submission.description}
                  onChange={(e) => setSubmission({
                    ...submission,
                    description: e.target.value
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 50 characters
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category*</Label>
                  <Select
                    value={submission.category}
                    onValueChange={(value) => setSubmission({
                      ...submission,
                      category: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat.split('-').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version">Version*</Label>
                  <Input
                    id="version"
                    placeholder="1.0.0"
                    value={submission.version}
                    onChange={(e) => setSubmission({
                      ...submission,
                      version: e.target.value
                    })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Author Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="authorName">Name*</Label>
                    <Input
                      id="authorName"
                      placeholder="John Doe"
                      value={submission.author.name}
                      onChange={(e) => setSubmission({
                        ...submission,
                        author: { ...submission.author, name: e.target.value }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="authorEmail">Email*</Label>
                    <Input
                      id="authorEmail"
                      type="email"
                      placeholder="john@example.com"
                      value={submission.author.email}
                      onChange={(e) => setSubmission({
                        ...submission,
                        author: { ...submission.author, email: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authorUrl">Website</Label>
                  <Input
                    id="authorUrl"
                    type="url"
                    placeholder="https://example.com"
                    value={submission.author.url}
                    onChange={(e) => setSubmission({
                      ...submission,
                      author: { ...submission.author, url: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Technical Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Repository
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="repoUrl">Repository URL*</Label>
                  <Input
                    id="repoUrl"
                    placeholder="https://github.com/yourorg/plugin-name"
                    value={submission.repository.url}
                    onChange={(e) => setSubmission({
                      ...submission,
                      repository: { ...submission.repository, url: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="homepage">Homepage</Label>
                  <Input
                    id="homepage"
                    type="url"
                    placeholder="https://plugin-website.com"
                    value={submission.homepage}
                    onChange={(e) => setSubmission({
                      ...submission,
                      homepage: e.target.value
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentation">Documentation</Label>
                  <Input
                    id="documentation"
                    type="url"
                    placeholder="https://docs.plugin.com"
                    value={submission.documentation}
                    onChange={(e) => setSubmission({
                      ...submission,
                      documentation: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="license">License*</Label>
                <Select
                  value={submission.license}
                  onValueChange={(value) => setSubmission({
                    ...submission,
                    license: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {licenses.map(license => (
                      <SelectItem key={license} value={license}>
                        {license}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Compatibility
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="backstageCompat">Backstage Version*</Label>
                    <Input
                      id="backstageCompat"
                      placeholder=">=1.0.0"
                      value={submission.compatibility.backstage}
                      onChange={(e) => setSubmission({
                        ...submission,
                        compatibility: {
                          ...submission.compatibility,
                          backstage: e.target.value
                        }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nodeCompat">Node Version*</Label>
                    <Input
                      id="nodeCompat"
                      placeholder=">=16.0.0"
                      value={submission.compatibility.node}
                      onChange={(e) => setSubmission({
                        ...submission,
                        compatibility: {
                          ...submission.compatibility,
                          node: e.target.value
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing Model
                </h3>
                <RadioGroup
                  value={submission.pricing?.model}
                  onValueChange={(value: any) => setSubmission({
                    ...submission,
                    pricing: { ...submission.pricing, model: value }
                  })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="free" id="free" />
                    <Label htmlFor="free">Free</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="paid" id="paid" />
                    <Label htmlFor="paid">Paid</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="freemium" id="freemium" />
                    <Label htmlFor="freemium">Freemium</Label>
                  </div>
                </RadioGroup>

                {(submission.pricing?.model === 'paid' || submission.pricing?.model === 'freemium') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="29.99"
                        value={submission.pricing?.price}
                        onChange={(e) => setSubmission({
                          ...submission,
                          pricing: {
                            ...submission.pricing!,
                            price: parseFloat(e.target.value)
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={submission.pricing?.currency}
                        onValueChange={(value) => setSubmission({
                          ...submission,
                          pricing: {
                            ...submission.pricing!,
                            currency: value
                          }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Validation */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Validation & Security Scan</AlertTitle>
                <AlertDescription>
                  We'll validate your plugin configuration and run security scans to ensure quality and safety.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Plugin Validation</span>
                      {validationResults && (
                        validationResults.valid ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Passed
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!validationResults && !validating && (
                      <Button onClick={validatePlugin}>
                        Start Validation
                      </Button>
                    )}
                    
                    {validating && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Validating plugin configuration...</span>
                      </div>
                    )}
                    
                    {validationResults && (
                      <div className="space-y-4">
                        {validationResults.errors.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-red-600">Errors</h4>
                            {validationResults.errors.map((error: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                                <span className="text-sm">{error}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {validationResults.warnings.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-yellow-600">Warnings</h4>
                            {validationResults.warnings.map((warning: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                <span className="text-sm">{warning}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {validationResults.suggestions.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-blue-600">Suggestions</h4>
                            {validationResults.suggestions.map((suggestion: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                                <span className="text-sm">{suggestion}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Security Scan</span>
                      {scanResults && (
                        <Badge variant={scanResults.securityScore >= 70 ? "default" : "destructive"}>
                          Score: {scanResults.securityScore}/100
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!scanResults && !scanningPackage && (
                      <Button onClick={scanPackage}>
                        Run Security Scan
                      </Button>
                    )}
                    
                    {scanningPackage && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Scanning for vulnerabilities...</span>
                        </div>
                        <Progress value={65} />
                      </div>
                    )}
                    
                    {scanResults && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Critical</p>
                            <p className="text-2xl font-bold text-red-600">
                              {scanResults.vulnerabilities.critical}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">High</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {scanResults.vulnerabilities.high}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Medium</p>
                            <p className="text-2xl font-bold text-yellow-600">
                              {scanResults.vulnerabilities.medium}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Low</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {scanResults.vulnerabilities.low}
                            </p>
                          </div>
                        </div>
                        
                        {scanResults.recommendations.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-semibold">Recommendations</h4>
                            {scanResults.recommendations.map((rec: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5" />
                                <span className="text-sm">{rec}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Almost There!</AlertTitle>
                <AlertDescription>
                  Review your plugin details and agree to our terms before submitting.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>Plugin Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{submission.displayName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Package</p>
                      <p className="font-medium font-mono">{submission.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="font-medium">{submission.version}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium">{submission.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">License</p>
                      <p className="font-medium">{submission.license}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pricing</p>
                      <p className="font-medium capitalize">{submission.pricing?.model}</p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Description</p>
                    <p className="text-sm">{submission.description}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Terms & Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(!!checked)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="terms" className="cursor-pointer">
                        I agree to the Marketplace Terms of Service
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        By submitting, you agree to our terms regarding plugin distribution,
                        updates, and user support.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="guidelines"
                      checked={agreedToGuidelines}
                      onCheckedChange={(checked) => setAgreedToGuidelines(!!checked)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="guidelines" className="cursor-pointer">
                        I confirm my plugin follows the Community Guidelines
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Your plugin must be safe, respectful, and not violate any
                        intellectual property rights.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            
            {currentStep < 4 ? (
              <Button onClick={nextStep}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || !agreedToTerms || !agreedToGuidelines}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit Plugin
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}