/**
 * Skill Exchange API
 * Platform for sharing knowledge and expertise across teams
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const action = searchParams.get('action');
    
    switch (action) {
      case 'skills':
        const category = searchParams.get('category');
        const skills = await getSkills(category);
        return NextResponse.json({ skills });

      case 'experts':
        const skill = searchParams.get('skill');
        const experts = await getExperts(skill);
        return NextResponse.json({ experts });

      case 'sessions':
        const userId = searchParams.get('userId');
        const sessions = await getSessions(userId);
        return NextResponse.json({ sessions });

      case 'requests':
        const status = searchParams.get('status');
        const requests = await getSkillRequests(status);
        return NextResponse.json({ requests });

      case 'leaderboard':
        const timeframe = searchParams.get('timeframe') || 'month';
        const leaderboard = await getLeaderboard(timeframe);
        return NextResponse.json({ leaderboard });

      case 'recommendations':
        const userIdForRec = searchParams.get('userId');
        const recommendations = await getPersonalizedRecommendations(userIdForRec);
        return NextResponse.json({ recommendations });

      case 'analytics':
        const analytics = await getSkillAnalytics();
        return NextResponse.json({ analytics });

      default:
        return NextResponse.json({ 
          status: 'Skill Exchange Platform Ready',
          features: [
            'Skill discovery and matching',
            'Expert recommendations',
            'Knowledge sharing sessions',
            'Skill gap analysis',
            'Learning path generation',
            'Community leaderboards'
          ]
        });
    }
  } catch (error) {
    console.error('Skill Exchange API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'create-skill-request':
        const { skillName, description, urgency, requester } = body;
        if (!skillName || !requester) {
          return NextResponse.json(
            { error: 'Skill name and requester are required' },
            { status: 400 }
          );
        }

        const request = await createSkillRequest({
          skillName,
          description,
          urgency: urgency || 'medium',
          requester
        });
        return NextResponse.json({ 
          success: true, 
          request 
        });

      case 'offer-help':
        const { requestId, expertId, message } = body;
        if (!requestId || !expertId) {
          return NextResponse.json(
            { error: 'Request ID and expert ID are required' },
            { status: 400 }
          );
        }

        const offer = await offerHelp(requestId, expertId, message);
        return NextResponse.json({ 
          success: true, 
          offer 
        });

      case 'schedule-session':
        const { expertId: sessionExpertId, learnerId, skillId, proposedTime, duration } = body;
        if (!sessionExpertId || !learnerId || !skillId) {
          return NextResponse.json(
            { error: 'Expert ID, learner ID, and skill ID are required' },
            { status: 400 }
          );
        }

        const session = await scheduleSession({
          expertId: sessionExpertId,
          learnerId,
          skillId,
          proposedTime,
          duration: duration || 60
        });
        return NextResponse.json({ 
          success: true, 
          session 
        });

      case 'rate-session':
        const { sessionId, rating, feedback, userId: ratingUserId } = body;
        if (!sessionId || !rating || !ratingUserId) {
          return NextResponse.json(
            { error: 'Session ID, rating, and user ID are required' },
            { status: 400 }
          );
        }

        const sessionRating = await rateSession(sessionId, rating, feedback, ratingUserId);
        return NextResponse.json({ 
          success: true, 
          rating: sessionRating 
        });

      case 'update-skills':
        const { userId: skillsUserId, skills } = body;
        if (!skillsUserId || !skills) {
          return NextResponse.json(
            { error: 'User ID and skills are required' },
            { status: 400 }
          );
        }

        const updatedProfile = await updateUserSkills(skillsUserId, skills);
        return NextResponse.json({ 
          success: true, 
          profile: updatedProfile 
        });

      case 'create-learning-path':
        const { targetSkill, currentLevel, goalLevel, timeline } = body;
        if (!targetSkill || !currentLevel || !goalLevel) {
          return NextResponse.json(
            { error: 'Target skill, current level, and goal level are required' },
            { status: 400 }
          );
        }

        const learningPath = await createLearningPath({
          targetSkill,
          currentLevel,
          goalLevel,
          timeline: timeline || '3months'
        });
        return NextResponse.json({ 
          success: true, 
          learningPath 
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Skill Exchange API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Helper functions for skill exchange operations
 */

