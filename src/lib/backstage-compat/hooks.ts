"use client"

import { useEffect, useState } from 'react';
import { versionManager } from './version-manager';
import { apiAdapter } from './api-adapter';

export interface VersionInfo {
 current: string;
 supported: boolean;
 supportedRange: { min: string; max: string };
 recommendations: string[];
}

export function useBackstageVersion() {
 const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<Error | null>(null);

 useEffect(() => {
 const checkVersion = async () => {
 try {
 setLoading(true);
 const info = await apiAdapter.checkVersionCompatibility();
 setVersionInfo({
 current: info.currentVersion,
 supported: info.supported,
 supportedRange: info.supportedRange,
 recommendations: info.recommendations
 });
 } catch (err) {
 setError(err instanceof Error ? err : new Error('Failed to check version'));
 } finally {
 setLoading(false);
 }
 };

 checkVersion();
 }, []);

 return { versionInfo, loading, error };
}

export function useApiCompat() {
 const [isCompatible, setIsCompatible] = useState(true);
 const [warnings, setWarnings] = useState<string[]>([]);

 useEffect(() => {
 const checkApiCompatibility = async () => {
 try {
 const version = await versionManager.detectBackstageVersion();
 const supported = versionManager.isVersionSupported(version);
 setIsCompatible(supported);
 
 if (!supported) {
 const range = versionManager.getSupportedVersionRange();
 setWarnings([
 `Backstage version ${version} may have compatibility issues.`,
 `Supported versions: ${range.min} - ${range.max}`
 ]);
 }
 } catch (error) {
 console.warn('Could not check API compatibility:', error);
 }
 };

 checkApiCompatibility();
 }, []);

 return { isCompatible, warnings };
}

export function useMigrationStatus() {
 const [migrations, setMigrations] = useState<{
 required: boolean;
 count: number;
 automatic: number;
 manual: number;
 }>({
 required: false,
 count: 0,
 automatic: 0,
 manual: 0
 });

 useEffect(() => {
 const checkMigrations = async () => {
 try {
 const currentVersion = await versionManager.detectBackstageVersion();
 const latestSupported = versionManager.getSupportedVersionRange().max;
 
 if (currentVersion !== latestSupported) {
 const report = versionManager.checkCompatibility(latestSupported);
 const automatic = report.requiredMigrations.filter(m => m.automatic).length;
 const manual = report.requiredMigrations.filter(m => !m.automatic).length;
 
 setMigrations({
 required: report.requiredMigrations.length > 0,
 count: report.requiredMigrations.length,
 automatic,
 manual
 });
 }
 } catch (error) {
 console.error('Failed to check migrations:', error);
 }
 };

 checkMigrations();
 }, []);

 return migrations;
}