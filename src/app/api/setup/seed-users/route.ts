import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/database/simple-client';

export async function POST(request: NextRequest) {
  try {
    // Check if users already exist
    const existingUsers = await db.count('user');
    
    if (existingUsers > 0) {
      return NextResponse.json({
        success: false,
        message: 'Users already exist in the database',
        count: existingUsers
      });
    }

    // Hash password for demo users
    const defaultPassword = 'admin123';
    const hashedPassword = await hash(defaultPassword, 12);

    // Create demo users
    const users = [
      {
        email: 'admin@spotify.com',
        name: 'Admin User',
        username: 'admin',
        provider: 'local',
        providerId: 'local-admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      },
      {
        email: 'platform@spotify.com',
        name: 'Platform Engineer',
        username: 'platform',
        provider: 'local',
        providerId: 'local-platform',
        password: hashedPassword,
        role: 'PLATFORM_ENGINEER',
        isActive: true
      },
      {
        email: 'developer@spotify.com',
        name: 'Developer User',
        username: 'developer',
        provider: 'local',
        providerId: 'local-developer',
        password: hashedPassword,
        role: 'DEVELOPER',
        isActive: true
      },
      {
        email: 'viewer@spotify.com',
        name: 'Viewer User',
        username: 'viewer',
        provider: 'local',
        providerId: 'local-viewer',
        password: hashedPassword,
        role: 'VIEWER',
        isActive: true
      }
    ];

    const createdUsers = [];
    
    for (const userData of users) {
      try {
        const user = await db.create('user', {
          data: userData
        });
        createdUsers.push({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        });
      } catch (error) {
        console.error(`Failed to create user ${userData.email}:`, error);
      }
    }

    // Create a default team
    try {
      const defaultTeam = await db.create('team', {
        data: {
          name: 'platform-team',
          displayName: 'Platform Team',
          description: 'Default platform engineering team',
          isActive: true
        }
      });

      // Add admin and platform engineer to the team
      const adminUser = createdUsers.find(u => u.role === 'ADMIN');
      const platformUser = createdUsers.find(u => u.role === 'PLATFORM_ENGINEER');

      if (adminUser) {
        await db.create('teamMember', {
          data: {
            userId: adminUser.id,
            teamId: defaultTeam.id,
            role: 'LEAD'
          }
        });
      }

      if (platformUser) {
        await db.create('teamMember', {
          data: {
            userId: platformUser.id,
            teamId: defaultTeam.id,
            role: 'MEMBER'
          }
        });
      }

    } catch (teamError) {
      console.error('Failed to create default team:', teamError);
    }

    return NextResponse.json({
      success: true,
      message: 'Demo users created successfully',
      users: createdUsers,
      credentials: {
        email: 'admin@spotify.com',
        password: defaultPassword,
        note: 'Use these credentials to login'
      }
    });

  } catch (error) {
    console.error('Seed users error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create demo users',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userCount = await db.count('user');
    const users = await db.findMany('user', {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      count: userCount,
      users
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}