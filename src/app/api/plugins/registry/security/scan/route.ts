// Plugin Security Scanning API
// Comprehensive security analysis for Backstage plugins

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnhancedPluginRegistry } from '@/services/backstage/enhanced-plugin-registry';
import axios from 'axios';
import { createHash } from 'crypto';

const SecurityScanRequestSchema = z.object({
  plugins: z.array(z.object({
    id: z.string(),
    name: z.string(),
    version: z.string()
  })),
  scanOptions: z.object({
    vulnerabilities: z.boolean().default(true),
    licenses: z.boolean().default(true),
    signatures: z.boolean().default(true),
    malware: z.boolean().default(false),
    dependencies: z.boolean().default(true),
    deepScan: z.boolean().default(false)
  }).optional()
});

interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cve?: string;
  cvss?: number;
  affectedVersions: string;
  patchedVersions?: string;
  recommendation: string;
  references: string[];
}

interface LicenseInfo {
  name: string;
  type: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
  compatible: boolean;
  restrictions: string[];
  url?: string;
}

interface SecurityScanResult {
  pluginId: string;
  pluginName: string;
  version: string;
  scanTimestamp: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  vulnerabilities: SecurityVulnerability[];
  licenses: LicenseInfo[];
  signature: {
    verified: boolean;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
  };
  dependencies: Array<{
    name: string;
    version: string;
    vulnerabilities: number;
    licenseIssues: number;
  }>;
  malwareCheck: {
    clean: boolean;
    suspiciousPatterns: string[];
    reputation: 'good' | 'neutral' | 'suspicious' | 'malicious';
  };
  recommendations: string[];
}

// POST /api/plugins/registry/security/scan - Scan plugins for security issues
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plugins, scanOptions = {} } = SecurityScanRequestSchema.parse(body);

    if (plugins.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No plugins provided for scanning'
      }, { status: 400 });
    }

    if (plugins.length > 50) {
      return NextResponse.json({
        success: false,
        error: 'Maximum 50 plugins per scan request'
      }, { status: 400 });
    }

    // Perform security scans
    const scanResults = await Promise.allSettled(
      plugins.map(plugin => performSecurityScan(plugin, scanOptions))
    );

    const successfulScans: SecurityScanResult[] = [];
    const failedScans: Array<{ plugin: string; error: string }> = [];

    scanResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulScans.push(result.value);
      } else {
        failedScans.push({
          plugin: plugins[index].name,
          error: result.reason instanceof Error ? result.reason.message : 'Scan failed'
        });
      }
    });

    // Generate summary
    const summary = generateSecuritySummary(successfulScans);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        results: successfulScans,
        failures: failedScans,
        scanId: generateScanId(),
        scannedAt: new Date().toISOString(),
        options: scanOptions
      }
    });

  } catch (error) {
    console.error('Security scan error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Security scan failed'
    }, { status: 500 });
  }
}

// GET /api/plugins/registry/security/scan/[scanId] - Get scan results
export async function GET(
  request: NextRequest,
  { params }: { params: { scanId: string } }
) {
  try {
    // In a production system, you'd retrieve scan results from database
    // For now, we'll return a mock response
    return NextResponse.json({
      success: true,
      data: {
        scanId: params.scanId,
        status: 'completed',
        createdAt: new Date().toISOString(),
        results: []
      }
    });

  } catch (error) {
    console.error('Failed to retrieve scan results:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve scan results'
    }, { status: 500 });
  }
}

// Helper functions

async function performSecurityScan(
  plugin: { id: string; name: string; version: string },
  options: any
): Promise<SecurityScanResult> {
  const scanResult: SecurityScanResult = {
    pluginId: plugin.id,
    pluginName: plugin.name,
    version: plugin.version,
    scanTimestamp: new Date().toISOString(),
    overallRisk: 'low',
    riskScore: 0,
    vulnerabilities: [],
    licenses: [],
    signature: { verified: false },
    dependencies: [],
    malwareCheck: {
      clean: true,
      suspiciousPatterns: [],
      reputation: 'good'
    },
    recommendations: []
  };

  // Vulnerability scanning
  if (options.vulnerabilities !== false) {
    scanResult.vulnerabilities = await scanVulnerabilities(plugin);
  }

  // License analysis
  if (options.licenses !== false) {
    scanResult.licenses = await analyzeLicenses(plugin);
  }

  // Signature verification
  if (options.signatures !== false) {
    scanResult.signature = await verifySignature(plugin);
  }

  // Dependency analysis
  if (options.dependencies !== false) {
    scanResult.dependencies = await analyzeDependencies(plugin, options.deepScan);
  }

  // Malware checking
  if (options.malware === true) {
    scanResult.malwareCheck = await checkMalware(plugin);
  }

  // Calculate risk score and overall risk
  const riskAssessment = calculateRiskScore(scanResult);
  scanResult.riskScore = riskAssessment.score;
  scanResult.overallRisk = riskAssessment.level;

  // Generate recommendations
  scanResult.recommendations = generateSecurityRecommendations(scanResult);

  return scanResult;
}

