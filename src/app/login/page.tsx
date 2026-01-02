'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { motion } from 'framer-motion';
import { Zap, Mail, Lock, Github, AlertCircle, Package, Activity, Building2, ChevronDown, Shield, Server } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface Organization {
  id: string;
  slug: string;
  displayName: string;
  ssoEnabled: boolean;
  ssoProvider: string | null;
  allowLocalAuth?: boolean;
  enforceSSO?: boolean;
  environment?: string;
}

interface OrgDiscoveryResponse {
  organizations: Organization[];
  primaryOrganization?: Organization;
  emailDomain?: string;
  redirectToSSO?: boolean;
  defaultLoginAllowed?: boolean;
}

const LoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Organization state
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [orgDiscovering, setOrgDiscovering] = useState(false);

  // Check for org parameter in URL
  useEffect(() => {
    const orgParam = searchParams.get('org');
    if (orgParam) {
      setOrganizationSlug(orgParam);
      discoverOrgBySlug(orgParam);
    } else {
      // Fetch available organizations
      fetchOrganizations();
    }
  }, [searchParams]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/auth/orgs');
      const data = await response.json();
      if (data.organizations) {
        setOrganizations(data.organizations);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const discoverOrgBySlug = async (slug: string) => {
    try {
      const response = await fetch(`/api/auth/org/${slug}`);
      if (response.ok) {
        const data = await response.json();
        if (data.organization) {
          setSelectedOrg(data.organization);
          setOrganizationSlug(data.organization.slug);
        }
      }
    } catch (err) {
      console.error('Failed to discover organization:', err);
    }
  };

  // Debounced email domain discovery
  const discoverOrgByEmail = useCallback(async (emailValue: string) => {
    if (!emailValue.includes('@')) return;

    setOrgDiscovering(true);
    try {
      const response = await fetch('/api/auth/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue })
      });

      const data: OrgDiscoveryResponse = await response.json();

      if (data.organizations?.length > 0) {
        setOrganizations(data.organizations);

        // Auto-select primary organization
        if (data.primaryOrganization) {
          setSelectedOrg(data.primaryOrganization);
          setOrganizationSlug(data.primaryOrganization.slug);

          // If SSO is enforced, redirect to SSO
          if (data.redirectToSSO && data.primaryOrganization.ssoProvider) {
            toast.success(`Redirecting to ${data.primaryOrganization.displayName} SSO...`);
            router.push(`/api/auth/sso/${data.primaryOrganization.slug}`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to discover organization:', err);
    } finally {
      setOrgDiscovering(false);
    }
  }, [router]);

  // Trigger org discovery when email changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email.includes('@') && !organizationSlug) {
        discoverOrgByEmail(email);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, organizationSlug, discoverOrgByEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if SSO is enforced for selected org
      if (selectedOrg?.enforceSSO && selectedOrg.ssoEnabled && !selectedOrg.allowLocalAuth) {
        toast.error('SSO login is required for this organization');
        router.push(`/api/auth/sso/${selectedOrg.slug}`);
        return;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          rememberMe: false,
          organizationSlug: organizationSlug || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const orgName = data.organization?.displayName;
        toast.success(orgName ? `Welcome to ${orgName}!` : 'Welcome back!');

        // Redirect to callback URL or dashboard
        const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
        router.push(callbackUrl);
      } else {
        if (data.ssoRequired) {
          toast.error('SSO login is required for this organization');
          router.push(`/api/auth/sso/${organizationSlug}`);
        } else {
          setError(data.error || 'Invalid email or password');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = (provider: string) => {
    setOauthLoading(provider);
    if (provider === 'GitHub') {
      window.location.href = '/api/auth/github';
    } else if (provider === 'Google') {
      window.location.href = '/api/auth/google';
    } else if (provider === 'Microsoft') {
      window.location.href = '/api/auth/azure';
    } else if (provider === 'Enterprise') {
      router.push('/login/enterprise');
    } else {
      toast.error(`${provider} authentication not configured`);
      setOauthLoading(null);
    }
  };

  const handleOrgSelect = (org: Organization) => {
    setSelectedOrg(org);
    setOrganizationSlug(org.slug);
    setShowOrgSelector(false);

    // If SSO is enforced, inform user
    if (org.enforceSSO && org.ssoEnabled) {
      toast.success(`${org.displayName} requires SSO login`);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm"
        >
          {/* Logo */}
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <Zap className="h-12 w-12 text-blue-600" />
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                IDP Platform
              </span>
            </Link>
            <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Sign in to access your developer platform
            </p>
          </div>

          {/* Organization Selector */}
          {organizations.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOrgSelector(!showOrgSelector)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <div>
                      {selectedOrg ? (
                        <>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {selectedOrg.displayName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {selectedOrg.ssoEnabled ? `SSO via ${selectedOrg.ssoProvider}` : 'Local Authentication'}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Select an organization (optional)
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showOrgSelector ? 'rotate-180' : ''}`} />
                </button>

                {showOrgSelector && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrg(null);
                        setOrganizationSlug('');
                        setShowOrgSelector(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700"
                    >
                      <Server className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          No Organization
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Login without organization context
                        </p>
                      </div>
                    </button>

                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => handleOrgSelect(org)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 ${
                          selectedOrg?.id === org.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <Building2 className={`h-5 w-5 ${selectedOrg?.id === org.id ? 'text-blue-600' : 'text-gray-400'}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${selectedOrg?.id === org.id ? 'text-blue-600' : 'text-gray-900 dark:text-gray-100'}`}>
                              {org.displayName}
                            </p>
                            {org.ssoEnabled && (
                              <Shield className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {org.ssoEnabled ? `SSO: ${org.ssoProvider}` : 'Password Login'}
                            {org.environment && ` - ${org.environment}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* SSO Required Notice */}
          {selectedOrg?.enforceSSO && selectedOrg.ssoEnabled && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
            >
              <div className="flex">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    SSO Required
                  </h3>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    {selectedOrg.displayName} requires SSO login via {selectedOrg.ssoProvider}.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(`/api/auth/sso/${selectedOrg.slug}`)}
                    className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    Continue with SSO
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
              >
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
                    placeholder="you@company.com"
                  />
                  {orgDiscovering && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
                    placeholder="Enter your password"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button type="button" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                  Forgot your password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || (selectedOrg?.enforceSSO && selectedOrg.ssoEnabled && !selectedOrg.allowLocalAuth)}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSSOLogin('GitHub')}
                  disabled={oauthLoading !== null}
                  className="w-full inline-flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {oauthLoading === 'GitHub' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500" />
                  ) : (
                    <Github className="h-5 w-5" />
                  )}
                  <span>GitHub</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSSOLogin('Google')}
                  disabled={oauthLoading !== null}
                  className="w-full inline-flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {oauthLoading === 'Google' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSSOLogin('Microsoft')}
                  disabled={oauthLoading !== null}
                  className="w-full inline-flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {oauthLoading === 'Microsoft' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z"/>
                      <path fill="#81bc06" d="M12 1h10v10H12z"/>
                      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                      <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                  )}
                  <span>Microsoft</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSSOLogin('Enterprise')}
                  disabled={oauthLoading !== null}
                  className="w-full inline-flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <Building2 className="h-5 w-5" />
                  <span>Enterprise SSO</span>
                </button>
              </div>

              {/* Sign up link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  New to IDP Platform?{' '}
                  <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                    Create an account
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Right side - Image/Pattern */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700">
          <div className="absolute inset-0 bg-black opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="max-w-md text-white">
              <h3 className="text-3xl font-bold mb-4">
                Enterprise-Grade Internal Developer Platform
              </h3>
              <p className="text-lg opacity-90 mb-8">
                Multi-tenant SaaS platform for managing your development infrastructure.
                SSO integration, organization management, and enterprise security built-in.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Multi-Tenant Organizations</p>
                    <p className="text-sm opacity-75">Isolated environments for each company</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Enterprise SSO</p>
                    <p className="text-sm opacity-75">SAML, OIDC, Okta, Azure AD support</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Environment Separation</p>
                    <p className="text-sm opacity-75">Dev, staging, and production environments</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