async function getSkills(category?: string) {
  const allSkills = [
    {
      id: 'skill-1',
      name: 'Kubernetes',
      category: 'DevOps',
      description: 'Container orchestration platform',
      expertCount: 23,
      demandLevel: 'high',
      avgRating: 4.7
    },
    {
      id: 'skill-2',
      name: 'React',
      category: 'Frontend',
      description: 'JavaScript library for building user interfaces',
      expertCount: 45,
      demandLevel: 'very_high',
      avgRating: 4.8
    },
    {
      id: 'skill-3',
      name: 'PostgreSQL',
      category: 'Database',
      description: 'Advanced open source relational database',
      expertCount: 18,
      demandLevel: 'medium',
      avgRating: 4.5
    },
    {
      id: 'skill-4',
      name: 'TypeScript',
      category: 'Programming',
      description: 'Typed superset of JavaScript',
      expertCount: 38,
      demandLevel: 'high',
      avgRating: 4.6
    },
    {
      id: 'skill-5',
      name: 'System Design',
      category: 'Architecture',
      description: 'Design scalable distributed systems',
      expertCount: 12,
      demandLevel: 'very_high',
      avgRating: 4.9
    }
  ];

  return category ? 
    allSkills.filter(skill => skill.category.toLowerCase() === category.toLowerCase()) :
    allSkills;
}

async function getExperts(skill?: string) {
  const experts = [
    {
      id: 'expert-1',
      name: 'Alice Johnson',
      title: 'Senior Platform Engineer',
      team: 'Infrastructure',
      skills: ['Kubernetes', 'Docker', 'Terraform'],
      rating: 4.9,
      sessionsCompleted: 47,
      availability: 'available',
      timeZone: 'UTC-8',
      expertise: {
        'Kubernetes': { level: 'expert', experience: '5+ years' },
        'Docker': { level: 'expert', experience: '4+ years' },
        'Terraform': { level: 'advanced', experience: '3+ years' }
      }
    },
    {
      id: 'expert-2',
      name: 'Bob Chen',
      title: 'Full Stack Developer',
      team: 'Product Engineering',
      skills: ['React', 'TypeScript', 'Node.js'],
      rating: 4.8,
      sessionsCompleted: 32,
      availability: 'busy',
      timeZone: 'UTC+8',
      expertise: {
        'React': { level: 'expert', experience: '6+ years' },
        'TypeScript': { level: 'expert', experience: '4+ years' },
        'Node.js': { level: 'advanced', experience: '5+ years' }
      }
    },
    {
      id: 'expert-3',
      name: 'Carol Davis',
      title: 'Principal Architect',
      team: 'Architecture',
      skills: ['System Design', 'Microservices', 'Event Streaming'],
      rating: 5.0,
      sessionsCompleted: 28,
      availability: 'limited',
      timeZone: 'UTC+1',
      expertise: {
        'System Design': { level: 'expert', experience: '10+ years' },
        'Microservices': { level: 'expert', experience: '7+ years' },
        'Event Streaming': { level: 'advanced', experience: '4+ years' }
      }
    }
  ];

  return skill ? 
    experts.filter(expert => 
      expert.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    ) : experts;
}

async function getSessions(userId?: string) {
  const sessions = [
    {
      id: 'session-1',
      skillName: 'Kubernetes Deployment Strategies',
      expertId: 'expert-1',
      expertName: 'Alice Johnson',
      learnerId: 'learner-1',
      learnerName: 'Dave Wilson',
      scheduledTime: new Date(Date.now() + 86400000).toISOString(),
      duration: 60,
      status: 'scheduled',
      sessionType: 'one-on-one',
      meetingLink: 'https://meet.spotify.com/room/abc123'
    },
    {
      id: 'session-2',
      skillName: 'React Best Practices',
      expertId: 'expert-2',
      expertName: 'Bob Chen',
      learnerId: 'learner-2',
      learnerName: 'Eve Martin',
      scheduledTime: new Date(Date.now() - 3600000).toISOString(),
      duration: 45,
      status: 'completed',
      sessionType: 'one-on-one',
      rating: 5,
      feedback: 'Excellent session! Very practical examples.'
    }
  ];

  return userId ? 
    sessions.filter(s => s.expertId === userId || s.learnerId === userId) :
    sessions;
}

async function getSkillRequests(status?: string) {
  const requests = [
    {
      id: 'request-1',
      skillName: 'Advanced PostgreSQL Optimization',
      description: 'Need help with query optimization and indexing strategies',
      requester: {
        id: 'user-1',
        name: 'Frank Miller',
        team: 'Backend Engineering'
      },
      urgency: 'high',
      status: 'open',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      offers: 2
    },
    {
      id: 'request-2',
      skillName: 'Microservices Testing Patterns',
      description: 'Looking for guidance on testing strategies for microservices',
      requester: {
        id: 'user-2',
        name: 'Grace Lee',
        team: 'Quality Engineering'
      },
      urgency: 'medium',
      status: 'matched',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      offers: 1,
      matchedExpert: {
        id: 'expert-3',
        name: 'Carol Davis'
      }
    }
  ];

  return status ? 
    requests.filter(r => r.status === status) :
    requests;
}