async function scanVulnerabilities(plugin: { name: string; version: string }): Promise<SecurityVulnerability[]> {
  try {
    // In a real implementation, integrate with:
    // - npm audit
    // - Snyk API
    // - OSV (Open Source Vulnerabilities) database
    // - GitHub Security Advisory API

    // Mock vulnerability data for demonstration
    const vulnerabilities: SecurityVulnerability[] = [];

    // Simulate npm audit check
    try {
      const auditResponse = await axios.post('https://registry.npmjs.org/-/npm/v1/security/audits', {
        name: plugin.name,
        version: plugin.version
      }, { timeout: 10000 });

      // Process audit results (simplified)
      if (auditResponse.data && auditResponse.data.vulnerabilities) {
        // Convert npm audit format to our format
        vulnerabilities.push(...auditResponse.data.vulnerabilities.map((vuln: any) => ({
          id: vuln.id || `vuln-${Date.now()}`,
          severity: vuln.severity,
          title: vuln.title,
          description: vuln.overview || vuln.description,
          cve: vuln.cve,
          cvss: vuln.cvss,
          affectedVersions: vuln.vulnerable_versions,
          patchedVersions: vuln.patched_versions,
          recommendation: vuln.recommendation || 'Update to a patched version',
          references: vuln.references || []
        })));
      }
    } catch (auditError) {
      // If npm audit fails, use fallback vulnerability database
      const fallbackVulns = await checkFallbackVulnerabilityDatabase(plugin);
      vulnerabilities.push(...fallbackVulns);
    }

    return vulnerabilities;

  } catch (error) {
    console.warn(`Vulnerability scan failed for ${plugin.name}:`, error);
    return [];
  }
}

async function checkFallbackVulnerabilityDatabase(plugin: { name: string; version: string }): Promise<SecurityVulnerability[]> {
  // Simulate checking against OSV or other vulnerability databases
  const mockVulnerabilities = [
    // Add mock vulnerabilities for testing
  ];

  return mockVulnerabilities;
}

async function analyzeLicenses(plugin: { name: string; version: string }): Promise<LicenseInfo[]> {
  try {
    const npmRegistryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
    const response = await axios.get(`${npmRegistryUrl}/${plugin.name}/${plugin.version}`, {
      timeout: 10000
    });

    const packageData = response.data;
    const licenses: LicenseInfo[] = [];

    // Analyze main package license
    if (packageData.license) {
      const license = classifyLicense(packageData.license);
      licenses.push(license);
    }

    // Analyze dependency licenses if requested
    if (packageData.dependencies) {
      // In a real implementation, you'd recursively check all dependency licenses
      // This is simplified for demonstration
    }

    return licenses;

  } catch (error) {
    console.warn(`License analysis failed for ${plugin.name}:`, error);
    return [];
  }
}

function classifyLicense(licenseString: string): LicenseInfo {
  const license = licenseString.toLowerCase();
  
  const permissiveLicenses = ['mit', 'apache-2.0', 'bsd', 'isc', 'unlicense'];
  const copyleftLicenses = ['gpl', 'lgpl', 'agpl', 'mpl'];
  const proprietaryLicenses = ['proprietary', 'commercial'];

  let type: LicenseInfo['type'] = 'unknown';
  let compatible = false;
  let restrictions: string[] = [];

  if (permissiveLicenses.some(l => license.includes(l))) {
    type = 'permissive';
    compatible = true;
    restrictions = ['Include license notice'];
  } else if (copyleftLicenses.some(l => license.includes(l))) {
    type = 'copyleft';
    compatible = false; // Depends on your project's license
    restrictions = ['Source code must be available', 'Derivative works must use same license'];
  } else if (proprietaryLicenses.some(l => license.includes(l))) {
    type = 'proprietary';
    compatible = false;
    restrictions = ['Commercial license required'];
  }

  return {
    name: licenseString,
    type,
    compatible,
    restrictions
  };
}

