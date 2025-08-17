'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  AlertTriangle, CheckCircle, XCircle, Info,
  Star, Users, Activity, Clock, Zap,
  Lock, Key, FileCheck, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecurityValidationResult {
  passed: boolean;
  signatureVerification?: {
    verified: boolean;
    algorithm: string;
    error?: string;
  };
  checksumValidation?: {
    valid: boolean;
    algorithm: string;
    expected: string;
    actual: string;
    error?: string;
  };
  trustScore?: {
    score: number;
    factors: Array<{
      name: string;
      weight: number;
      score: number;
      description: string;
    }>;
    recommendation: 'TRUSTED' | 'REVIEW_REQUIRED' | 'BLOCKED';
    details: string;
  };
  securityLevel: 'high' | 'medium' | 'low' | 'blocked';
  warnings: string[];
  errors: string[];
  timestamp: string;
}

interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  author?: { name: string };
  publisher?: { name: string };
}

interface PluginSecurityValidatorProps {
  pluginName: string;
  version?: string;
  onValidationComplete?: (result: SecurityValidationResult) => void;
  showInstallButton?: boolean;
  onInstall?: (forceInstall: boolean) => void;
}

export default function PluginSecurityValidator({
  pluginName,
  version = 'latest',
  onValidationComplete,
  showInstallButton = true,
  onInstall
}: PluginSecurityValidatorProps) {
  const [loading, setLoading] = useState(true);
  const [pluginInfo, setPluginInfo] = useState<PluginInfo | null>(null);
  const [securityResult, setSecurityResult] = useState<SecurityValidationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (pluginName) {
      validatePluginSecurity();
    }
  }, [pluginName, version]);

  const validatePluginSecurity = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plugins/install-secure?pluginName=${encodeURIComponent(pluginName)}&version=${encodeURIComponent(version)}`);
      const data = await response.json();

      if (data.success) {
        setPluginInfo(data.plugin);
        setSecurityResult(data.security);
        onValidationComplete?.(data.security);
      } else {
        console.error('Security validation failed:', data.error);
      }
    } catch (error) {
      console.error('Failed to validate plugin security:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSecurityIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <ShieldCheck className="w-6 h-6 text-green-500" />;
      case 'medium':
        return <Shield className="w-6 h-6 text-yellow-500" />;
      case 'low':
        return <ShieldAlert className="w-6 h-6 text-orange-500" />;
      case 'blocked':
        return <ShieldX className="w-6 h-6 text-red-500" />;
      default:
        return <Shield className="w-6 h-6 text-gray-500" />;
    }
  };

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'blocked':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const handleInstall = async (force = false) => {
    if (!pluginInfo || !securityResult) return;

    setInstalling(true);
    try {
      const response = await fetch('/api/plugins/install-secure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pluginName: pluginInfo.name,
          version: pluginInfo.version,
          forceInstall: force
        })
      });

      const result = await response.json();
      
      if (result.success) {
        onInstall?.(force);
      } else if (result.requiresApproval) {
        // Handle approval workflow
        alert(`Installation requires approval. Ticket ID: ${result.approvalWorkflow?.ticketId}`);
      } else {
        alert(`Installation failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Installation failed:', error);
      alert('Installation failed due to network error');
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Validating plugin security...</span>
        </div>
      </div>
    );
  }

  if (!pluginInfo || !securityResult) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          Failed to validate plugin security
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Security Validation
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {pluginInfo.name}@{pluginInfo.version}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getSecurityIcon(securityResult.securityLevel)}
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getSecurityLevelColor(securityResult.securityLevel)}`}>
              {securityResult.securityLevel.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Security Overview */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Trust Score */}
          {securityResult.trustScore && (
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className={`text-3xl font-bold ${getTrustScoreColor(securityResult.trustScore.score)}`}>
                {securityResult.trustScore.score}/100
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Trust Score</div>
              <div className={`text-xs mt-2 px-2 py-1 rounded ${
                securityResult.trustScore.recommendation === 'TRUSTED' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : securityResult.trustScore.recommendation === 'REVIEW_REQUIRED'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {securityResult.trustScore.recommendation.replace('_', ' ')}
              </div>
            </div>
          )}

          {/* Signature Verification */}
          {securityResult.signatureVerification && (
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-center mb-2">
                {securityResult.signatureVerification.verified ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Digital Signature
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {securityResult.signatureVerification.verified ? 'Verified' : 'Failed'}
              </div>
            </div>
          )}

          {/* Checksum Validation */}
          {securityResult.checksumValidation && (
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-center mb-2">
                {securityResult.checksumValidation.valid ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Integrity Check
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {securityResult.checksumValidation.valid ? 'Valid' : 'Invalid'}
              </div>
            </div>
          )}
        </div>

        {/* Warnings and Errors */}
        {(securityResult.warnings.length > 0 || securityResult.errors.length > 0) && (
          <div className="mb-6 space-y-3">
            {securityResult.errors.map((error, index) => (
              <div key={`error-${index}`} className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
              </div>
            ))}
            
            {securityResult.warnings.map((warning, index) => (
              <div key={`warning-${index}`} className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-700 dark:text-yellow-400">{warning}</div>
              </div>
            ))}
          </div>
        )}

        {/* Trust Score Details */}
        {securityResult.trustScore && (
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Trust Score Breakdown
              </span>
              <motion.div
                animate={{ rotate: showDetails ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <TrendingUp className="w-4 h-4 text-gray-500" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 space-y-3"
                >
                  {securityResult.trustScore.factors.map((factor, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {factor.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {factor.description}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${getTrustScoreColor(factor.score)}`}>
                          {factor.score}/100
                        </div>
                        <div className="text-xs text-gray-500">
                          {factor.weight}% weight
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Installation Actions */}
        {showInstallButton && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Ready to install? Review security validation above.
            </div>
            
            <div className="flex gap-3">
              {securityResult.securityLevel === 'blocked' ? (
                <button
                  disabled
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed"
                >
                  <Lock className="w-4 h-4 mr-2 inline" />
                  Installation Blocked
                </button>
              ) : securityResult.errors.length > 0 ? (
                <button
                  onClick={() => handleInstall(true)}
                  disabled={installing}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {installing ? 'Installing...' : 'Force Install'}
                </button>
              ) : (
                <button
                  onClick={() => handleInstall(false)}
                  disabled={installing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {installing ? 'Installing...' : 'Install Plugin'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}