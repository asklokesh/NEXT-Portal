import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Provider configuration state (in production, this would be in a database)
interface ProviderStatus {
 enabled: string[];
 configurations: Record<string, any>;
 lastSync: Record<string, string>;
}

async function loadProviderStatus(): Promise<ProviderStatus> {
 try {
 const configPath = path.join(process.cwd(), 'catalog-providers.json');
 const data = await fs.readFile(configPath, 'utf-8');
 return JSON.parse(data);
 } catch (error) {
 // Return default if no config exists
 return {
 enabled: [],
 configurations: {},
 lastSync: {},
 };
 }
}

async function saveProviderStatus(status: ProviderStatus) {
 const configPath = path.join(process.cwd(), 'catalog-providers.json');
 await fs.writeFile(configPath, JSON.stringify(status, null, 2));
}

export async function GET() {
 try {
 const status = await loadProviderStatus();
 
 // Add runtime information
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 let backstageConnected = false;
 
 try {
 const response = await fetch(`${backstageUrl}/api/catalog/entities?limit=1`);
 backstageConnected = response.ok;
 } catch (error) {
 backstageConnected = false;
 }

 return NextResponse.json({
 ...status,
 backstageConnected,
 availableProviders: [
 'github',
 'kubernetes',
 'aws',
 'gitlab',
 'ldap',
 'database',
 ],
 });
 } catch (error) {
 console.error('Failed to get provider status:', error);
 return NextResponse.json(
 { error: 'Failed to get provider status' },
 { status: 500 }
 );
 }
}

export async function POST(request: NextRequest) {
 try {
 const updates = await request.json();
 const currentStatus = await loadProviderStatus();
 
 const newStatus = {
 ...currentStatus,
 ...updates,
 };
 
 await saveProviderStatus(newStatus);
 
 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Failed to update provider status:', error);
 return NextResponse.json(
 { error: 'Failed to update provider status' },
 { status: 500 }
 );
 }
}