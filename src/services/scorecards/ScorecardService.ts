
import { Service, Lifecycle } from '@prisma/client';

export interface ScorecardResult {
  entityRef: string;
  score: number;
  level: 'gold' | 'silver' | 'bronze' | 'failing';
  checks: {
    name: string;
    passed: boolean;
    score: number;
    description: string;
  }[];
}

export class ScorecardService {

  calculateScore(service: Service): ScorecardResult {
    const checks = [
      {
        name: 'Ownership',
        passed: !!service.ownerId && service.ownerId !== 'unknown',
        score: 25,
        description: 'Service must have a clear owner'
      },
      {
        name: 'Description',
        passed: !!service.description && service.description.length > 10,
        score: 15,
        description: 'Service must have a helpful description'
      },
      {
        name: 'Tags',
        passed: !!service.tags && service.tags.length > 0,
        score: 15,
        description: 'Service must be tagged for discoverability'
      },
      {
        name: 'Lifecycle',
        passed: service.lifecycle === Lifecycle.PRODUCTION,
        score: 25,
        description: 'Service is in Production'
      },
      {
        name: 'Type',
        passed: !!service.type,
        score: 20,
        description: 'Service type is defined'
      }
    ];

    const totalScore = checks.reduce((acc, check) => acc + (check.passed ? check.score : 0), 0);

    let level: ScorecardResult['level'] = 'failing';
    if (totalScore >= 90) level = 'gold';
    else if (totalScore >= 70) level = 'silver';
    else if (totalScore >= 50) level = 'bronze';

    return {
      entityRef: `service:${service.name}`,
      score: totalScore,
      level,
      checks
    };
  }

  getOverallHealth(): { avgScore: number, distribution: Record<string, number> } {
    // This would need to fetch all services. 
    // For now, we keep it simple or implement if needed for a widget.
    return { avgScore: 0, distribution: {} };
  }
}

export const scorecardService = new ScorecardService();