async function verifySignature(plugin: { name: string; version: string }): Promise<SecurityScanResult['signature']> {
  try {
    // In a real implementation, verify package signatures using:
    // - npm package signatures
    // - Sigstore/cosign for container images
    // - GPG signatures for source code

    const npmRegistryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
    const response = await axios.get(`${npmRegistryUrl}/${plugin.name}/${plugin.version}`, {
      timeout: 10000
    });

    const packageData = response.data;
    
    // Check if package has npm signature
    const hasNpmSignature = packageData.dist?.signatures?.length > 0;
    
    // Check publisher reputation
    const isVerifiedPublisher = packageData.maintainers?.some((m: any) => 
      m.name === 'backstage-service' || m.name.includes('backstage')
    );

    return {
      verified: hasNpmSignature || isVerifiedPublisher,
      issuer: isVerifiedPublisher ? 'Backstage Team' : 'npm',
      validFrom: packageData.time?.[plugin.version],
      validTo: undefined // npm packages don't typically have expiration
    };

  } catch (error) {
    console.warn(`Signature verification failed for ${plugin.name}:`, error);
    return { verified: false };
  }
}

async function analyzeDependencies(
  plugin: { name: string; version: string },
  deepScan: boolean = false
): Promise<SecurityScanResult['dependencies']> {
  try {
    const npmRegistryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
    const response = await axios.get(`${npmRegistryUrl}/${plugin.name}/${plugin.version}`, {
      timeout: 10000
    });

    const packageData = response.data;
    const dependencies: SecurityScanResult['dependencies'] = [];

    if (packageData.dependencies) {
      for (const [depName, depVersion] of Object.entries(packageData.dependencies)) {
        let vulnerabilities = 0;
        let licenseIssues = 0;

        if (deepScan) {
          // Recursively analyze dependencies
          try {
            const depVulns = await scanVulnerabilities({ name: depName, version: depVersion as string });
            vulnerabilities = depVulns.length;

            const depLicenses = await analyzeLicenses({ name: depName, version: depVersion as string });
            licenseIssues = depLicenses.filter(l => !l.compatible).length;
          } catch (error) {
            // Continue with other dependencies
          }
        }

        dependencies.push({
          name: depName,
          version: depVersion as string,
          vulnerabilities,
          licenseIssues
        });
      }
    }

    return dependencies;

  } catch (error) {
    console.warn(`Dependency analysis failed for ${plugin.name}:`, error);
    return [];
  }
}

async function checkMalware(plugin: { name: string; version: string }): Promise<SecurityScanResult['malwareCheck']> {
  try {
    // In a real implementation, integrate with:
    // - VirusTotal API
    // - Package reputation services
    // - Static analysis tools

    // Mock malware check
    const suspiciousPatterns: string[] = [];
    let reputation: SecurityScanResult['malwareCheck']['reputation'] = 'good';

    // Check for suspicious package patterns
    if (plugin.name.includes('test') && plugin.name.includes('malware')) {
      suspiciousPatterns.push('Suspicious package name');
      reputation = 'suspicious';
    }

    // Check package age (very new packages might be suspicious)
    const packageAge = await getPackageAge(plugin);
    if (packageAge < 7) { // Less than 7 days old
      suspiciousPatterns.push('Very new package (less than 7 days old)');
    }

    return {
      clean: suspiciousPatterns.length === 0,
      suspiciousPatterns,
      reputation
    };

  } catch (error) {
    console.warn(`Malware check failed for ${plugin.name}:`, error);
    return {
      clean: true,
      suspiciousPatterns: [],
      reputation: 'neutral'
    };
  }
}

async function getPackageAge(plugin: { name: string; version: string }): Promise<number> {
  try {
    const npmRegistryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
    const response = await axios.get(`${npmRegistryUrl}/${plugin.name}`, {
      timeout: 10000
    });

    const publishDate = response.data.time?.[plugin.version];
    if (publishDate) {
      const daysSincePublish = (Date.now() - new Date(publishDate).getTime()) / (1000 * 60 * 60 * 24);
      return Math.floor(daysSincePublish);
    }

    return Infinity; // Unknown age, assume old/safe
  } catch (error) {
    return Infinity;
  }
}

