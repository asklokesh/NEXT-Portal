'use client';

import { useState, useEffect } from 'react';
import { 
 Settings, 
 Save, 
 RefreshCw, 
 FileText, 
 Code, 
 Eye,
 EyeOff,
 Plus,
 Trash2,
 Copy,
 Check,
 AlertCircle,
 Database,
 Globe,
 Shield,
 Mail,
 GitBranch,
 Key,
 Server,
 Zap,
 Search,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ConfigSection {
 id: string;
 title: string;
 description: string;
 icon: React.ReactNode;
 fields: ConfigField[];
}

interface ConfigField {
 id: string;
 name: string;
 description: string;
 type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'array' | 'object' | 'secret';
 value: any;
 required?: boolean;
 placeholder?: string;
 options?: { label: string; value: string }[];
 validation?: {
 pattern?: string;
 min?: number;
 max?: number;
 minLength?: number;
 maxLength?: number;
 };
 sensitive?: boolean;
 advanced?: boolean;
}

// Configuration sections based on Backstage app-config.yaml structure
const CONFIG_SECTIONS: ConfigSection[] = [
 {
 id: 'app',
 title: 'Application Settings',
 description: 'Basic application configuration',
 icon: <Settings className="h-5 w-5" />,
 fields: [
 {
 id: 'app.title',
 name: 'Application Title',
 description: 'The title displayed in the browser and UI',
 type: 'text',
 value: 'Backstage IDP',
 required: true,
 },
 {
 id: 'app.baseUrl',
 name: 'Frontend Base URL',
 description: 'The base URL where the frontend is hosted',
 type: 'text',
 value: 'http://localhost:4401',
 required: true,
 validation: {
 pattern: '^https?://',
 },
 },
 {
 id: 'organization.name',
 name: 'Organization Name',
 description: 'Your organization name',
 type: 'text',
 value: 'IDP Platform',
 required: true,
 },
 ],
 },
 {
 id: 'backend',
 title: 'Backend Configuration',
 description: 'Backend server and API settings',
 icon: <Server className="h-5 w-5" />,
 fields: [
 {
 id: 'backend.baseUrl',
 name: 'Backend Base URL',
 description: 'The base URL where the backend API is hosted',
 type: 'text',
 value: 'http://localhost:4402',
 required: true,
 },
 {
 id: 'backend.listen.port',
 name: 'Backend Port',
 description: 'Port where the backend server listens',
 type: 'number',
 value: 4402,
 required: true,
 validation: {
 min: 1,
 max: 65535,
 },
 },
 {
 id: 'backend.cors.origin',
 name: 'CORS Origins',
 description: 'Allowed origins for CORS (comma-separated)',
 type: 'array',
 value: ['http://localhost:4400', 'http://localhost:4401'],
 required: true,
 },
 ],
 },
 {
 id: 'database',
 title: 'Database Configuration',
 description: 'Database connection settings',
 icon: <Database className="h-5 w-5" />,
 fields: [
 {
 id: 'backend.database.client',
 name: 'Database Type',
 description: 'Type of database to use',
 type: 'select',
 value: 'pg',
 required: true,
 options: [
 { label: 'PostgreSQL', value: 'pg' },
 { label: 'MySQL', value: 'mysql' },
 { label: 'SQLite', value: 'sqlite3' },
 ],
 },
 {
 id: 'backend.database.connection.host',
 name: 'Database Host',
 description: 'Database server hostname',
 type: 'text',
 value: 'localhost',
 required: true,
 },
 {
 id: 'backend.database.connection.port',
 name: 'Database Port',
 description: 'Database server port',
 type: 'number',
 value: 5432,
 required: true,
 },
 {
 id: 'backend.database.connection.user',
 name: 'Database User',
 description: 'Database username',
 type: 'text',
 value: 'backstage_user',
 required: true,
 },
 {
 id: 'backend.database.connection.password',
 name: 'Database Password',
 description: 'Database password',
 type: 'secret',
 value: '',
 required: true,
 sensitive: true,
 },
 {
 id: 'backend.database.connection.database',
 name: 'Database Name',
 description: 'Name of the database',
 type: 'text',
 value: 'backstage_idp',
 required: true,
 },
 ],
 },
 {
 id: 'auth',
 title: 'Authentication',
 description: 'Authentication providers configuration',
 icon: <Shield className="h-5 w-5" />,
 fields: [
 {
 id: 'auth.environment',
 name: 'Environment',
 description: 'Authentication environment',
 type: 'select',
 value: 'development',
 options: [
 { label: 'Development', value: 'development' },
 { label: 'Production', value: 'production' },
 ],
 },
 {
 id: 'auth.providers.github.enabled',
 name: 'Enable GitHub Authentication',
 description: 'Allow users to sign in with GitHub',
 type: 'boolean',
 value: true,
 },
 {
 id: 'auth.providers.github.clientId',
 name: 'GitHub Client ID',
 description: 'OAuth App client ID from GitHub',
 type: 'text',
 value: '',
 sensitive: true,
 },
 {
 id: 'auth.providers.github.clientSecret',
 name: 'GitHub Client Secret',
 description: 'OAuth App client secret from GitHub',
 type: 'secret',
 value: '',
 sensitive: true,
 },
 ],
 },
 {
 id: 'integrations',
 title: 'Integrations',
 description: 'External service integrations',
 icon: <GitBranch className="h-5 w-5" />,
 fields: [
 {
 id: 'integrations.github.host',
 name: 'GitHub Host',
 description: 'GitHub instance hostname',
 type: 'text',
 value: 'github.com',
 required: true,
 },
 {
 id: 'integrations.github.token',
 name: 'GitHub Token',
 description: 'Personal access token for GitHub API',
 type: 'secret',
 value: '',
 sensitive: true,
 required: true,
 },
 {
 id: 'integrations.gitlab.enabled',
 name: 'Enable GitLab Integration',
 description: 'Enable GitLab integration',
 type: 'boolean',
 value: false,
 },
 {
 id: 'integrations.gitlab.host',
 name: 'GitLab Host',
 description: 'GitLab instance hostname',
 type: 'text',
 value: 'gitlab.com',
 },
 {
 id: 'integrations.gitlab.token',
 name: 'GitLab Token',
 description: 'Personal access token for GitLab API',
 type: 'secret',
 value: '',
 sensitive: true,
 },
 ],
 },
 {
 id: 'catalog',
 title: 'Software Catalog',
 description: 'Catalog configuration and locations',
 icon: <FileText className="h-5 w-5" />,
 fields: [
 {
 id: 'catalog.rules',
 name: 'Allowed Entity Kinds',
 description: 'Entity kinds allowed in the catalog',
 type: 'array',
 value: ['Component', 'System', 'API', 'Resource', 'Location', 'Domain', 'Group', 'User'],
 },
 {
 id: 'catalog.refreshInterval',
 name: 'Refresh Interval',
 description: 'How often to refresh catalog entities (in minutes)',
 type: 'number',
 value: 5,
 validation: {
 min: 1,
 max: 60,
 },
 },
 ],
 },
];

export default function ConfigurationEditorPage() {
 const [config, setConfig] = useState<Record<string, any>>({});
 const [showSecrets, setShowSecrets] = useState(false);
 const [showAdvanced, setShowAdvanced] = useState(false);
 const [isDirty, setIsDirty] = useState(false);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
 const [searchQuery, setSearchQuery] = useState('');
 const [copiedField, setCopiedField] = useState<string | null>(null);
 const [activeSection, setActiveSection] = useState('app');

 useEffect(() => {
 loadConfiguration();
 }, []);

 const loadConfiguration = async () => {
 setLoading(true);
 try {
 // In real implementation, load from backend
 const initialConfig: Record<string, any> = {};
 CONFIG_SECTIONS.forEach(section => {
 section.fields.forEach(field => {
 initialConfig[field.id] = field.value;
 });
 });
 setConfig(initialConfig);
 } catch (error) {
 toast.error('Failed to load configuration');
 } finally {
 setLoading(false);
 }
 };

 const handleFieldChange = (fieldId: string, value: any) => {
 setConfig(prev => ({
 ...prev,
 [fieldId]: value,
 }));
 setIsDirty(true);
 
 // Clear validation error for this field
 setValidationErrors(prev => {
 const errors = { ...prev };
 delete errors[fieldId];
 return errors;
 });
 };

 const validateConfiguration = (): boolean => {
 const errors: Record<string, string> = {};
 
 CONFIG_SECTIONS.forEach(section => {
 section.fields.forEach(field => {
 const value = config[field.id];
 
 // Required field validation
 if (field.required && !value) {
 errors[field.id] = 'This field is required';
 }
 
 // Type-specific validation
 if (field.validation) {
 if (field.type === 'text' && field.validation.pattern) {
 const pattern = new RegExp(field.validation.pattern);
 if (!pattern.test(value)) {
 errors[field.id] = 'Invalid format';
 }
 }
 
 if (field.type === 'number') {
 if (field.validation.min !== undefined && value < field.validation.min) {
 errors[field.id] = `Minimum value is ${field.validation.min}`;
 }
 if (field.validation.max !== undefined && value > field.validation.max) {
 errors[field.id] = `Maximum value is ${field.validation.max}`;
 }
 }
 }
 });
 });
 
 setValidationErrors(errors);
 return Object.keys(errors).length === 0;
 };

 const saveConfiguration = async () => {
 if (!validateConfiguration()) {
 toast.error('Please fix validation errors before saving');
 return;
 }
 
 setSaving(true);
 try {
 // In real implementation, save to backend
 await new Promise(resolve => setTimeout(resolve, 1500));
 
 toast.success('Configuration saved successfully');
 setIsDirty(false);
 } catch (error) {
 toast.error('Failed to save configuration');
 } finally {
 setSaving(false);
 }
 };

 const exportConfiguration = () => {
 const yaml = generateYAML(config);
 const blob = new Blob([yaml], { type: 'text/yaml' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'app-config.yaml';
 a.click();
 URL.revokeObjectURL(url);
 toast.success('Configuration exported');
 };

 const generateYAML = (config: Record<string, any>): string => {
 // Simple YAML generation (in real implementation, use a proper YAML library)
 const yamlLines: string[] = [];
 
 const processValue = (key: string, value: any, indent: number = 0) => {
 const spaces = ' '.repeat(indent);
 
 if (Array.isArray(value)) {
 yamlLines.push(`${spaces}${key}:`);
 value.forEach(item => {
 yamlLines.push(`${spaces} - ${item}`);
 });
 } else if (typeof value === 'object' && value !== null) {
 yamlLines.push(`${spaces}${key}:`);
 Object.entries(value).forEach(([k, v]) => {
 processValue(k, v, indent + 1);
 });
 } else {
 yamlLines.push(`${spaces}${key}: ${value}`);
 }
 };
 
 // Group config by top-level keys
 const grouped: Record<string, any> = {};
 Object.entries(config).forEach(([key, value]) => {
 const parts = key.split('.');
 let current = grouped;
 
 parts.forEach((part, index) => {
 if (index === parts.length - 1) {
 current[part] = value;
 } else {
 current[part] = current[part] || {};
 current = current[part];
 }
 });
 });
 
 Object.entries(grouped).forEach(([key, value]) => {
 processValue(key, value);
 });
 
 return yamlLines.join('\n');
 };

 const copyToClipboard = async (fieldId: string, value: string) => {
 await navigator.clipboard.writeText(value);
 setCopiedField(fieldId);
 setTimeout(() => setCopiedField(null), 2000);
 toast.success('Copied to clipboard');
 };

 const filteredSections = CONFIG_SECTIONS.map(section => ({
 ...section,
 fields: section.fields.filter(field => {
 const matchesSearch = searchQuery === '' || 
 field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 field.description.toLowerCase().includes(searchQuery.toLowerCase());
 
 const matchesAdvanced = showAdvanced || !field.advanced;
 
 return matchesSearch && matchesAdvanced;
 }),
 })).filter(section => section.fields.length > 0);

 const renderField = (field: ConfigField) => {
 const value = config[field.id] ?? field.value;
 const error = validationErrors[field.id];
 
 switch (field.type) {
 case 'text':
 case 'number':
 return (
 <div key={field.id} className="space-y-2">
 <Label htmlFor={field.id}>
 {field.name}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 <div className="relative">
 <Input
 id={field.id}
 type={field.type}
 value={value}
 onChange={(e) => handleFieldChange(
 field.id, 
 field.type === 'number' ? Number(e.target.value) : e.target.value
 )}
 placeholder={field.placeholder}
 className={cn(error && 'border-red-500')}
 />
 {field.sensitive && value && (
 <Button
 size="sm"
 variant="ghost"
 className="absolute right-1 top-1 h-7 w-7 p-0"
 onClick={() => copyToClipboard(field.id, value)}
 >
 {copiedField === field.id ? (
 <Check className="h-3 w-3" />
 ) : (
 <Copy className="h-3 w-3" />
 )}
 </Button>
 )}
 </div>
 <p className="text-sm text-gray-600">{field.description}</p>
 {error && <p className="text-sm text-red-500">{error}</p>}
 </div>
 );
 
 case 'secret':
 return (
 <div key={field.id} className="space-y-2">
 <Label htmlFor={field.id}>
 {field.name}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 <div className="relative">
 <Input
 id={field.id}
 type={showSecrets ? 'text' : 'password'}
 value={value}
 onChange={(e) => handleFieldChange(field.id, e.target.value)}
 placeholder={field.placeholder || '••••••••'}
 className={cn(error && 'border-red-500')}
 />
 <Button
 size="sm"
 variant="ghost"
 className="absolute right-1 top-1 h-7 w-7 p-0"
 onClick={() => setShowSecrets(!showSecrets)}
 >
 {showSecrets ? (
 <EyeOff className="h-3 w-3" />
 ) : (
 <Eye className="h-3 w-3" />
 )}
 </Button>
 </div>
 <p className="text-sm text-gray-600">{field.description}</p>
 {error && <p className="text-sm text-red-500">{error}</p>}
 </div>
 );
 
 case 'boolean':
 return (
 <div key={field.id} className="flex items-center justify-between space-y-2">
 <div className="space-y-0.5">
 <Label htmlFor={field.id}>{field.name}</Label>
 <p className="text-sm text-gray-600">{field.description}</p>
 </div>
 <Switch
 id={field.id}
 checked={value}
 onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
 />
 </div>
 );
 
 case 'select':
 return (
 <div key={field.id} className="space-y-2">
 <Label htmlFor={field.id}>
 {field.name}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 <Select
 value={value}
 onValueChange={(val) => handleFieldChange(field.id, val)}
 >
 <SelectTrigger className={cn(error && 'border-red-500')}>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {field.options?.map(option => (
 <SelectItem key={option.value} value={option.value}>
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-sm text-gray-600">{field.description}</p>
 {error && <p className="text-sm text-red-500">{error}</p>}
 </div>
 );
 
 case 'textarea':
 return (
 <div key={field.id} className="space-y-2">
 <Label htmlFor={field.id}>
 {field.name}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 <Textarea
 id={field.id}
 value={value}
 onChange={(e) => handleFieldChange(field.id, e.target.value)}
 placeholder={field.placeholder}
 className={cn(error && 'border-red-500')}
 rows={4}
 />
 <p className="text-sm text-gray-600">{field.description}</p>
 {error && <p className="text-sm text-red-500">{error}</p>}
 </div>
 );
 
 case 'array':
 return (
 <div key={field.id} className="space-y-2">
 <Label>
 {field.name}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 <div className="space-y-2">
 {(value || []).map((item: string, index: number) => (
 <div key={index} className="flex gap-2">
 <Input
 value={item}
 onChange={(e) => {
 const newArray = [...(value || [])];
 newArray[index] = e.target.value;
 handleFieldChange(field.id, newArray);
 }}
 />
 <Button
 size="sm"
 variant="ghost"
 onClick={() => {
 const newArray = (value || []).filter((_: any, i: number) => i !== index);
 handleFieldChange(field.id, newArray);
 }}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 ))}
 <Button
 size="sm"
 variant="outline"
 onClick={() => {
 handleFieldChange(field.id, [...(value || []), '']);
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Item
 </Button>
 </div>
 <p className="text-sm text-gray-600">{field.description}</p>
 {error && <p className="text-sm text-red-500">{error}</p>}
 </div>
 );
 
 default:
 return null;
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold">Configuration Editor</h1>
 <p className="text-gray-600 mt-2">
 Visual editor for Backstage configuration - no YAML editing required
 </p>
 </div>
 <div className="flex items-center gap-4">
 {isDirty && (
 <Badge variant="warning">Unsaved changes</Badge>
 )}
 <Button variant="outline" onClick={exportConfiguration}>
 <FileText className="h-4 w-4 mr-2" />
 Export YAML
 </Button>
 <Button onClick={saveConfiguration} disabled={saving}>
 {saving ? (
 <>
 <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
 <>
 <Save className="h-4 w-4 mr-2" />
 Save Configuration
 </>
 )}
 </Button>
 </div>
 </div>

 <Alert>
 <Zap className="h-4 w-4" />
 <AlertTitle>No-Code Configuration</AlertTitle>
 <AlertDescription>
 Edit your Backstage configuration through this visual interface. 
 Changes are validated in real-time and can be exported as YAML.
 </AlertDescription>
 </Alert>

 <div className="flex gap-6">
 {/* Sidebar */}
 <div className="w-64 space-y-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
 <Input
 placeholder="Search settings..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10"
 />
 </div>
 
 <div className="space-y-1">
 {CONFIG_SECTIONS.map(section => (
 <button
 key={section.id}
 onClick={() => setActiveSection(section.id)}
 className={cn(
 'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
 activeSection === section.id
 ? 'bg-blue-50 text-blue-600'
 : 'hover:bg-gray-100'
 )}
 >
 {section.icon}
 <span className="text-sm font-medium">{section.title}</span>
 </button>
 ))}
 </div>
 
 <Separator />
 
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Label htmlFor="show-secrets" className="text-sm">
 Show secrets
 </Label>
 <Switch
 id="show-secrets"
 checked={showSecrets}
 onCheckedChange={setShowSecrets}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="show-advanced" className="text-sm">
 Advanced settings
 </Label>
 <Switch
 id="show-advanced"
 checked={showAdvanced}
 onCheckedChange={setShowAdvanced}
 />
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="flex-1">
 <Card>
 <CardContent className="p-6">
 {filteredSections
 .filter(section => section.id === activeSection)
 .map(section => (
 <div key={section.id} className="space-y-6">
 <div>
 <h2 className="text-xl font-semibold flex items-center gap-2">
 {section.icon}
 {section.title}
 </h2>
 <p className="text-gray-600 mt-1">{section.description}</p>
 </div>
 <div className="space-y-6">
 {section.fields.map(renderField)}
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 );
}