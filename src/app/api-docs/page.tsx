'use client';

import { useState, useEffect } from 'react';
import { 
 Code2, 
 Book, 
 Play, 
 Copy, 
 Check,
 ChevronRight,
 ChevronDown,
 Search,
 Filter,
 Globe,
 Lock,
 Zap,
 Settings,
 Key,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface APIEndpoint {
 id: string;
 path: string;
 method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
 category: string;
 description: string;
 authentication: 'none' | 'api_key' | 'bearer' | 'oauth2';
 parameters?: APIParameter[];
 requestBody?: APIRequestBody;
 responses: APIResponse[];
 examples: APIExample[];
 deprecated?: boolean;
 beta?: boolean;
}

interface APIParameter {
 name: string;
 type: string;
 in: 'path' | 'query' | 'header';
 required: boolean;
 description: string;
 default?: any;
 enum?: string[];
}

interface APIRequestBody {
 type: string;
 required: boolean;
 schema: any;
 example?: any;
}

interface APIResponse {
 status: number;
 description: string;
 schema?: any;
 example?: any;
}

interface APIExample {
 name: string;
 description?: string;
 request: {
 method: string;
 path: string;
 headers?: Record<string, string>;
 body?: any;
 };
 response: {
 status: number;
 body: any;
 };
}

const API_CATEGORIES = [
 { id: 'catalog', name: 'Service Catalog', icon: 'CATALOG' },
 { id: 'templates', name: 'Templates', icon: 'TEMPLATE' },
 { id: 'deployments', name: 'Deployments', icon: 'DEPLOY' },
 { id: 'workflows', name: 'Workflows', icon: 'AUTO' },
 { id: 'monitoring', name: 'Monitoring', icon: 'MONITOR' },
 { id: 'auth', name: 'Authentication', icon: 'AUTH' },
 { id: 'admin', name: 'Admin', icon: 'ADMIN' },
];

const API_ENDPOINTS: APIEndpoint[] = [
 // Catalog APIs
 {
 id: 'get-entities',
 path: '/api/catalog/entities',
 method: 'GET',
 category: 'catalog',
 description: 'List all entities in the service catalog',
 authentication: 'bearer',
 parameters: [
 {
 name: 'kind',
 type: 'string',
 in: 'query',
 required: false,
 description: 'Filter by entity kind (Component, API, System, etc.)',
 enum: ['Component', 'API', 'System', 'Domain', 'Group', 'User'],
 },
 {
 name: 'namespace',
 type: 'string',
 in: 'query',
 required: false,
 description: 'Filter by namespace',
 default: 'default',
 },
 {
 name: 'limit',
 type: 'integer',
 in: 'query',
 required: false,
 description: 'Maximum number of results',
 default: 20,
 },
 {
 name: 'offset',
 type: 'integer',
 in: 'query',
 required: false,
 description: 'Number of results to skip',
 default: 0,
 },
 ],
 responses: [
 {
 status: 200,
 description: 'List of entities',
 example: {
 items: [
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'frontend-app',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/example/repo',
 },
 },
 spec: {
 type: 'website',
 lifecycle: 'production',
 owner: 'platform-team',
 },
 },
 ],
 totalItems: 127,
 },
 },
 {
 status: 401,
 description: 'Unauthorized',
 },
 ],
 examples: [
 {
 name: 'List all components',
 request: {
 method: 'GET',
 path: '/api/catalog/entities?kind=Component',
 headers: {
 'Authorization': 'Bearer YOUR_TOKEN',
 },
 },
 response: {
 status: 200,
 body: {
 items: [],
 totalItems: 45,
 },
 },
 },
 ],
 },
 {
 id: 'create-entity',
 path: '/api/catalog/entities',
 method: 'POST',
 category: 'catalog',
 description: 'Create a new entity in the service catalog',
 authentication: 'bearer',
 requestBody: {
 type: 'object',
 required: true,
 schema: {
 apiVersion: 'string',
 kind: 'string',
 metadata: {
 name: 'string',
 namespace: 'string',
 },
 spec: 'object',
 },
 example: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'my-service',
 namespace: 'default',
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'my-team',
 },
 },
 },
 responses: [
 {
 status: 201,
 description: 'Entity created successfully',
 },
 {
 status: 400,
 description: 'Invalid entity data',
 },
 ],
 examples: [],
 },

 // Template APIs
 {
 id: 'list-templates',
 path: '/api/templates',
 method: 'GET',
 category: 'templates',
 description: 'List all available software templates',
 authentication: 'bearer',
 parameters: [
 {
 name: 'tags',
 type: 'string',
 in: 'query',
 required: false,
 description: 'Filter by tags (comma-separated)',
 },
 ],
 responses: [
 {
 status: 200,
 description: 'List of templates',
 },
 ],
 examples: [],
 },
 {
 id: 'execute-template',
 path: '/api/templates/{templateId}/execute',
 method: 'POST',
 category: 'templates',
 description: 'Execute a software template to create new resources',
 authentication: 'bearer',
 parameters: [
 {
 name: 'templateId',
 type: 'string',
 in: 'path',
 required: true,
 description: 'Template identifier',
 },
 ],
 requestBody: {
 type: 'object',
 required: true,
 schema: {
 values: 'object',
 secrets: 'object',
 },
 },
 responses: [
 {
 status: 202,
 description: 'Template execution started',
 example: {
 taskId: 'task-123',
 status: 'running',
 },
 },
 ],
 examples: [],
 },

 // Workflow APIs
 {
 id: 'list-workflows',
 path: '/api/workflows',
 method: 'GET',
 category: 'workflows',
 description: 'List all workflow definitions',
 authentication: 'bearer',
 beta: true,
 parameters: [
 {
 name: 'category',
 type: 'string',
 in: 'query',
 required: false,
 description: 'Filter by workflow category',
 enum: ['approval', 'automation', 'notification', 'deployment', 'custom'],
 },
 {
 name: 'status',
 type: 'string',
 in: 'query',
 required: false,
 description: 'Filter by workflow status',
 enum: ['draft', 'active', 'paused', 'archived'],
 },
 ],
 responses: [
 {
 status: 200,
 description: 'List of workflows',
 },
 ],
 examples: [],
 },
 {
 id: 'execute-workflow',
 path: '/api/workflows/{workflowId}/execute',
 method: 'POST',
 category: 'workflows',
 description: 'Execute a workflow',
 authentication: 'bearer',
 beta: true,
 parameters: [
 {
 name: 'workflowId',
 type: 'string',
 in: 'path',
 required: true,
 description: 'Workflow identifier',
 },
 ],
 requestBody: {
 type: 'object',
 required: false,
 schema: {
 context: 'object',
 },
 },
 responses: [
 {
 status: 202,
 description: 'Workflow execution started',
 },
 ],
 examples: [],
 },

 // Authentication APIs
 {
 id: 'login',
 path: '/api/auth/login',
 method: 'POST',
 category: 'auth',
 description: 'Authenticate user and receive access token',
 authentication: 'none',
 requestBody: {
 type: 'object',
 required: true,
 schema: {
 email: 'string',
 password: 'string',
 },
 },
 responses: [
 {
 status: 200,
 description: 'Authentication successful',
 example: {
 accessToken: 'eyJhbGciOiJIUzI1NiIs...',
 refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
 expiresIn: 3600,
 },
 },
 ],
 examples: [],
 },
];

