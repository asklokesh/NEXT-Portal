/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import { withAuth, withCors, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { UserRepository } from '@/lib/db/repositories/UserRepository';

const userRepository = new UserRepository();

async function profileHandler(req: AuthenticatedRequest): Promise<NextResponse> {
 try {
 if (req.method !== 'GET') {
 return NextResponse.json(
 { error: 'Method not allowed' },
 { status: 405 }
 );
 }

 const userId = req.user!.id;

 // Get detailed user information
 const user = await userRepository.findById(userId);
 
 if (!user) {
 return NextResponse.json(
 { error: 'User not found' },
 { status: 404 }
 );
 }

 // Get user statistics
 const stats = await userRepository.getUserStats(userId);

 return NextResponse.json({
 user: {
 id: user.id,
 email: user.email,
 name: user.name,
 username: user.username,
 avatar: user.avatar,
 role: user.role,
 provider: user.provider,
 isActive: user.isActive,
 lastLogin: user.lastLogin,
 createdAt: user.createdAt,
 updatedAt: user.updatedAt,
 teams: user.teamMemberships.map(membership => ({
 id: membership.team.id,
 name: membership.team.name,
 displayName: membership.team.displayName,
 role: membership.role,
 })),
 services: user.ownedServices.map(service => ({
 id: service.id,
 name: service.name,
 displayName: service.displayName,
 })),
 },
 stats,
 });
 } catch (error) {
 console.error('Profile fetch error:', error);

 return NextResponse.json(
 { error: 'Internal server error' },
 { status: 500 }
 );
 }
}

// Apply middleware
export const GET = withCors()(withAuth(profileHandler));