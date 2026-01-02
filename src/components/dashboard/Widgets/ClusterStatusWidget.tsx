
import React from 'react';
import { Server, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Cluster {
    name: string;
    region: string;
    nodes: number;
    status: 'active' | 'inactive' | 'degraded';
}

interface ClusterStatusWidgetProps {
    data?: {
        clusters: Cluster[];
    };
    loading?: boolean;
}

const ClusterStatusWidget: React.FC<ClusterStatusWidgetProps> = ({ data, loading }) => {
    if (loading) return <div className="p-4 text-center">Loading clusters...</div>;

    const clusters = data?.clusters || [];

    return (
        <div className="space-y-4">
            {clusters.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                    <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No Kubernetes Clusters Connected</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {clusters.map((cluster, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${cluster.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                    <Activity className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-sm">{cluster.name}</h4>
                                    <p className="text-xs text-muted-foreground">{cluster.region} • {cluster.nodes} Nodes</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {cluster.status === 'active' ?
                                    <span className="flex items-center text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3 mr-1" /> Healthy</span> :
                                    <span className="flex items-center text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> Check</span>
                                }
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClusterStatusWidget;
