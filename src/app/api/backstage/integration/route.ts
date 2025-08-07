/**
 * Backstage v1.41.0 Integration API
 * Seamless integration with latest Backstage backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { backstageIntegrationService } from '@/lib/backstage/integration-service';

export async function GET(req: NextRequest) {
 try {
 const searchParams = new URL(req.url).searchParams;
 const action = searchParams.get('action');

 switch (action) {
 case 'health':
 const isHealthy = await backstageIntegrationService.checkBackstageHealth();
 return NextResponse.json({ 
 healthy: isHealthy,
 connected: backstageIntegrationService.isBackstageConnected(),
 version: '1.41.0'
 });

 case 'entities':
 const entities = await backstageIntegrationService.getBackstageEntities();
 return NextResponse.json({ 
 entities,
 count: entities.length
 });

 case 'sync':
 await backstageIntegrationService.syncWithBackstage();
 return NextResponse.json({ 
 success: true,
 message: 'Backstage sync completed'
 });

 case 'status':
 return NextResponse.json({
 connected: backstageIntegrationService.isBackstageConnected(),
 lastSync: new Date().toISOString(),
 version: '1.41.0'
 });

 default:
 return NextResponse.json(
 { error: 'Invalid action parameter' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Backstage integration API error:', error);
 return NextResponse.json(
 { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
 { status: 500 }
 );
 }
}

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { action, pluginId, config, serviceInfo } = body;

 switch (action) {
 case 'install-plugin':
 if (!pluginId) {
 return NextResponse.json(
 { error: 'Plugin ID is required' },
 { status: 400 }
 );
 }

 const installResult = await backstageIntegrationService.installPluginInBackstage(pluginId, config || {});
 
 if (installResult.success) {
 return NextResponse.json({
 success: true,
 message: installResult.message,
 details: installResult.details
 });
 } else {
 return NextResponse.json({
 success: false,
 error: installResult.error || installResult.message
 }, { status: 400 });
 }

 case 'configure-plugin':
 if (!pluginId || !config) {
 return NextResponse.json(
 { error: 'Plugin ID and configuration are required' },
 { status: 400 }
 );
 }

 const configResult = await backstageIntegrationService.configurePluginInBackstage(pluginId, config);
 
 if (configResult.success) {
 return NextResponse.json({
 success: true,
 message: configResult.message,
 details: configResult.details
 });
 } else {
 return NextResponse.json({
 success: false,
 error: configResult.error || configResult.message
 }, { status: 400 });
 }

 case 'create-service':
 if (!serviceInfo) {
 return NextResponse.json(
 { error: 'Service information is required' },
 { status: 400 }
 );
 }

 const serviceResult = await backstageIntegrationService.createOrUpdateService(serviceInfo);
 
 if (serviceResult) {
 return NextResponse.json({
 success: true,
 message: `Service ${serviceInfo.name} created/updated successfully`
 });
 } else {
 return NextResponse.json({
 success: false,
 error: 'Failed to create/update service'
 }, { status: 400 });
 }

 case 'initialize':
 const initResult = await backstageIntegrationService.initialize();
 
 return NextResponse.json({
 success: initResult,
 message: initResult ? 'Backstage integration initialized' : 'Failed to initialize Backstage integration',
 connected: backstageIntegrationService.isBackstageConnected()
 });

 default:
 return NextResponse.json(
 { error: 'Invalid action parameter' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Backstage integration API error:', error);
 return NextResponse.json(
 { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
 { status: 500 }
 );
 }
}