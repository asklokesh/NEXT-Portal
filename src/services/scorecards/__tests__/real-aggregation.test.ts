
import { ScorecardService } from '../ScorecardService';
import { tenantDb } from '../../../lib/database/TenantAwareDatabase';

// Mock tenantDb
jest.mock('../../../lib/database/TenantAwareDatabase', () => ({
    tenantDb: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        prisma: {
            scorecardResult: {
                aggregate: jest.fn(),
                groupBy: jest.fn(),
            }
        }
    }
}));

describe('ScorecardService Aggregation', () => {
    let service: ScorecardService;

    beforeEach(() => {
        service = new ScorecardService();
        jest.clearAllMocks();
    });

    it('should calculate org summary correctly', async () => {
        // Mock data
        (tenantDb.count as jest.Mock).mockResolvedValue(10);
        (tenantDb.prisma.scorecardResult.aggregate as jest.Mock).mockResolvedValue({
            _avg: {
                score: 85,
                percentage: 85
            }
        });
        (tenantDb.prisma.scorecardResult.groupBy as jest.Mock).mockResolvedValue([
            { level: 'Gold', _count: { level: 4 } },
            { level: 'Silver', _count: { level: 6 } }
        ]);

        const summary = await service.getOrgSummary(); // Should not throw

        expect(summary.totalEntities).toBe(10);
        expect(summary.averageScore).toBe(85);
        expect(summary.levelDistribution['Gold']).toBe(4);
        expect(summary.levelDistribution['Silver']).toBe(6);
        expect(tenantDb.count).toHaveBeenCalledWith('scorecardResult', { where: {} });
    });
});
