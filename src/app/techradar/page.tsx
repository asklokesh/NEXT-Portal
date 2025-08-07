'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TechRadar } from '@/components/techradar/TechRadar';
import { TechRadarManager } from '@/components/techradar/TechRadarManager';
import { TechRadarEntry } from '@/lib/techradar/types';
import { Radar, Settings, BarChart3 } from 'lucide-react';

export default function TechRadarPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEntryChange = (entry: TechRadarEntry) => {
    // Trigger a refresh of the radar visualization
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Radar className="h-8 w-8" />
            Tech Radar
          </h1>
          <p className="text-muted-foreground">
            Track technology adoption and evolution across your platform
          </p>
        </div>
      </div>

      <Tabs defaultValue="radar" className="w-full">
        <TabsList>
          <TabsTrigger value="radar" className="flex items-center gap-2">
            <Radar className="h-4 w-4" />
            Radar View
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Manage Entries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="radar" className="mt-6">
          <Card className="p-6">
            <CardContent className="p-0">
              <TechRadar 
                key={refreshTrigger}
                width={900}
                height={900}
                showLegend={true}
                interactive={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="mt-6">
          <TechRadarManager onEntryChange={handleEntryChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}