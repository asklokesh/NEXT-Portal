'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { 
 ArrowLeft, 
 Copy, 
 Search, 
 Filter,
 ChevronDown,
 CheckCircle2,
 Loader2,
 Edit3,
 GitBranch
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, Suspense } from 'react';
import { toast } from 'react-hot-toast';

import { backstageClient } from '@/lib/backstage/client';

import type { ServiceFormData } from '../page';
import type { Entity } from '@/lib/backstage/client';


interface ServiceDuplicationOptions {
 newName: string;
 namePrefix?: string;
 nameSuffix?: string;
 updateOwner?: string;
 updateSystem?: string;
 updateLifecycle?: 'experimental' | 'production' | 'deprecated';
 addTags?: string[];
 removeTags?: string[];
 updateDescription?: string;
 clearDependencies: boolean;
 copyRepository: boolean;
 copyInfrastructure: boolean;
 copyMonitoring: boolean;
}

const DuplicateServicePage = () => {
 const router = useRouter();
 const searchParams = useSearchParams();
 const sourceServiceRef = searchParams.get('source');
 
 const [services, setServices] = useState<Entity[]>([]);
 const [filteredServices, setFilteredServices] = useState<Entity[]>([]);
 const [selectedService, setSelectedService] = useState<Entity | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [isLoading, setIsLoading] = useState(true);
 const [isDuplicating, setIsDuplicating] = useState(false);
 const [showFilters, setShowFilters] = useState(false);
 const [typeFilter, setTypeFilter] = useState<string>('');
 const [ownerFilter, setOwnerFilter] = useState<string>('');
 const [lifecycleFilter, setLifecycleFilter] = useState<string>('');
 
 const [duplicationOptions, setDuplicationOptions] = useState<ServiceDuplicationOptions>({
 newName: '',
 namePrefix: '',
 nameSuffix: '-copy',
 updateOwner: '',
 updateSystem: '',
 clearDependencies: false,
 copyRepository: false,
 copyInfrastructure: true,
 copyMonitoring: true,
 });

 // Load services
 useEffect(() => {
 void loadServices();
 }, []);

 // Load specific service if provided in URL
 useEffect(() => {
 if (sourceServiceRef && services.length > 0) {
 const service = services.find(s => 
 `${s.kind}:${s.metadata.namespace}/${s.metadata.name}` === sourceServiceRef ||
 s.metadata.name === sourceServiceRef
 );
 if (service) {
 setSelectedService(service);
 setDuplicationOptions(prev => ({
 ...prev,
 newName: `${service.metadata.name}${prev.nameSuffix}`,
 }));
 }
 }
 }, [sourceServiceRef, services]);

 // Filter services
 useEffect(() => {
 let filtered = services;

 if (searchTerm) {
 const term = searchTerm.toLowerCase();
 filtered = filtered.filter(service =>
 service.metadata.name.toLowerCase().includes(term) ||
 service.metadata.title?.toLowerCase().includes(term) ||
 service.metadata.description?.toLowerCase().includes(term) ||
 service.metadata.tags?.some(tag => tag.toLowerCase().includes(term))
 );
 }

 if (typeFilter) {
 filtered = filtered.filter(service => (service.spec as any)?.type === typeFilter);
 }

 if (ownerFilter) {
 filtered = filtered.filter(service => (service.spec as any)?.owner === ownerFilter);
 }

 if (lifecycleFilter) {
 filtered = filtered.filter(service => (service.spec as any)?.lifecycle === lifecycleFilter);
 }

 setFilteredServices(filtered);
 }, [services, searchTerm, typeFilter, ownerFilter, lifecycleFilter]);

 const loadServices = async () => {
 try {
 setIsLoading(true);
 const allServices = await backstageClient.getCatalogEntities({
 kind: 'Component',
 });
 setServices(allServices);
 setFilteredServices(allServices);
 } catch (error) {
 // console.error('Failed to load services:', error);
 toast.error('Failed to load services');
 } finally {
 setIsLoading(false);
 }
 };

 const selectService = (service: Entity) => {
 setSelectedService(service);
 setDuplicationOptions(prev => ({
 ...prev,
 newName: prev.namePrefix + service.metadata.name + prev.nameSuffix,
 }));
 };

 const updateNamingPattern = (field: keyof Pick<ServiceDuplicationOptions, 'namePrefix' | 'nameSuffix'>, value: string) => {
 const newOptions = { ...duplicationOptions, [field]: value };
 
 if (selectedService) {
 newOptions.newName = newOptions.namePrefix + selectedService.metadata.name + newOptions.nameSuffix;
 }
 
 setDuplicationOptions(newOptions);
 };

 const duplicateService = async () => {
 if (!selectedService || !duplicationOptions.newName) {
 toast.error('Please select a service and provide a new name');
 return;
 }

 setIsDuplicating(true);
 try {
 // Convert entity to form data
 const spec = selectedService.spec as any;
 const formData: ServiceFormData = {
 name: duplicationOptions.newName,
 title: duplicationOptions.updateDescription || 
 selectedService.metadata.title || 
 selectedService.metadata.name,
 description: duplicationOptions.updateDescription ||
 selectedService.metadata.description ||
 `Duplicated from ${selectedService.metadata.name}`,
 owner: duplicationOptions.updateOwner || spec.owner || '',
 type: spec.type || 'service',
 lifecycle: duplicationOptions.updateLifecycle || spec.lifecycle || 'experimental',
 system: duplicationOptions.updateSystem || spec.system,
 tags: [
 ...(selectedService.metadata.tags || []),
 ...(duplicationOptions.addTags || [])
 ].filter(tag => !(duplicationOptions.removeTags || []).includes(tag)),
 providesApis: spec.providesApis || [],
 consumesApis: spec.consumesApis || [],
 dependsOn: duplicationOptions.clearDependencies ? [] : (spec.dependsOn || []),
 repository: {
 url: duplicationOptions.copyRepository 
 ? selectedService.metadata.annotations?.['backstage.io/managed-by-location'] || ''
 : '',
 visibility: 'private',
 },
 infrastructure: duplicationOptions.copyInfrastructure ? {
 kubernetes: true,
 database: spec.infrastructure?.database ?? false,
 cache: spec.infrastructure?.cache ?? false,
 messaging: spec.infrastructure?.messaging ?? false,
 } : {
 kubernetes: true,
 database: false,
 cache: false,
 messaging: false,
 },
 monitoring: duplicationOptions.copyMonitoring ? {
 prometheus: true,
 logging: true,
 tracing: spec.monitoring?.tracing ?? false,
 alerts: true,
 } : {
 prometheus: true,
 logging: true,
 tracing: false,
 alerts: true,
 },
 };

 // Create new entity
 const newEntity: Entity = {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: formData.name,
 title: formData.title,
 description: formData.description,
 tags: formData.tags,
 annotations: {
 'backstage.io/managed-by-location': formData.repository.url || `url:https://github.com/company/${formData.name}`,
 'github.com/project-slug': `company/${formData.name}`,
 'backstage.io/source-entity': `${selectedService.kind}:${selectedService.metadata.namespace}/${selectedService.metadata.name}`,
 },
 },
 spec: {
 type: formData.type,
 lifecycle: formData.lifecycle,
 owner: formData.owner,
 system: formData.system,
 providesApis: formData.providesApis,
 consumesApis: formData.consumesApis,
 dependsOn: formData.dependsOn,
 },
 };

 await backstageClient.createEntity(newEntity);
 toast.success('Service duplicated successfully!');
 
 // Navigate to the new service or back to catalog
 setTimeout(() => {
 router.push(`/catalog/default/Component/${formData.name}`);
 }, 1500);

 } catch (error) {
 // console.error('Failed to duplicate service:', error);
 toast.error('Failed to duplicate service. Please try again.');
 } finally {
 setIsDuplicating(false);
 }
 };

 const openInEditor = () => {
 if (!selectedService) return;
 
 // Convert to query parameters for the main create page
 const spec = selectedService.spec as any;
 const params = new URLSearchParams({
 duplicate: 'true',
 source: selectedService.metadata.name,
 name: duplicationOptions.newName,
 title: selectedService.metadata.title || selectedService.metadata.name,
 description: selectedService.metadata.description || '',
 owner: duplicationOptions.updateOwner || spec.owner || '',
 type: spec.type || 'service',
 lifecycle: duplicationOptions.updateLifecycle || spec.lifecycle || 'experimental',
 system: duplicationOptions.updateSystem || spec.system || '',
 tags: (selectedService.metadata.tags || []).join(','),
 });

 router.push(`/create?${params.toString()}`);
 };

 // Get unique values for filters
 const getUniqueValues = (field: string) => {
 const values = new Set<string>();
 services.forEach(service => {
 const value = field === 'tags' 
 ? service.metadata.tags?.join(', ')
 : (service.spec as any)?.[field] || service.metadata[field];
 if (value) values.add(String(value));
 });
 return Array.from(values).sort();
 };

 return (
 <div className="max-w-6xl mx-auto">
 {/* Header */}
 <div className="mb-8">
 <button
 onClick={() => router.push('/create')}
 className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
 >
 <ArrowLeft className="w-4 h-4 mr-1" />
 Back to Service Creator
 </button>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Duplicate Service
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Create a new service based on an existing one
 </p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 {/* Service Selection */}
 <div className="space-y-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Select Service to Duplicate
 </h2>
 </div>

 <div className="p-4">
 {/* Search and Filters */}
 <div className="space-y-3 mb-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search services..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <button
 onClick={() => setShowFilters(!showFilters)}
 className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
 >
 <Filter className="w-4 h-4 mr-1" />
 Filters
 <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
 </button>

 {showFilters && (
 <div className="grid grid-cols-3 gap-2">
 <select
 value={typeFilter}
 onChange={(e) => setTypeFilter(e.target.value)}
 className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Types</option>
 {getUniqueValues('type').map(type => (
 <option key={type} value={type}>{type}</option>
 ))}
 </select>

 <select
 value={ownerFilter}
 onChange={(e) => setOwnerFilter(e.target.value)}
 className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Owners</option>
 {getUniqueValues('owner').map(owner => (
 <option key={owner} value={owner}>{owner}</option>
 ))}
 </select>

 <select
 value={lifecycleFilter}
 onChange={(e) => setLifecycleFilter(e.target.value)}
 className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Stages</option>
 {getUniqueValues('lifecycle').map(lifecycle => (
 <option key={lifecycle} value={lifecycle}>{lifecycle}</option>
 ))}
 </select>
 </div>
 )}
 </div>

 {/* Services List */}
 {isLoading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
 </div>
 ) : (
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {filteredServices.map(service => {
 const spec = service.spec as any;
 const isSelected = selectedService?.metadata.name === service.metadata.name;
 
 return (
 <div
 key={service.metadata.name}
 onClick={() => selectService(service)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectService(service);
 }
 }}
 role="button"
 tabIndex={0}
 className={`p-3 rounded-lg border cursor-pointer transition-colors ${
 isSelected
 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
 : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
 }`}
 >
 <div className="flex items-center justify-between">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {service.metadata.title || service.metadata.name}
 </span>
 <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
 {spec.type}
 </span>
 <span className={`text-xs px-2 py-0.5 rounded-full ${
 spec.lifecycle === 'production' 
 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
 : spec.lifecycle === 'experimental'
 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
 : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
 }`}>
 {spec.lifecycle}
 </span>
 </div>
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
 {service.metadata.description}
 </p>
 <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
 <span>Owner: {spec.owner}</span>
 {service.metadata.tags && (
 <span>• Tags: {service.metadata.tags.slice(0, 3).join(', ')}</span>
 )}
 </div>
 </div>
 {isSelected && (
 <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 )}
 </div>
 </div>
 );
 })}

 {filteredServices.length === 0 && (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 No services found matching your criteria
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Duplication Configuration */}
 <div className="space-y-6">
 {selectedService ? (
 <>
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Duplication Settings
 </h2>
 </div>

 <div className="p-4 space-y-4">
 {/* Naming Pattern */}
 <div>
 <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Naming Pattern
 </div>
 <div className="grid grid-cols-3 gap-2">
 <input
 type="text"
 placeholder="Prefix"
 value={duplicationOptions.namePrefix}
 onChange={(e) => updateNamingPattern('namePrefix', e.target.value)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 />
 <input
 type="text"
 value={selectedService.metadata.name}
 disabled
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 text-sm"
 />
 <input
 type="text"
 placeholder="Suffix"
 value={duplicationOptions.nameSuffix}
 onChange={(e) => updateNamingPattern('nameSuffix', e.target.value)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 />
 </div>
 <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
 <span className="text-gray-600 dark:text-gray-400">New name: </span>
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {duplicationOptions.newName}
 </span>
 </div>
 </div>

 {/* Override Options */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label htmlFor="override-owner" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Override Owner
 </label>
 <input
 id="override-owner"
 type="text"
 value={duplicationOptions.updateOwner}
 onChange={(e) => setDuplicationOptions(prev => ({ ...prev, updateOwner: e.target.value }))}
 placeholder="Leave empty to keep original"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 />
 </div>

 <div>
 <label htmlFor="override-lifecycle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Override Lifecycle
 </label>
 <select
 id="override-lifecycle"
 value={duplicationOptions.updateLifecycle || ''}
 onChange={(e) => setDuplicationOptions(prev => ({ 
 ...prev, 
 updateLifecycle: e.target.value as any || undefined 
 }))}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 >
 <option value="">Keep original</option>
 <option value="experimental">Experimental</option>
 <option value="production">Production</option>
 <option value="deprecated">Deprecated</option>
 </select>
 </div>
 </div>

 {/* Copy Options */}
 <div>
 <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Copy Options
 </div>
 <div className="space-y-2">
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={duplicationOptions.clearDependencies}
 onChange={(e) => setDuplicationOptions(prev => ({ 
 ...prev, 
 clearDependencies: e.target.checked 
 }))}
 className="rounded border-input mr-2"
 />
 <span className="text-sm">Clear dependencies</span>
 </label>

 <label className="flex items-center">
 <input
 type="checkbox"
 checked={duplicationOptions.copyRepository}
 onChange={(e) => setDuplicationOptions(prev => ({ 
 ...prev, 
 copyRepository: e.target.checked 
 }))}
 className="rounded border-input mr-2"
 />
 <span className="text-sm">Copy repository settings</span>
 </label>

 <label className="flex items-center">
 <input
 type="checkbox"
 checked={duplicationOptions.copyInfrastructure}
 onChange={(e) => setDuplicationOptions(prev => ({ 
 ...prev, 
 copyInfrastructure: e.target.checked 
 }))}
 className="rounded border-input mr-2"
 />
 <span className="text-sm">Copy infrastructure settings</span>
 </label>

 <label className="flex items-center">
 <input
 type="checkbox"
 checked={duplicationOptions.copyMonitoring}
 onChange={(e) => setDuplicationOptions(prev => ({ 
 ...prev, 
 copyMonitoring: e.target.checked 
 }))}
 className="rounded border-input mr-2"
 />
 <span className="text-sm">Copy monitoring settings</span>
 </label>
 </div>
 </div>

 {/* Actions */}
 <div className="flex gap-3 pt-4">
 <button
 onClick={duplicateService}
 disabled={!duplicationOptions.newName || isDuplicating}
 className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isDuplicating ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Duplicating...
 </>
 ) : (
 <>
 <Copy className="w-4 h-4 mr-2" />
 Duplicate Service
 </>
 )}
 </button>

 <button
 onClick={openInEditor}
 className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <Edit3 className="w-4 h-4 mr-2" />
 Edit in Builder
 </button>
 </div>
 </div>
 </div>

 {/* Preview */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Preview
 </h3>
 </div>
 <div className="p-4">
 <div className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-gray-600 dark:text-gray-400">Name:</span>
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {duplicationOptions.newName}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-600 dark:text-gray-400">Owner:</span>
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {duplicationOptions.updateOwner || (selectedService.spec as any)?.owner}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-600 dark:text-gray-400">Lifecycle:</span>
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {duplicationOptions.updateLifecycle || (selectedService.spec as any)?.lifecycle}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-600 dark:text-gray-400">Dependencies:</span>
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {duplicationOptions.clearDependencies ? 'None' : 'Copied from original'}
 </span>
 </div>
 </div>
 </div>
 </div>
 </>
 ) : (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
 <div className="text-center">
 <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Select a Service
 </h3>
 <p className="text-gray-600 dark:text-gray-400">
 Choose a service from the list to configure duplication settings
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

function DuplicateServicePageWithSuspense() {
 return (
 <Suspense fallback={<div className="flex items-center justify-center h-screen">
 <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
 </div>}>
 <DuplicateServicePage />
 </Suspense>
 );
}

export default DuplicateServicePageWithSuspense;