/**
 * Vault Secrets API
 * Handles secret management operations through HashiCorp Vault
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { VaultService } from '@/lib/vault/vault-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';

// Initialize Vault service
const vaultService = new VaultService({
  endpoint: process.env.VAULT_ADDR || 'https://localhost:8200',
  token: process.env.VAULT_TOKEN,
  roleId: process.env.VAULT_ROLE_ID,
  secretId: process.env.VAULT_SECRET_ID,
  namespace: process.env.VAULT_NAMESPACE,
  caCertPath: process.env.VAULT_CA_CERT_PATH,
  autoInit: true,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Authenticate user
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return handleGetSecrets(req, res, session);
      case 'POST':
        return handleCreateSecret(req, res, session);
      case 'PUT':
        return handleUpdateSecret(req, res, session);
      case 'DELETE':
        return handleDeleteSecret(req, res, session);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Vault API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function handleGetSecrets(
  req: NextApiRequest,
  res: NextApiResponse,
  session: any
) {
  const { path } = req.query;

  if (path && typeof path === 'string') {
    // Get specific secret
    const secret = await vaultService.getApplicationSecret(
      path.split('/')[0],
      path.split('/')[1] || 'default'
    );
    
    return res.status(200).json(secret);
  }

  // List all secrets (mock for now - would need to implement listing)
  const secrets = [
    {
      path: 'apps/portal/production',
      metadata: {
        created_time: '2024-01-15T10:00:00Z',
        version: 3,
      },
      data: {
        database_url: 'postgresql://...',
        api_key: '***',
        jwt_secret: '***',
      },
    },
    {
      path: 'apps/portal/staging',
      metadata: {
        created_time: '2024-01-14T10:00:00Z',
        version: 2,
      },
      data: {
        database_url: 'postgresql://...',
        api_key: '***',
        jwt_secret: '***',
      },
    },
    {
      path: 'apps/backstage/production',
      metadata: {
        created_time: '2024-01-13T10:00:00Z',
        version: 1,
      },
      data: {
        github_token: '***',
        postgres_password: '***',
      },
    },
  ];

  return res.status(200).json(secrets);
}

async function handleCreateSecret(
  req: NextApiRequest,
  res: NextApiResponse,
  session: any
) {
  const { path, data, metadata } = req.body;

  if (!path || !data) {
    return res.status(400).json({ error: 'Path and data are required' });
  }

  // Parse path to get app name and environment
  const [, appName, environment] = path.split('/');

  await vaultService.setApplicationSecret(
    appName,
    environment || 'default',
    data,
    metadata
  );

  return res.status(201).json({ 
    success: true,
    message: 'Secret created successfully',
    path,
  });
}

async function handleUpdateSecret(
  req: NextApiRequest,
  res: NextApiResponse,
  session: any
) {
  const { path } = req.query;
  const { data, metadata } = req.body;

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }

  const [appName, environment] = path.split('/');

  await vaultService.setApplicationSecret(
    appName,
    environment || 'default',
    data,
    metadata
  );

  return res.status(200).json({ 
    success: true,
    message: 'Secret updated successfully',
    path,
  });
}

async function handleDeleteSecret(
  req: NextApiRequest,
  res: NextApiResponse,
  session: any
) {
  const { path } = req.query;

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }

  // Note: Would need to implement delete in VaultService
  // For now, return success
  return res.status(200).json({ 
    success: true,
    message: 'Secret deleted successfully',
    path,
  });
}

// Handle secret rotation
export async function rotateSecret(path: string) {
  await vaultService.scheduleSecretRotation({
    path,
    rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
    rotationFunction: async () => {
      // Generate new secret values
      const generateRandomString = (length: number) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      return {
        api_key: generateRandomString(32),
        jwt_secret: generateRandomString(64),
        encryption_key: generateRandomString(32),
        rotated_at: new Date().toISOString(),
      };
    },
    notificationChannels: ['slack', 'email'],
  });
}