'use client';

import { motion } from 'framer-motion';
import {
  Github,
  GitBranch,
  GitPullRequest,
  Users,
  FolderGit2,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface GitHubConnection {
  connected: boolean;
  username?: string;
  avatar?: string;
  organization?: string;
  lastSync?: string;
  repositories?: number;
}

const GitHubPage = () => {
  const router = useRouter();
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/integrations/github/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setConnection(data);
      } else {
        setConnection({ connected: false });
      }
    } catch (error) {
      setConnection({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/auth/github';
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/catalog/discovery/github/scan', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('GitHub sync started');
        await checkConnection();
      } else {
        toast.error('Failed to start sync');
      }
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect GitHub?')) return;

    try {
      const response = await fetch('/api/integrations/github/disconnect', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('GitHub disconnected');
        setConnection({ connected: false });
      } else {
        toast.error('Failed to disconnect');
      }
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const quickActions = [
    {
      title: 'Import Repository',
      description: 'Add a repository to the service catalog',
      icon: FolderGit2,
      href: '/admin/integrations?action=import-repo',
    },
    {
      title: 'View Pull Requests',
      description: 'See open PRs across your services',
      icon: GitPullRequest,
      href: '/deployments?filter=pull-requests',
    },
    {
      title: 'Team Sync',
      description: 'Sync GitHub teams with platform groups',
      icon: Users,
      href: '/admin/teams?source=github',
    },
    {
      title: 'Branch Policies',
      description: 'Configure branch protection rules',
      icon: GitBranch,
      href: '/admin/policies/branches',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gray-900 dark:bg-gray-700 flex items-center justify-center">
                <Github className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  GitHub Integration
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Connect and manage your GitHub repositories
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {connection?.connected && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
              <Link
                href="/admin/integrations"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          {connection?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {connection.avatar ? (
                    <img
                      src={connection.avatar}
                      alt={connection.username}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <Github className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {connection.username || connection.organization}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {connection.repositories} repositories synced
                    {connection.lastSync && (
                      <span className="ml-2">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Last sync: {new Date(connection.lastSync).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <Github className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Connect to GitHub
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Connect your GitHub account to import repositories, sync teams, and enable automated workflows.
              </p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                <Github className="h-5 w-5" />
                Connect GitHub
              </button>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        {connection?.connected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all group"
                >
                  <action.icon className="h-8 w-8 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-3 transition-colors" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {action.description}
                  </p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Need help with GitHub integration?
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                Learn how to set up webhooks, configure catalog discovery, and sync your GitHub organization.
              </p>
              <a
                href="https://docs.example.com/integrations/github"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                View Documentation
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GitHubPage;
