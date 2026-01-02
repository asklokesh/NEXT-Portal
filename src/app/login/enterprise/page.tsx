'use client';

import { motion } from 'framer-motion';
import { Zap, Building2, Mail, ArrowLeft, Shield, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

const EnterpriseLoginPage = () => {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Look up organization by domain
      const response = await fetch('/api/auth/enterprise/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      const data = await response.json();

      if (response.ok && data.found) {
        // Redirect to organization's SSO provider
        if (data.ssoUrl) {
          window.location.href = data.ssoUrl;
        } else {
          toast.error('SSO not configured for this organization');
        }
      } else {
        setError(data.error || 'Organization not found. Check your domain or contact your administrator.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const predefinedProviders = [
    { name: 'Okta', icon: Shield, color: 'bg-blue-500' },
    { name: 'Azure AD', icon: Building2, color: 'bg-sky-500' },
    { name: 'OneLogin', icon: Lock, color: 'bg-green-500' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8"
      >
        {/* Back link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-100">
            Enterprise Sign In
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your company domain to sign in with your organization&apos;s identity provider
          </p>
        </div>

        {/* Domain form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </motion.div>
          )}

          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Company Domain
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="domain"
                name="domain"
                type="text"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
                placeholder="company.com"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Enter your work email domain (e.g., company.com)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !domain}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              'Continue'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500">
              Or sign in with
            </span>
          </div>
        </div>

        {/* Direct SSO providers */}
        <div className="grid grid-cols-3 gap-3">
          {predefinedProviders.map((provider) => (
            <button
              key={provider.name}
              type="button"
              onClick={() => toast.error(`${provider.name} SSO not configured`)}
              className="flex flex-col items-center justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <provider.icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              <span className="mt-1 text-xs text-gray-600 dark:text-gray-400">{provider.name}</span>
            </button>
          ))}
        </div>

        {/* Help text */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Need help?
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Contact your IT administrator to set up SSO for your organization, or{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
              reach out to our support team
            </Link>.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default EnterpriseLoginPage;
