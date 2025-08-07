'use client';

import React, { useState } from 'react';
import {
 AlertCircle,
 CheckCircle,
 XCircle,
 RefreshCw,
 ArrowRight,
 Info,
 Shield,
 Activity,
 GitBranch,
 Package
} from 'lucide-react';
import { useBackstageVersion, useMigrationStatus } from '@/lib/backstage-compat';
import { versionManager } from '@/lib/backstage-compat';

export default function VersionCompatibility() {
 const { versionInfo, loading, error } = useBackstageVersion();
 const migrations = useMigrationStatus();
 const [isChecking, setIsChecking] = useState(false);
 const [compatReport, setCompatReport] = useState<any>(null);
 const [targetVersion, setTargetVersion] = useState('');

 const handleVersionCheck = async () => {
 if (!targetVersion) return;
 
 setIsChecking(true);
 try {
 const report = versionManager.checkCompatibility(targetVersion);
 setCompatReport(report);
 } catch (err) {
 console.error('Failed to check compatibility:', err);
 } finally {
 setIsChecking(false);
 }
 };

 const handleRefresh = async () => {
 window.location.reload();
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64">
 <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
 </div>
 );
 }

 if (error) {
 return (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
 <div className="flex items-start">
 <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
 <div>
 <h3 className="font-medium text-red-900 dark:text-red-100">
 Version Check Failed
 </h3>
 <p className="text-sm text-red-800 dark:text-red-200 mt-1">
 {error.message}
 </p>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Current Version Status */}
 <div className={`rounded-lg border p-6 ${
 versionInfo?.supported 
 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
 : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
 }`}>
 <div className="flex items-start">
 {versionInfo?.supported ? (
 <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 mt-0.5" />
 ) : (
 <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
 )}
 <div className="flex-1">
 <h3 className={`font-medium ${
 versionInfo?.supported 
 ? 'text-green-900 dark:text-green-100' 
 : 'text-yellow-900 dark:text-yellow-100'
 }`}>
 Backstage Version: {versionInfo?.current}
 </h3>
 <p className={`text-sm mt-1 ${
 versionInfo?.supported 
 ? 'text-green-800 dark:text-green-200' 
 : 'text-yellow-800 dark:text-yellow-200'
 }`}>
 {versionInfo?.supported 
 ? 'Your Backstage version is fully supported'
 : 'Your Backstage version has limited support'}
 </p>
 {versionInfo?.recommendations && versionInfo.recommendations.length > 0 && (
 <ul className="mt-3 space-y-1">
 {versionInfo.recommendations.map((rec, idx) => (
 <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
 <span className="mr-2">•</span>
 {rec}
 </li>
 ))}
 </ul>
 )}
 </div>
 <button
 onClick={handleRefresh}
 className="ml-4 p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-md"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Version Info Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 Current Version
 </h4>
 <GitBranch className="w-4 h-4 text-gray-500" />
 </div>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {versionInfo?.current}
 </p>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Installed Backstage version
 </p>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 Supported Range
 </h4>
 <Shield className="w-4 h-4 text-gray-500" />
 </div>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {versionInfo?.supportedRange.min} - {versionInfo?.supportedRange.max}
 </p>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Fully compatible versions
 </p>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 Migrations
 </h4>
 <Activity className="w-4 h-4 text-gray-500" />
 </div>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {migrations.count}
 </p>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 {migrations.automatic} automatic, {migrations.manual} manual
 </p>
 </div>
 </div>

 {/* Compatibility Checker */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Version Compatibility Checker
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
 Check compatibility before upgrading or downgrading Backstage
 </p>
 
 <div className="flex gap-3">
 <input
 type="text"
 value={targetVersion}
 onChange={(e) => setTargetVersion(e.target.value)}
 placeholder="Enter target version (e.g., 1.22.0)"
 className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
 />
 <button
 onClick={handleVersionCheck}
 disabled={!targetVersion || isChecking}
 className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
 >
 {isChecking ? (
 <RefreshCw className="w-4 h-4 animate-spin" />
 ) : (
 <>Check Compatibility</>
 )}
 </button>
 </div>

 {compatReport && (
 <div className="mt-6 space-y-4">
 {/* Compatibility Status */}
 <div className={`rounded-lg p-4 ${
 compatReport.compatible
 ? 'bg-green-50 dark:bg-green-900/20'
 : 'bg-red-50 dark:bg-red-900/20'
 }`}>
 <div className="flex items-center">
 {compatReport.compatible ? (
 <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" />
 ) : (
 <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
 )}
 <div>
 <p className={`font-medium ${
 compatReport.compatible
 ? 'text-green-900 dark:text-green-100'
 : 'text-red-900 dark:text-red-100'
 }`}>
 {compatReport.compatible
 ? `Compatible with version ${targetVersion}`
 : `Not compatible with version ${targetVersion}`}
 </p>
 </div>
 </div>
 </div>

 {/* Breaking Changes */}
 {compatReport.breakingChanges.length > 0 && (
 <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
 <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
 Breaking Changes
 </h4>
 <ul className="space-y-1">
 {compatReport.breakingChanges.map((change: string, idx: number) => (
 <li key={idx} className="text-sm text-red-800 dark:text-red-200 flex items-start">
 <span className="mr-2">•</span>
 {change}
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Deprecations */}
 {compatReport.deprecations.length > 0 && (
 <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
 <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
 Deprecated APIs
 </h4>
 <ul className="space-y-1">
 {compatReport.deprecations.map((api: string, idx: number) => (
 <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200 font-mono">
 {api}
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Required Migrations */}
 {compatReport.requiredMigrations.length > 0 && (
 <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
 <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
 Required Migrations
 </h4>
 <ul className="space-y-2">
 {compatReport.requiredMigrations.map((migration: any, idx: number) => (
 <li key={idx} className="text-sm text-blue-800 dark:text-blue-200">
 <div className="flex items-center justify-between">
 <span>{migration.description}</span>
 <span className={`px-2 py-0.5 rounded-full text-xs ${
 migration.automatic
 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
 : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
 }`}>
 {migration.automatic ? 'Automatic' : 'Manual'}
 </span>
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Recommendations */}
 {compatReport.recommendations.length > 0 && (
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
 Recommendations
 </h4>
 <ul className="space-y-1">
 {compatReport.recommendations.map((rec: string, idx: number) => (
 <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
 <Info className="w-4 h-4 mr-2 mt-0.5 text-gray-500" />
 {rec}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>

 {/* API Compatibility Info */}
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <div className="flex items-start">
 <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
 <div>
 <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
 About Version Compatibility
 </h4>
 <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
 This wrapper automatically adapts API calls to work with different Backstage versions. 
 Deprecated endpoints are translated to their modern equivalents when possible.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}