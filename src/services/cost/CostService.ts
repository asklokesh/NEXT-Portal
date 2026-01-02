
import { Service } from '@prisma/client';

export interface DailyCost {
    date: string;
    cost: number;
}

export interface ServiceCost {
    entityRef: string;
    totalMonthlyCost: number;
    dailyParam: DailyCost[];
    trend: 'up' | 'down' | 'flat';
}

class CostService {

    generateMockCost(serviceName: string): ServiceCost {
        const today = new Date();
        const dailyParam: DailyCost[] = [];
        let totalMonthlyCost = 0;

        // Generate 30 days of data
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);

            // Random daily cost between $5 and $50
            const cost = Math.floor(Math.random() * 45) + 5;
            totalMonthlyCost += cost;

            dailyParam.push({
                date: d.toISOString().split('T')[0], // YYYY-MM-DD
                cost
            });
        }

        // Determine trend based on last 7 days vs previous 7
        const last7 = dailyParam.slice(-7).reduce((a, b) => a + b.cost, 0);
        const prev7 = dailyParam.slice(-14, -7).reduce((a, b) => a + b.cost, 0);
        const trend = last7 > prev7 * 1.1 ? 'up' : (last7 < prev7 * 0.9 ? 'down' : 'flat');

        return {
            entityRef: `service:${serviceName}`,
            totalMonthlyCost,
            dailyParam,
            trend
        };
    }

    async getCostsForServices(services: { name: string }[]): Promise<ServiceCost[]> {
        return services.map(s => this.generateMockCost(s.name));
    }
}

export const costService = new CostService();
