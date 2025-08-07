'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface BackstageConnectionTestProps {
 data: {
 backstageUrl: string;
 backstageToken: string;
 };
 onUpdate: (data: { backstageUrl: string; backstageToken: string }) => void;
}

interface TestResult {
 status: 'idle' | 'testing' | 'success' | 'error';
 message?: string;
 details?: {
 version?: string;
 plugins?: string[];
 entities?: number;
 };
}

export function BackstageConnectionTest({ data, onUpdate }: BackstageConnectionTestProps) {
 const [testResult, setTestResult] = useState<TestResult>({ status: 'idle' });
 const [isTestingConnection, setIsTestingConnection] = useState(false);

 const testConnection = async () => {
 if (!data.backstageUrl) {
 setTestResult({
 status: 'error',
 message: 'Please enter a Backstage URL',
 });
 return;
 }

 setIsTestingConnection(true);
 setTestResult({ status: 'testing' });

 try {
 // Test the connection
 const response = await fetch('/api/setup/test-backstage', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 url: data.backstageUrl,
 token: data.backstageToken,
 }),
 });

 const result = await response.json();

 if (response.ok && result.success) {
 setTestResult({
 status: 'success',
 message: 'Successfully connected to Backstage!',
 details: result.details,
 });
 } else {
 setTestResult({
 status: 'error',
 message: result.error || 'Failed to connect to Backstage',
 });
 }
 } catch (error) {
 setTestResult({
 status: 'error',
 message: 'Connection failed. Please check your URL and try again.',
 });
 } finally {
 setIsTestingConnection(false);
 }
 };

 const getStatusIcon = () => {
 switch (testResult.status) {
 case 'testing':
 return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
 case 'success':
 return <CheckCircle className="h-5 w-5 text-green-500" />;
 case 'error':
 return <XCircle className="h-5 w-5 text-red-500" />;
 default:
 return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
 }
 };

 return (
 <div className="space-y-6">
 <div className="space-y-4">
 <div>
 <Label htmlFor="backstage-url">Backstage Backend URL</Label>
 <Input
 id="backstage-url"
 type="url"
 placeholder="http://localhost:7007"
 value={data.backstageUrl}
 onChange={(e) => onUpdate({ ...data, backstageUrl: e.target.value })}
 className="mt-1"
 />
 <p className="text-sm text-muted-foreground mt-1">
 The URL where your Backstage backend is running
 </p>
 </div>

 <div>
 <Label htmlFor="backstage-token">Authentication Token (Optional)</Label>
 <Input
 id="backstage-token"
 type="password"
 placeholder="Enter your Backstage auth token"
 value={data.backstageToken}
 onChange={(e) => onUpdate({ ...data, backstageToken: e.target.value })}
 className="mt-1"
 />
 <p className="text-sm text-muted-foreground mt-1">
 Required if your Backstage instance has authentication enabled
 </p>
 </div>

 <Button
 onClick={testConnection}
 disabled={isTestingConnection || !data.backstageUrl}
 className="w-full sm:w-auto"
 >
 {isTestingConnection ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Testing Connection...
 </>
 ) : (
 <>
 <RefreshCw className="h-4 w-4 mr-2" />
 Test Connection
 </>
 )}
 </Button>
 </div>

 {/* Connection Status */}
 {testResult.status !== 'idle' && (
 <Card className={`border-2 ${
 testResult.status === 'success' ? 'border-green-500' :
 testResult.status === 'error' ? 'border-red-500' :
 'border-blue-500'
 }`}>
 <CardContent className="pt-6">
 <div className="flex items-start gap-3">
 {getStatusIcon()}
 <div className="flex-1">
 <p className="font-medium">
 {testResult.message}
 </p>
 
 {testResult.status === 'success' && testResult.details && (
 <div className="mt-4 space-y-3">
 {testResult.details.version && (
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Backstage Version:</span>
 <Badge variant="secondary">{testResult.details.version}</Badge>
 </div>
 )}
 
 {testResult.details.entities !== undefined && (
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Entities Found:</span>
 <Badge variant="secondary">{testResult.details.entities}</Badge>
 </div>
 )}
 
 {testResult.details.plugins && testResult.details.plugins.length > 0 && (
 <div>
 <span className="text-sm text-muted-foreground">Detected Plugins:</span>
 <div className="flex flex-wrap gap-2 mt-2">
 {testResult.details.plugins.map((plugin) => (
 <Badge key={plugin} variant="outline">{plugin}</Badge>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Common Issues Help */}
 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 <strong>Common connection issues:</strong>
 <ul className="mt-2 space-y-1 text-sm">
 <li>• Ensure Backstage is running and accessible</li>
 <li>• Check if CORS is properly configured on your Backstage backend</li>
 <li>• Verify the URL includes the correct protocol (http:// or https://)</li>
 <li>• If using authentication, ensure the token is valid</li>
 </ul>
 </AlertDescription>
 </Alert>
 </div>
 );
}