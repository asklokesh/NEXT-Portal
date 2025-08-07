'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Database, AlertCircle } from 'lucide-react';

interface DatabaseSetupProps {
 data: {
 databaseUrl: string;
 };
 onUpdate: (data: { databaseUrl: string }) => void;
}

export function DatabaseSetup({ data, onUpdate }: DatabaseSetupProps) {
 const [connectionType, setConnectionType] = useState<'url' | 'params'>('url');
 const [dbParams, setDbParams] = useState({
 host: 'localhost',
 port: '5432',
 database: 'backstage_idp',
 username: 'backstage_user',
 password: '',
 ssl: false,
 });
 const [testResult, setTestResult] = useState<{
 status: 'idle' | 'testing' | 'success' | 'error';
 message?: string;
 }>({ status: 'idle' });

 const buildConnectionUrl = () => {
 const { host, port, database, username, password, ssl } = dbParams;
 const sslParam = ssl ? '?sslmode=require' : '';
 return `postgresql://${username}:${password}@${host}:${port}/${database}${sslParam}`;
 };

 const handleParamChange = (key: keyof typeof dbParams, value: string | boolean) => {
 const newParams = { ...dbParams, [key]: value };
 setDbParams(newParams);
 
 // Update the connection URL when using params
 if (connectionType === 'params') {
 const { host, port, database, username, password, ssl } = newParams;
 const sslParam = ssl ? '?sslmode=require' : '';
 const url = `postgresql://${username}:${password}@${host}:${port}/${database}${sslParam}`;
 onUpdate({ ...data, databaseUrl: url });
 }
 };

 const testConnection = async () => {
 setTestResult({ status: 'testing' });

 try {
 const response = await fetch('/api/setup/test-database', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 databaseUrl: connectionType === 'url' ? data.databaseUrl : buildConnectionUrl(),
 }),
 });

 const result = await response.json();

 if (response.ok && result.success) {
 setTestResult({
 status: 'success',
 message: 'Successfully connected to the database!',
 });
 } else {
 setTestResult({
 status: 'error',
 message: result.error || 'Failed to connect to the database',
 });
 }
 } catch (error) {
 setTestResult({
 status: 'error',
 message: 'Connection test failed. Please check your settings.',
 });
 }
 };

 const runMigrations = async () => {
 try {
 const response = await fetch('/api/setup/run-migrations', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 databaseUrl: connectionType === 'url' ? data.databaseUrl : buildConnectionUrl(),
 }),
 });

 const result = await response.json();
 
 if (response.ok && result.success) {
 setTestResult({
 status: 'success',
 message: 'Database migrations completed successfully!',
 });
 } else {
 setTestResult({
 status: 'error',
 message: result.error || 'Failed to run migrations',
 });
 }
 } catch (error) {
 setTestResult({
 status: 'error',
 message: 'Failed to run database migrations',
 });
 }
 };

 return (
 <div className="space-y-6">
 <Tabs value={connectionType} onValueChange={(v) => setConnectionType(v as 'url' | 'params')}>
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="url">Connection URL</TabsTrigger>
 <TabsTrigger value="params">Connection Parameters</TabsTrigger>
 </TabsList>

 <TabsContent value="url" className="space-y-4">
 <div>
 <Label htmlFor="database-url">PostgreSQL Connection URL</Label>
 <Input
 id="database-url"
 type="text"
 placeholder="postgresql://user:password@localhost:5432/backstage_idp"
 value={data.databaseUrl}
 onChange={(e) => onUpdate({ ...data, databaseUrl: e.target.value })}
 className="mt-1 font-mono text-sm"
 />
 <p className="text-sm text-muted-foreground mt-1">
 Full PostgreSQL connection string including credentials
 </p>
 </div>
 </TabsContent>

 <TabsContent value="params" className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <div>
 <Label htmlFor="db-host">Host</Label>
 <Input
 id="db-host"
 value={dbParams.host}
 onChange={(e) => handleParamChange('host', e.target.value)}
 className="mt-1"
 />
 </div>
 <div>
 <Label htmlFor="db-port">Port</Label>
 <Input
 id="db-port"
 value={dbParams.port}
 onChange={(e) => handleParamChange('port', e.target.value)}
 className="mt-1"
 />
 </div>
 <div>
 <Label htmlFor="db-name">Database Name</Label>
 <Input
 id="db-name"
 value={dbParams.database}
 onChange={(e) => handleParamChange('database', e.target.value)}
 className="mt-1"
 />
 </div>
 <div>
 <Label htmlFor="db-user">Username</Label>
 <Input
 id="db-user"
 value={dbParams.username}
 onChange={(e) => handleParamChange('username', e.target.value)}
 className="mt-1"
 />
 </div>
 <div>
 <Label htmlFor="db-password">Password</Label>
 <Input
 id="db-password"
 type="password"
 value={dbParams.password}
 onChange={(e) => handleParamChange('password', e.target.value)}
 className="mt-1"
 />
 </div>
 <div className="flex items-center space-x-2">
 <Switch
 id="db-ssl"
 checked={dbParams.ssl}
 onCheckedChange={(checked) => handleParamChange('ssl', checked)}
 />
 <Label htmlFor="db-ssl">Enable SSL</Label>
 </div>
 </div>
 </TabsContent>
 </Tabs>

 <div className="flex gap-2">
 <Button
 onClick={testConnection}
 disabled={testResult.status === 'testing'}
 variant="outline"
 >
 {testResult.status === 'testing' ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Testing...
 </>
 ) : (
 <>
 <Database className="h-4 w-4 mr-2" />
 Test Connection
 </>
 )}
 </Button>

 <Button
 onClick={runMigrations}
 disabled={testResult.status !== 'success'}
 >
 Run Migrations
 </Button>
 </div>

 {/* Connection Status */}
 {testResult.status !== 'idle' && (
 <Alert className={
 testResult.status === 'success' ? 'border-green-500' :
 testResult.status === 'error' ? 'border-red-500' :
 'border-blue-500'
 }>
 <div className="flex items-center gap-2">
 {testResult.status === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
 {testResult.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
 {testResult.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
 <AlertDescription>{testResult.message}</AlertDescription>
 </div>
 </Alert>
 )}

 {/* Redis Configuration */}
 <Card>
 <CardContent className="pt-6">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <Database className="h-4 w-4" />
 Redis Cache (Optional)
 </h3>
 <div className="space-y-4">
 <div>
 <Label htmlFor="redis-url">Redis Connection URL</Label>
 <Input
 id="redis-url"
 type="text"
 placeholder="redis://localhost:6379"
 className="mt-1"
 />
 <p className="text-sm text-muted-foreground mt-1">
 Optional: Improves performance with caching
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Database Tips */}
 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 <strong>Database setup tips:</strong>
 <ul className="mt-2 space-y-1 text-sm">
 <li>• Ensure PostgreSQL 12+ is installed and running</li>
 <li>• The database should be created before connecting</li>
 <li>• User must have CREATE and ALTER privileges</li>
 <li>• For production, always enable SSL</li>
 </ul>
 </AlertDescription>
 </Alert>
 </div>
 );
}