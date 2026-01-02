
import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CostData {
    totalMonthlyCost: number;
    currency: string;
    topSpenders: {
        name: string;
        cost: number;
        trend: 'up' | 'down' | 'flat';
    }[];
}

interface CostWidgetProps {
    data?: CostData;
    loading?: boolean;
}

const CostWidget: React.FC<CostWidgetProps> = ({ data, loading }) => {
    if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading cost data...</div>;
    if (!data) return <div className="p-4 text-center text-sm text-muted-foreground">No cost data available</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">Est. Monthly Cost</p>
                    <h3 className="text-2xl font-bold flex items-center">
                        {data.currency === 'USD' ? '$' : data.currency}
                        {data.totalMonthlyCost.toLocaleString()}
                    </h3>
                </div>
                <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                    <DollarSign className="w-5 h-5" />
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Spenders</p>
                {data.topSpenders.slice(0, 3).map((spender, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                        <span className="truncate max-w-[120px]" title={spender.name}>{spender.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">${spender.cost}</span>
                            {spender.trend === 'up' && <TrendingUp className="w-3 h-3 text-red-500" />}
                            {spender.trend === 'down' && <TrendingDown className="w-3 h-3 text-green-500" />}
                            {spender.trend === 'flat' && <Minus className="w-3 h-3 text-gray-400" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CostWidget;
