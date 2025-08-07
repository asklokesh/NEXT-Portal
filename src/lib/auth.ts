import { NextRequest } from 'next/server';
import { NextAuthOptions } from 'next-auth';

export interface AuthOptions {
  required?: boolean;
  roles?: string[];
}

// NextAuth configuration for compatibility
export const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      return session;
    }
  }
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export async function getServerSession(req: NextRequest): Promise<AuthUser | null> {
  // For now, return a mock user in development
  if (process.env.NODE_ENV === 'development') {
    return {
      id: 'dev-user',
      email: 'dev@example.com',
      name: 'Development User',
      roles: ['admin', 'developer']
    };
  }

  // In production, implement actual authentication
  // This could integrate with NextAuth, Auth0, or custom auth
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return null;
    }

    // Placeholder for actual token validation
    // const token = authHeader.replace('Bearer ', '');
    // const user = await validateToken(token);
    // return user;

    return null;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

export async function requireAuth(req: NextRequest, options: AuthOptions = {}): Promise<AuthUser> {
  const user = await getServerSession(req);
  
  if (!user && options.required !== false) {
    throw new Error('Authentication required');
  }

  if (options.roles && user && !options.roles.some(role => user.roles.includes(role))) {
    throw new Error('Insufficient permissions');
  }

  return user!;
}

export function createAuthMiddleware(options: AuthOptions = {}) {
  return async (req: NextRequest) => {
    try {
      await requireAuth(req, options);
      return null; // Continue to handler
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Authentication failed' }),
        { 
          status: error instanceof Error && error.message === 'Insufficient permissions' ? 403 : 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}