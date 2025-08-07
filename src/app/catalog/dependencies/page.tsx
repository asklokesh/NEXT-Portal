'use client';

import { useState, useEffect } from 'react';
import { DependencyGraph } from '@/components/catalog/DependencyGraph';
import { useBackstageApi } from '@/hooks/useBackstageApi';
import { Entity } from '@/services/backstage/types/entities';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DependenciesPage() {
 const [entities, setEntities] = useState<Entity[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const backstageApi = useBackstageApi();

 useEffect(() => {
 const fetchEntities = async () => {
 try {
 setLoading(true);
 const data = await backstageApi.getEntities();
 setEntities(data);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to fetch entities');
 } finally {
 setLoading(false);
 }
 };

 fetchEntities();
 }, [backstageApi]);

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-[600px]">
 <Loader2 className="h-8 w-8 animate-spin" />
 </div>
 );
 }

 if (error) {
 return (
 <div className="container mx-auto py-8">
 <Alert variant="destructive">
 <AlertDescription>{error}</AlertDescription>
 </Alert>
 </div>
 );
 }

 return (
 <div className="container mx-auto py-8">
 <div className="mb-6">
 <h1 className="text-3xl font-bold">Service Dependencies</h1>
 <p className="text-muted-foreground mt-2">
 Visualize and analyze dependencies between services, APIs, and resources in your catalog
 </p>
 </div>
 
 <DependencyGraph 
 entities={entities}
 onEntityClick={(entity) => {
 // Navigate to entity details
 window.location.href = `/catalog/${entity.kind.toLowerCase()}/${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
 }}
 />
 </div>
 );
}