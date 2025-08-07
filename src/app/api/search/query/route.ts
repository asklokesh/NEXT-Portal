import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import { mockBackend } from '@/lib/mock/backend';

export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const { term, filters = {}, pageCursor = '', pageLimit = 25 } = body;
 
 console.log(`Searching for: ${term}`, { filters });
 
 // Try to search via Backstage
 try {
 const entities = await backstageClient.searchEntities(term, filters);
 
 // If no results from Backstage, fall through to local search
 if (entities.length === 0) {
 console.log('No results from Backstage, using local search');
 } else {
 const results = entities.map(entity => ({
 type: 'software-catalog',
 document: entity,
 highlight: {
 preTag: '<mark>',
 postTag: '</mark>',
 fields: {
 title: entity.metadata.title || entity.metadata.name,
 text: entity.metadata.description || '',
 },
 },
 }));
 
 return NextResponse.json({
 results,
 totalCount: results.length,
 pageCursor: '',
 });
 }
 } catch (error: any) {
 console.log('Backstage search unavailable, using local search');
 }
 
 // Fallback to local search
 const mockServices = await mockBackend.getServices();
 
 const lowerTerm = term.toLowerCase();
 const filteredServices = mockServices.filter(service => {
 const matchesSearch = !term || 
 service.name.toLowerCase().includes(lowerTerm) ||
 service.displayName.toLowerCase().includes(lowerTerm) ||
 service.description.toLowerCase().includes(lowerTerm) ||
 service.tags.some(tag => tag.toLowerCase().includes(lowerTerm));
 
 const matchesFilters = Object.entries(filters).every(([key, value]) => {
 if (key === 'kind') return value === 'Component';
 if (key === 'type') return service.type.toLowerCase() === value;
 if (key === 'lifecycle') return service.lifecycle.toLowerCase() === value;
 return true;
 });
 
 return matchesSearch && matchesFilters;
 });
 
 // Apply pagination
 const start = parseInt(pageCursor) || 0;
 const paginatedServices = filteredServices.slice(start, start + pageLimit);
 
 const results = paginatedServices.map(service => ({
 type: 'software-catalog',
 document: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: service.name,
 namespace: service.namespace || 'default',
 title: service.displayName,
 description: service.description,
 tags: service.tags,
 },
 spec: {
 type: service.type.toLowerCase(),
 lifecycle: service.lifecycle.toLowerCase(),
 owner: service.teamId || 'guest',
 },
 },
 highlight: {
 preTag: '<mark>',
 postTag: '</mark>',
 fields: {
 title: service.displayName,
 text: service.description,
 },
 },
 }));
 
 return NextResponse.json({
 results,
 totalCount: filteredServices.length,
 pageCursor: (start + pageLimit).toString(),
 });
 } catch (error) {
 console.error('Search query failed:', error);
 return NextResponse.json(
 { error: 'Search failed' },
 { status: 500 }
 );
 }
}