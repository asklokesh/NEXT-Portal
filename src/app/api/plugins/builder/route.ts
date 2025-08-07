/**
 * Custom Plugin Builder API
 * API endpoints for building custom Backstage plugins
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
 try {
 const searchParams = new URL(req.url).searchParams;
 const action = searchParams.get('action');

 // Dynamic import to avoid SSR issues
 const { customPluginBuilder } = await import('@/lib/plugins/custom-plugin-builder');

 switch (action) {
 case 'templates':
 const templates = customPluginBuilder.getAvailableTemplates();
 return NextResponse.json({
 templates: templates.map(t => ({
 id: t.id,
 name: t.name,
 description: t.description,
 category: t.category,
 baseTemplate: t.baseTemplate
 }))
 });

 case 'template':
 const templateId = searchParams.get('id');
 if (!templateId) {
 return NextResponse.json(
 { error: 'Template ID is required' },
 { status: 400 }
 );
 }
 
 const template = customPluginBuilder.getTemplate(templateId);
 if (!template) {
 return NextResponse.json(
 { error: 'Template not found' },
 { status: 404 }
 );
 }

 return NextResponse.json({ template });

 case 'categories':
 const allTemplates = customPluginBuilder.getAvailableTemplates();
 const categories = [...new Set(allTemplates.map(t => t.category))];
 return NextResponse.json({ categories });

 default:
 return NextResponse.json(
 { error: 'Invalid action parameter' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Custom plugin builder API error:', error);
 return NextResponse.json(
 { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
 { status: 500 }
 );
 }
}

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { action, templateId, customization } = body;

 // Dynamic import to avoid SSR issues
 const { customPluginBuilder } = await import('@/lib/plugins/custom-plugin-builder');

 switch (action) {
 case 'build':
 if (!templateId || !customization) {
 return NextResponse.json(
 { error: 'Template ID and customization data are required' },
 { status: 400 }
 );
 }

 // Validate customization data
 const { pluginName, pluginId, description, owner, configuration } = customization;
 if (!pluginName || !pluginId || !description || !owner) {
 return NextResponse.json(
 { error: 'Missing required customization fields: pluginName, pluginId, description, owner' },
 { status: 400 }
 );
 }

 // Validate plugin ID format
 if (!/^[a-z][a-z0-9-]*$/.test(pluginId)) {
 return NextResponse.json(
 { error: 'Plugin ID must start with a letter and contain only lowercase letters, numbers, and hyphens' },
 { status: 400 }
 );
 }

 const buildResult = await customPluginBuilder.buildCustomPlugin(templateId, {
 pluginName,
 pluginId,
 description,
 owner,
 configuration: configuration || {}
 });

 if (buildResult.success) {
 return NextResponse.json({
 success: true,
 pluginId: buildResult.pluginId,
 packageName: buildResult.packageName,
 files: buildResult.files,
 installInstructions: buildResult.installInstructions
 });
 } else {
 return NextResponse.json({
 success: false,
 error: buildResult.error
 }, { status: 400 });
 }

 case 'download':
 if (!templateId || !customization) {
 return NextResponse.json(
 { error: 'Template ID and customization data are required' },
 { status: 400 }
 );
 }

 const downloadResult = await customPluginBuilder.buildCustomPlugin(templateId, customization);
 
 if (downloadResult.success && downloadResult.files) {
 // Create a ZIP-like structure for download
 const pluginArchive = {
 name: `${downloadResult.pluginId}-plugin.zip`,
 files: downloadResult.files,
 installInstructions: downloadResult.installInstructions
 };

 return NextResponse.json({
 success: true,
 archive: pluginArchive
 });
 } else {
 return NextResponse.json({
 success: false,
 error: downloadResult.error || 'Failed to create plugin archive'
 }, { status: 400 });
 }

 case 'validate':
 const { pluginId: validateId, pluginName: validateName } = body;
 
 if (!validateId || !validateName) {
 return NextResponse.json(
 { error: 'Plugin ID and name are required for validation' },
 { status: 400 }
 );
 }

 // Validate plugin ID
 const isValidId = /^[a-z][a-z0-9-]*$/.test(validateId);
 const isValidName = validateName.trim().length > 0;

 // Check if plugin ID is already in use (this would check against existing plugins)
 const existingPlugins = ['kubernetes', 'github-actions', 'jira']; // This would come from actual plugin registry
 const isUnique = !existingPlugins.includes(validateId);

 return NextResponse.json({
 valid: isValidId && isValidName && isUnique,
 errors: [
 ...(!isValidId ? ['Plugin ID must start with a letter and contain only lowercase letters, numbers, and hyphens'] : []),
 ...(!isValidName ? ['Plugin name cannot be empty'] : []),
 ...(!isUnique ? ['Plugin ID is already in use'] : [])
 ]
 });

 default:
 return NextResponse.json(
 { error: 'Invalid action parameter' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Custom plugin builder API error:', error);
 return NextResponse.json(
 { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
 { status: 500 }
 );
 }
}