const METHOD_COLORS = {
 GET: 'bg-blue-500',
 POST: 'bg-green-500',
 PUT: 'bg-yellow-500',
 DELETE: 'bg-red-500',
 PATCH: 'bg-purple-500',
};

export default function APIDocsPage() {
 const [selectedCategory, setSelectedCategory] = useState('all');
 const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [testRequest, setTestRequest] = useState<Record<string, any>>({});
 const [testResponse, setTestResponse] = useState<any>(null);
 const [loading, setLoading] = useState(false);
 const [apiKey, setApiKey] = useState('');
 const [baseUrl, setBaseUrl] = useState('http://localhost:3000');
 const [copiedCode, setCopiedCode] = useState<string | null>(null);

 const filteredEndpoints = API_ENDPOINTS.filter(endpoint => {
 const matchesCategory = selectedCategory === 'all' || endpoint.category === selectedCategory;
 const matchesSearch = searchQuery === '' || 
 endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
 endpoint.description.toLowerCase().includes(searchQuery.toLowerCase());
 return matchesCategory && matchesSearch;
 });

 const groupedEndpoints = filteredEndpoints.reduce((acc, endpoint) => {
 if (!acc[endpoint.category]) {
 acc[endpoint.category] = [];
 }
 acc[endpoint.category].push(endpoint);
 return acc;
 }, {} as Record<string, APIEndpoint[]>);

 const copyToClipboard = async (text: string, id: string) => {
 await navigator.clipboard.writeText(text);
 setCopiedCode(id);
 setTimeout(() => setCopiedCode(null), 2000);
 toast.success('Copied to clipboard');
 };

 const generateCurlCommand = (endpoint: APIEndpoint) => {
 let curl = `curl -X ${endpoint.method} \\
 "${baseUrl}${endpoint.path}"`;

 if (endpoint.authentication !== 'none') {
 curl += ` \\
 -H "Authorization: Bearer ${apiKey || 'YOUR_TOKEN'}"`;
 }

 if (endpoint.requestBody) {
 curl += ` \\
 -H "Content-Type: application/json" \\
 -d '${JSON.stringify(endpoint.requestBody.example || {}, null, 2)}'`;
 }

 return curl;
 };

 const generateJavaScriptCode = (endpoint: APIEndpoint) => {
 let headers = '';
 if (endpoint.authentication !== 'none') {
 headers = `
 'Authorization': 'Bearer ${apiKey || 'YOUR_TOKEN'}',`;
 }

 let body = '';
 if (endpoint.requestBody) {
 body = `,
 body: JSON.stringify(${JSON.stringify(endpoint.requestBody.example || {}, null, 2)})`;
 }

 return `const response = await fetch('${baseUrl}${endpoint.path}', {
 method: '${endpoint.method}',
 headers: {${headers}
 'Content-Type': 'application/json'
 }${body}
});

const data = await response.json();
console.log(data);`;
 };

 const generatePythonCode = (endpoint: APIEndpoint) => {
 let headers = "headers = {\n 'Content-Type': 'application/json'";
 if (endpoint.authentication !== 'none') {
 headers += `,\n 'Authorization': f'Bearer {${apiKey ? `"${apiKey}"` : 'API_KEY'}}'`;
 }
 headers += '\n}';

 let data = '';
 if (endpoint.requestBody) {
 data = `\ndata = ${JSON.stringify(endpoint.requestBody.example || {}, null, 4)}`;
 }

 return `import requests

url = "${baseUrl}${endpoint.path}"
${headers}${data}

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers${data ? ', json=data' : ''})
print(response.json())`;
 };

 const testEndpoint = async () => {
 if (!selectedEndpoint) return;

 setLoading(true);
 setTestResponse(null);

 try {
 const headers: HeadersInit = {
 'Content-Type': 'application/json',
 };

 if (selectedEndpoint.authentication !== 'none' && apiKey) {
 headers['Authorization'] = `Bearer ${apiKey}`;
 }

 const options: RequestInit = {
 method: selectedEndpoint.method,
 headers,
 };

 if (selectedEndpoint.requestBody && testRequest.body) {
 options.body = JSON.stringify(testRequest.body);
 }

 // Build URL with query parameters
 let url = `${baseUrl}${selectedEndpoint.path}`;
 if (testRequest.query) {
 const params = new URLSearchParams(testRequest.query);
 url += `?${params.toString()}`;
 }

 const response = await fetch(url, options);
 const data = await response.json();

 setTestResponse({
 status: response.status,
 statusText: response.statusText,
 headers: Object.fromEntries(response.headers.entries()),
 body: data,
 });
 } catch (error) {
 setTestResponse({
 error: error instanceof Error ? error.message : 'Request failed',
 });
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-3xl font-bold">API Documentation</h1>
 <p className="text-gray-600 mt-2">
 Interactive documentation for the IDP Platform REST API
 </p>
 </div>

 <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
 {/* Sidebar */}
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="text-lg">API Settings</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label htmlFor="baseUrl">Base URL</Label>
 <Input
 id="baseUrl"
 value={baseUrl}
 onChange={(e) => setBaseUrl(e.target.value)}
 placeholder="https://api.example.com"
 />
 </div>
 <div>
 <Label htmlFor="apiKey">API Key</Label>
 <div className="relative">
 <Input
 id="apiKey"
 type="password"
 value={apiKey}
 onChange={(e) => setApiKey(e.target.value)}
 placeholder="Your API key"
 />
 <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Endpoints</CardTitle>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
 <Input
 placeholder="Search endpoints..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10"
 />
 </div>
 </CardHeader>
 <CardContent className="p-0">
 <div className="space-y-1">
 <button
 onClick={() => setSelectedCategory('all')}
 className={cn(
 'w-full px-4 py-2 text-left text-sm hover:bg-gray-100',
 selectedCategory === 'all' && 'bg-gray-100 font-medium'
 )}
 >
 All Endpoints
 </button>
 {API_CATEGORIES.map(category => (
 <button
 key={category.id}
 onClick={() => setSelectedCategory(category.id)}
 className={cn(
 'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2',
 selectedCategory === category.id && 'bg-gray-100 font-medium'
 )}
 >
 <span>{category.icon}</span>
 <span>{category.name}</span>
 </button>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Endpoint List */}
 <div className="space-y-2">
 {Object.entries(groupedEndpoints).map(([category, endpoints]) => (
 <div key={category}>
 <h3 className="text-sm font-medium text-gray-600 mb-2 capitalize">
 {API_CATEGORIES.find(c => c.id === category)?.name || category}
 </h3>
 {endpoints.map(endpoint => (
 <button
 key={endpoint.id}
 onClick={() => setSelectedEndpoint(endpoint)}
 className={cn(
 'w-full text-left p-3 rounded-lg border hover:border-gray-300 transition-colors',
 selectedEndpoint?.id === endpoint.id && 'border-blue-500 bg-blue-50'
 )}
 >
 <div className="flex items-center gap-2 mb-1">
 <Badge
 className={cn(
 'text-white text-xs',
 METHOD_COLORS[endpoint.method]
 )}
 >
 {endpoint.method}
 </Badge>
 {endpoint.beta && (
 <Badge variant="outline" className="text-xs">
 Beta
 </Badge>
 )}
 {endpoint.deprecated && (
 <Badge variant="destructive" className="text-xs">
 Deprecated
 </Badge>
 )}
 </div>
 <p className="text-sm font-mono">{endpoint.path}</p>
 <p className="text-xs text-gray-600 mt-1">{endpoint.description}</p>
 </button>
 ))}
 </div>
 ))}
 </div>
 </div>

 {/* Main Content */}
 <div>
 {selectedEndpoint ? (
 <Card>
 <CardHeader>
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge
 className={cn(
 'text-white',
 METHOD_COLORS[selectedEndpoint.method]
 )}
 >
 {selectedEndpoint.method}
 </Badge>
 <code className="text-lg font-mono">{selectedEndpoint.path}</code>
 {selectedEndpoint.beta && (
 <Badge variant="outline">Beta</Badge>
 )}
 </div>
 <CardDescription>{selectedEndpoint.description}</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 {selectedEndpoint.authentication !== 'none' && (
 <Badge variant="secondary">
 <Lock className="h-3 w-3 mr-1" />
 {selectedEndpoint.authentication}
 </Badge>
 )}
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <Tabs defaultValue="documentation" className="space-y-4">
 <TabsList>
 <TabsTrigger value="documentation">Documentation</TabsTrigger>
 <TabsTrigger value="try-it">Try It</TabsTrigger>
 <TabsTrigger value="code-examples">Code Examples</TabsTrigger>
 </TabsList>

 <TabsContent value="documentation" className="space-y-6">
 {/* Parameters */}
 {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
 <div>
 <h3 className="text-lg font-semibold mb-3">Parameters</h3>
 <div className="space-y-3">
 {selectedEndpoint.parameters.map(param => (
 <div key={param.name} className="border rounded-lg p-4">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 <code className="font-mono text-sm">{param.name}</code>
 <Badge variant="outline">{param.type}</Badge>
 <Badge variant="secondary">{param.in}</Badge>
 {param.required && (
 <Badge variant="destructive">Required</Badge>
 )}
 </div>
 </div>
 <p className="text-sm text-gray-600">{param.description}</p>
 {param.default !== undefined && (
 <p className="text-sm mt-1">
 Default: <code className="bg-gray-100 px-1 py-0.5 rounded">
 {JSON.stringify(param.default)}
 </code>
 </p>
 )}
 {param.enum && (
 <p className="text-sm mt-1">
 Allowed values: {param.enum.map(v => (
 <code key={v} className="bg-gray-100 px-1 py-0.5 rounded mx-1">
 {v}
 </code>
 ))}
 </p>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Request Body */}
 {selectedEndpoint.requestBody && (
 <div>
 <h3 className="text-lg font-semibold mb-3">Request Body</h3>
 <div className="border rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2">
 <Badge variant="outline">{selectedEndpoint.requestBody.type}</Badge>
 {selectedEndpoint.requestBody.required && (
 <Badge variant="destructive">Required</Badge>
 )}
 </div>
 {selectedEndpoint.requestBody.example && (
 <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
 {JSON.stringify(selectedEndpoint.requestBody.example, null, 2)}
 </pre>
 )}
 </div>
 </div>
 )}

 {/* Responses */}
 <div>
 <h3 className="text-lg font-semibold mb-3">Responses</h3>
 <div className="space-y-3">
 {selectedEndpoint.responses.map(response => (
 <div key={response.status} className="border rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2">
 <Badge
 variant={response.status < 400 ? 'success' : 'destructive'}
 >
 {response.status}
 </Badge>
 <span className="text-sm">{response.description}</span>
 </div>
 {response.example && (
 <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
 {JSON.stringify(response.example, null, 2)}
 </pre>
 )}
 </div>
 ))}
 </div>
 </div>
 </TabsContent>

 <TabsContent value="try-it" className="space-y-4">
 <Alert>
 <Zap className="h-4 w-4" />
 <AlertDescription>
 Test the API endpoint directly from your browser
 </AlertDescription>
 </Alert>

 {/* Test Parameters */}
 {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
 <div>
 <h3 className="text-lg font-semibold mb-3">Parameters</h3>
 <div className="space-y-3">
 {selectedEndpoint.parameters.map(param => (
 <div key={param.name}>
 <Label htmlFor={param.name}>
 {param.name}
 {param.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 <Input
 id={param.name}
 placeholder={param.description}
 onChange={(e) => {
 setTestRequest(prev => ({
 ...prev,
 [param.in]: {
 ...prev[param.in],
 [param.name]: e.target.value,
 },
 }));
 }}
 />
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Test Request Body */}
 {selectedEndpoint.requestBody && (
 <div>
 <Label htmlFor="requestBody">Request Body</Label>
 <Textarea
 id="requestBody"
 className="font-mono text-sm"
 rows={10}
 defaultValue={JSON.stringify(
 selectedEndpoint.requestBody.example || {},
 null,
 2
 )}
 onChange={(e) => {
 try {
 const body = JSON.parse(e.target.value);
 setTestRequest(prev => ({ ...prev, body }));
 } catch {
 // Invalid JSON
 }
 }}
 />
 </div>
 )}

 <Button onClick={testEndpoint} disabled={loading}>
 {loading ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
 Sending...
 </>
 ) : (
 <>
 <Play className="h-4 w-4 mr-2" />
 Send Request
 </>
 )}
 </Button>

 {/* Test Response */}
 {testResponse && (
 <div>
 <h3 className="text-lg font-semibold mb-3">Response</h3>
 <div className="border rounded-lg p-4">
 {testResponse.error ? (
 <Alert variant="destructive">
 <AlertDescription>{testResponse.error}</AlertDescription>
 </Alert>
 ) : (
 <>
 <div className="flex items-center gap-2 mb-3">
 <Badge
 variant={testResponse.status < 400 ? 'success' : 'destructive'}
 >
 {testResponse.status} {testResponse.statusText}
 </Badge>
 </div>
 <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
 {JSON.stringify(testResponse.body, null, 2)}
 </pre>
 </>
 )}
 </div>
 </div>
 )}
 </TabsContent>

 <TabsContent value="code-examples" className="space-y-4">
 <div className="space-y-4">
 {/* cURL */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-semibold">cURL</h4>
 <Button
 size="sm"
 variant="outline"
 onClick={() => copyToClipboard(
 generateCurlCommand(selectedEndpoint),
 'curl'
 )}
 >
 {copiedCode === 'curl' ? (
 <Check className="h-4 w-4" />
 ) : (
 <Copy className="h-4 w-4" />
 )}
 </Button>
 </div>
 <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
 {generateCurlCommand(selectedEndpoint)}
 </pre>
 </div>

 {/* JavaScript */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-semibold">JavaScript</h4>
 <Button
 size="sm"
 variant="outline"
 onClick={() => copyToClipboard(
 generateJavaScriptCode(selectedEndpoint),
 'javascript'
 )}
 >
 {copiedCode === 'javascript' ? (
 <Check className="h-4 w-4" />
 ) : (
 <Copy className="h-4 w-4" />
 )}
 </Button>
 </div>
 <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
 {generateJavaScriptCode(selectedEndpoint)}
 </pre>
 </div>

 {/* Python */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-semibold">Python</h4>
 <Button
 size="sm"
 variant="outline"
 onClick={() => copyToClipboard(
 generatePythonCode(selectedEndpoint),
 'python'
 )}
 >
 {copiedCode === 'python' ? (
 <Check className="h-4 w-4" />
 ) : (
 <Copy className="h-4 w-4" />
 )}
 </Button>
 </div>
 <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
 {generatePythonCode(selectedEndpoint)}
 </pre>
 </div>
 </div>
 </TabsContent>
 </Tabs>
 </CardContent>
 </Card>
 ) : (
 <Card className="p-12 text-center">
 <Book className="h-12 w-12 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Select an endpoint</h3>
 <p className="text-gray-600">
 Choose an API endpoint from the sidebar to view its documentation
 </p>
 </Card>
 )}
 </div>
 </div>
 </div>
 );
}