'use client';

import { motion } from 'framer-motion';
import { Zap, Mail, Lock, User, Building2, Github, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

const SignupPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization: '',
    acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!formData.acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          organization: formData.organization,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStep('verify');
        toast.success('Account created! Please verify your email.');
      } else {
        setError(data.error || 'Failed to create account');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSSOSignup = (provider: string) => {
    if (provider === 'GitHub') {
      window.location.href = '/api/auth/github?signup=true';
    } else if (provider === 'Google') {
      window.location.href = '/api/auth/google?signup=true';
    }
  };

  const features = [
    'Unlimited service catalog entries',
    'Built-in software templates',
    'Real-time deployment tracking',
    'Team collaboration tools',
    'Plugin marketplace access',
  ];

  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Check your email
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            We&apos;ve sent a verification link to <strong>{formData.email}</strong>
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Click the link in the email to activate your account and start using the platform.
          </p>
          <div className="mt-8 space-y-4">
            <button
              onClick={() => router.push('/login')}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Go to Login
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setStep('form')}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              Use a different email
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white dark:bg-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm"
        >
          {/* Logo */}
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <Zap className="h-10 w-10 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                IDP Platform
              </span>
            </Link>
            <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Start building with your internal developer platform
            </p>
          </div>

          {/* SSO Options */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSSOSignup('GitHub')}
              className="flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Github className="h-5 w-5" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">GitHub</span>
            </button>
            <button
              onClick={() => handleSSOSignup('Google')}
              className="flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">Or continue with email</span>
            </div>
          </div>

          {/* Signup form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
              >
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </motion.div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Full name
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Work email
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization name
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="organization"
                  name="organization"
                  type="text"
                  value={formData.organization}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
                  placeholder="Acme Inc. (optional)"
                />
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
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
                  placeholder="Min. 8 characters"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <div className="flex items-start">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={handleChange}
                className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="acceptTerms" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-500">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-500">Privacy Policy</Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right side - Features */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700">
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="max-w-md text-white">
              <h3 className="text-3xl font-bold mb-4">
                Everything you need to build great software
              </h3>
              <p className="text-lg opacity-90 mb-8">
                Join thousands of developers using our platform to accelerate their development workflow.
              </p>
              <div className="space-y-4">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-white/90">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