async function getLeaderboard(timeframe: string) {
  const leaders = [
    {
      rank: 1,
      userId: 'expert-1',
      name: 'Alice Johnson',
      points: 1247,
      sessionsCompleted: 47,
      skillsShared: 8,
      avgRating: 4.9,
      achievements: ['Top Mentor', 'Knowledge Sharer', 'Kubernetes Expert']
    },
    {
      rank: 2,
      userId: 'expert-3',
      name: 'Carol Davis',
      points: 1156,
      sessionsCompleted: 28,
      skillsShared: 12,
      avgRating: 5.0,
      achievements: ['Perfect Rating', 'Architect Badge', 'System Design Master']
    },
    {
      rank: 3,
      userId: 'expert-2',
      name: 'Bob Chen',
      points: 892,
      sessionsCompleted: 32,
      skillsShared: 6,
      avgRating: 4.8,
      achievements: ['Frontend Expert', 'React Master', 'TypeScript Pro']
    }
  ];

  return {
    timeframe,
    leaders,
    updatedAt: new Date().toISOString()
  };
}

async function getPersonalizedRecommendations(userId?: string) {
  return {
    skillsToLearn: [
      {
        skill: 'GraphQL',
        reason: 'High demand in your team and matches your backend experience',
        priority: 'high',
        estimatedTime: '2-3 weeks',
        experts: ['expert-2']
      },
      {
        skill: 'AWS Lambda',
        reason: 'Complements your existing cloud knowledge',
        priority: 'medium',
        estimatedTime: '1-2 weeks',
        experts: ['expert-1']
      }
    ],
    skillsToTeach: [
      {
        skill: 'Node.js',
        reason: 'You have strong expertise and there are 3 pending requests',
        demand: 'high',
        potentialLearners: 3
      }
    ],
    suggestedSessions: [
      {
        sessionId: 'suggested-1',
        title: 'Docker Best Practices Workshop',
        expertName: 'Alice Johnson',
        date: new Date(Date.now() + 172800000).toISOString(),
        type: 'group'
      }
    ]
  };
}

async function getSkillAnalytics() {
  return {
    overview: {
      totalSkills: 247,
      totalExperts: 89,
      activeSessions: 12,
      completedSessions: 324,
      avgSessionRating: 4.7
    },
    trends: {
      mostRequestedSkills: [
        { skill: 'Kubernetes', requests: 23 },
        { skill: 'React', requests: 19 },
        { skill: 'System Design', requests: 17 }
      ],
      growingSkills: [
        { skill: 'GraphQL', growth: '+45%' },
        { skill: 'Rust', growth: '+38%' },
        { skill: 'WebAssembly', growth: '+25%' }
      ],
      topPerformers: [
        { expertId: 'expert-3', metric: 'Perfect 5.0 rating' },
        { expertId: 'expert-1', metric: 'Most sessions: 47' },
        { expertId: 'expert-2', metric: 'Fastest response time' }
      ]
    },
    engagement: {
      dailyActiveSessions: 8.4,
      weeklyNewRequests: 15.2,
      monthlyCompletions: 89,
      satisfactionScore: 96
    }
  };
}

// Implementation functions
async function createSkillRequest(data: any) {
  const request = {
    id: `request-${Date.now()}`,
    ...data,
    status: 'open',
    createdAt: new Date().toISOString(),
    offers: 0
  };
  return request;
}

async function offerHelp(requestId: string, expertId: string, message?: string) {
  return {
    id: `offer-${Date.now()}`,
    requestId,
    expertId,
    message: message || 'I can help with this!',
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
}

async function scheduleSession(data: any) {
  return {
    id: `session-${Date.now()}`,
    ...data,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    meetingLink: `https://meet.spotify.com/room/${Math.random().toString(36).substr(2, 9)}`
  };
}

async function rateSession(sessionId: string, rating: number, feedback?: string, userId?: string) {
  return {
    sessionId,
    rating,
    feedback,
    ratedBy: userId,
    ratedAt: new Date().toISOString()
  };
}

async function updateUserSkills(userId: string, skills: any[]) {
  return {
    userId,
    skills,
    updatedAt: new Date().toISOString()
  };
}

async function createLearningPath(data: any) {
  const steps = [
    {
      step: 1,
      title: `Fundamentals of ${data.targetSkill}`,
      estimatedTime: '1-2 weeks',
      resources: ['Documentation', 'Tutorial videos', 'Practice exercises']
    },
    {
      step: 2,
      title: `Intermediate ${data.targetSkill} Concepts`,
      estimatedTime: '2-3 weeks',
      resources: ['Advanced tutorials', 'Real-world projects', 'Mentor sessions']
    },
    {
      step: 3,
      title: `Advanced ${data.targetSkill} Mastery`,
      estimatedTime: '3-4 weeks',
      resources: ['Expert workshops', 'Complex projects', 'Knowledge sharing']
    }
  ];

  return {
    id: `path-${Date.now()}`,
    ...data,
    steps,
    totalEstimatedTime: data.timeline,
    createdAt: new Date().toISOString(),
    progress: 0
  };
}