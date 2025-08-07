import React, { useEffect, useState } from 'react';
import { GamificationService } from '@/services/gamification/gamification-service';

const gamificationService = new GamificationService();

export const Rewards: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    gamificationService.getLeaderboard().then(setLeaderboard);
  }, []);

  return (
    <div>
      <h1>Leaderboard</h1>
      <ol>
        {leaderboard.map((user) => (
          <li key={user.userId}>
            {user.userId}: {user.points} points
          </li>
        ))}
      </ol>
    </div>
  );
};