function calculateRiskScore(scanResult: SecurityScanResult): { score: number; level: SecurityScanResult['overallRisk'] } {
  let score = 0;

  // Vulnerability scoring
  scanResult.vulnerabilities.forEach(vuln => {
    switch (vuln.severity) {
      case 'critical': score += 10; break;
      case 'high': score += 7; break;
      case 'medium': score += 4; break;
      case 'low': score += 1; break;
    }
  });

  // License issues
  scanResult.licenses.forEach(license => {
    if (!license.compatible) score += 3;
  });

  // Signature verification
  if (!scanResult.signature.verified) score += 2;

  // Malware check
  if (!scanResult.malwareCheck.clean) {
    switch (scanResult.malwareCheck.reputation) {
      case 'malicious': score += 20; break;
      case 'suspicious': score += 10; break;
      case 'neutral': score += 2; break;
    }
  }

  // Dependency issues
  scanResult.dependencies.forEach(dep => {
    score += dep.vulnerabilities * 0.5;
    score += dep.licenseIssues * 0.3;
  });

  // Determine risk level
  let level: SecurityScanResult['overallRisk'];
  if (score >= 15) level = 'critical';
  else if (score >= 8) level = 'high';
  else if (score >= 3) level = 'medium';
  else level = 'low';

  return { score: Math.round(score * 10) / 10, level };
}

function generateSecurityRecommendations(scanResult: SecurityScanResult): string[] {
  const recommendations: string[] = [];

  if (scanResult.vulnerabilities.length > 0) {
    recommendations.push(`Address ${scanResult.vulnerabilities.length} security vulnerabilities`);
    
    const criticalVulns = scanResult.vulnerabilities.filter(v => v.severity === 'critical').length;
    if (criticalVulns > 0) {
      recommendations.push(`URGENT: Fix ${criticalVulns} critical vulnerabilities immediately`);
    }
  }

  if (!scanResult.signature.verified) {
    recommendations.push('Verify plugin source and authenticity before installation');
  }

  const incompatibleLicenses = scanResult.licenses.filter(l => !l.compatible);
  if (incompatibleLicenses.length > 0) {
    recommendations.push(`Review ${incompatibleLicenses.length} license compatibility issues`);
  }

  if (!scanResult.malwareCheck.clean) {
    recommendations.push('Investigate suspicious patterns detected in malware scan');
  }

  const depsWithVulns = scanResult.dependencies.filter(d => d.vulnerabilities > 0);
  if (depsWithVulns.length > 0) {
    recommendations.push(`Update ${depsWithVulns.length} dependencies with vulnerabilities`);
  }

  if (scanResult.overallRisk === 'high' || scanResult.overallRisk === 'critical') {
    recommendations.push('Consider alternative plugins with better security posture');
  }

  if (recommendations.length === 0) {
    recommendations.push('Plugin appears secure - proceed with standard deployment practices');
  }

  return recommendations;
}

function generateSecuritySummary(scanResults: SecurityScanResult[]): any {
  const summary = {
    totalPlugins: scanResults.length,
    riskDistribution: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    totalVulnerabilities: 0,
    averageRiskScore: 0,
    commonIssues: [] as Array<{ issue: string; count: number }>,
    recommendations: [] as string[]
  };

  // Calculate statistics
  let totalRiskScore = 0;
  const issueMap = new Map<string, number>();

  scanResults.forEach(result => {
    summary.riskDistribution[result.overallRisk]++;
    summary.totalVulnerabilities += result.vulnerabilities.length;
    totalRiskScore += result.riskScore;

    // Track common issues
    if (!result.signature.verified) {
      issueMap.set('Unverified signature', (issueMap.get('Unverified signature') || 0) + 1);
    }
    
    if (result.vulnerabilities.length > 0) {
      issueMap.set('Security vulnerabilities', (issueMap.get('Security vulnerabilities') || 0) + 1);
    }

    if (result.licenses.some(l => !l.compatible)) {
      issueMap.set('License compatibility', (issueMap.get('License compatibility') || 0) + 1);
    }
  });

  summary.averageRiskScore = scanResults.length > 0 ? totalRiskScore / scanResults.length : 0;

  // Convert issue map to array and sort by frequency
  summary.commonIssues = Array.from(issueMap.entries())
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Generate summary recommendations
  if (summary.riskDistribution.critical > 0) {
    summary.recommendations.push(`${summary.riskDistribution.critical} plugins have critical security issues - immediate action required`);
  }

  if (summary.totalVulnerabilities > 0) {
    summary.recommendations.push(`Total of ${summary.totalVulnerabilities} vulnerabilities found across all plugins`);
  }

  if (summary.commonIssues.length > 0) {
    summary.recommendations.push(`Most common issue: ${summary.commonIssues[0].issue} (${summary.commonIssues[0].count} plugins affected)`);
  }

  return summary;
}

function generateScanId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `scan-${timestamp}-${random}`;
}