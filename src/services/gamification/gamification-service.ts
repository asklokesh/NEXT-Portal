import { EventEmitter } from 'events';
import { Logger } from 'pino';

interface UserPoints {
  userId: string;
  points: number;
}

export class GamificationService extends EventEmitter {
  private userPoints: Map<string, number> = new Map();

  constructor(private logger: Logger) {
    super();
  }

  async addPoints(userId: string, points: number): Promise<void> {
    const currentPoints = this.userPoints.get(userId) || 0;
    const newPoints = currentPoints + points;
    this.userPoints.set(userId, newPoints);
    this.logger.info(`Added ${points} points to user ${userId}. Total points: ${newPoints}`);
    this.emit('pointsAdded', { userId, points: newPoints });
  }

  async getLeaderboard(): Promise<UserPoints[]> {
    return Array.from(this.userPoints.entries())
      .map(([userId, points]) => ({ userId, points }))
      .sort((a, b) => b.points - a.points);
  }
}
