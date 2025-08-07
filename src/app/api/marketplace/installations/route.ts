import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

interface PluginInstallation {
  id: string;
  pluginId: string;
  pluginVersion: string;
  userId: string;
  tenantId?: string;
  status: 'installing' | 'installed' | 'failed' | 'updating' | 'uninstalling';
  config?: Record<string, any>;
  errorMessage?: string;
  installationLogs: string[];
  installedAt?: string;
  lastUpdated: string;
}

// In-memory storage for demo
const installationsDatabase = new Map<string, PluginInstallation[]>();

// GET /api/marketplace/installations - Get user's plugin installations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const pluginId = searchParams.get('pluginId');
    const tenantId = searchParams.get('tenantId');
    
    const userId = session.user.id || session.user.email!;
    let installations = installationsDatabase.get(userId) || [];

    // Apply filters
    if (status) {
      installations = installations.filter(i => i.status === status);
    }

    if (pluginId) {
      installations = installations.filter(i => i.pluginId === pluginId);
    }

    if (tenantId) {
      installations = installations.filter(i => i.tenantId === tenantId);
    }

    // Sort by last updated (most recent first)
    installations.sort((a, b) => 
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    return NextResponse.json({ installations });

  } catch (error) {
    console.error('Failed to fetch installations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installations' },
      { status: 500 }
    );
  }
}

// POST /api/marketplace/installations - Install a plugin
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pluginId, version, tenantId, config } = await request.json();

    if (!pluginId || !version) {
      return NextResponse.json(
        { error: 'Missing required fields: pluginId, version' },
        { status: 400 }
      );
    }

    const userId = session.user.id || session.user.email!;

    // Check if plugin is already being installed or installed
    const userInstalls = installationsDatabase.get(userId) || [];
    const existingInstall = userInstalls.find(i => 
      i.pluginId === pluginId && 
      (i.status === 'installing' || i.status === 'installed')
    );

    if (existingInstall) {
      return NextResponse.json(
        { error: 'Plugin is already installed or being installed' },
        { status: 409 }
      );
    }

    // Create new installation record
    const installation: PluginInstallation = {
      id: `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pluginId,
      pluginVersion: version,
      userId,
      tenantId,
      status: 'installing',
      config,
      installationLogs: ['Starting installation...'],
      lastUpdated: new Date().toISOString()
    };

    // Add to user's installations
    userInstalls.push(installation);
    installationsDatabase.set(userId, userInstalls);

    // Simulate installation process
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% success rate for demo

      if (success) {
        installation.status = 'installed';
        installation.installedAt = new Date().toISOString();
        installation.installationLogs = [
          'Starting installation...',
          'Downloading plugin package...',
          'Verifying plugin integrity...',
          'Installing dependencies...',
          'Configuring plugin settings...',
          'Registering plugin with Backstage...',
          'Installation completed successfully!'
        ];
      } else {
        installation.status = 'failed';
        installation.errorMessage = 'Failed to install dependencies. Network timeout occurred.';
        installation.installationLogs = [
          'Starting installation...',
          'Downloading plugin package...',
          'Installing dependencies...',
          'ERROR: Network timeout while downloading dependencies',
          'Installation failed'
        ];
      }
      
      installation.lastUpdated = new Date().toISOString();
    }, Math.random() * 5000 + 2000); // 2-7 seconds

    return NextResponse.json({
      message: 'Installation started',
      installation
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to start installation:', error);
    return NextResponse.json(
      { error: 'Failed to start installation' },
      { status: 500 }
    );
  }
}

// DELETE /api/marketplace/installations - Uninstall a plugin
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get('id');

    if (!installationId) {
      return NextResponse.json(
        { error: 'Installation ID required' },
        { status: 400 }
      );
    }

    const userId = session.user.id || session.user.email!;
    const userInstalls = installationsDatabase.get(userId) || [];
    const installIndex = userInstalls.findIndex(i => i.id === installationId);

    if (installIndex === -1) {
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    const installation = userInstalls[installIndex];

    if (installation.status !== 'installed') {
      return NextResponse.json(
        { error: 'Can only uninstall installed plugins' },
        { status: 400 }
      );
    }

    // Update status to uninstalling
    installation.status = 'uninstalling';
    installation.lastUpdated = new Date().toISOString();
    installation.installationLogs.push('Starting uninstallation...');

    // Simulate uninstallation process
    setTimeout(() => {
      // Remove from installations
      userInstalls.splice(installIndex, 1);
      installationsDatabase.set(userId, userInstalls);
    }, 2000);

    return NextResponse.json({
      message: 'Uninstallation started',
      installation
    });

  } catch (error) {
    console.error('Failed to uninstall plugin:', error);
    return NextResponse.json(
      { error: 'Failed to uninstall plugin' },
      { status: 500 }
    );
  }
}