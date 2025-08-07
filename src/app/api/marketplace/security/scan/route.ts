import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'dependency' | 'code' | 'configuration' | 'license';
  title: string;
  description: string;
  cve?: string;
  cwe?: string;
  affectedVersions: string[];
  fixedIn?: string;
  patchAvailable: boolean;
  exploitability: 'high' | 'medium' | 'low';
  impact: string;
  recommendation: string;
  references: string[];
  discoveredAt: string;
}

interface SecurityScanResult {
  pluginId: string;
  pluginName: string;
  version: string;
  scanId: string;
  scanStatus: 'pending' | 'scanning' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  securityScore: number;
  vulnerabilities: SecurityVulnerability[];
  dependencies: {
    total: number;
    outdated: number;
    vulnerable: number;
  };
  codeAnalysis: {
    linesOfCode: number;
    complexity: number;
    coverage?: number;
    issues: Array<{
      type: string;
      severity: string;
      message: string;
      file?: string;
      line?: number;
    }>;
  };
  licenseCompliance: {
    compatible: boolean;
    licenses: string[];
    conflicts: string[];
  };
  recommendations: string[];
  passed: boolean;
}

// Simulated vulnerability database
const knownVulnerabilities: Record<string, SecurityVulnerability[]> = {
  'lodash': [{
    id: 'CVE-2021-23337',
    severity: 'high',
    type: 'dependency',
    title: 'Command Injection in lodash',
    description: 'Lodash versions prior to 4.17.21 are vulnerable to Command Injection via template function',
    cve: 'CVE-2021-23337',
    cwe: 'CWE-78',
    affectedVersions: ['< 4.17.21'],
    fixedIn: '4.17.21',
    patchAvailable: true,
    exploitability: 'medium',
    impact: 'Remote code execution possible',
    recommendation: 'Update lodash to version 4.17.21 or later',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
    discoveredAt: '2021-02-15T00:00:00Z'
  }],
  'axios': [{
    id: 'CVE-2023-45857',
    severity: 'medium',
    type: 'dependency',
    title: 'Cross-Site Request Forgery in axios',
    description: 'Axios versions before 1.6.0 are vulnerable to CSRF attacks',
    cve: 'CVE-2023-45857',
    cwe: 'CWE-352',
    affectedVersions: ['< 1.6.0'],
    fixedIn: '1.6.0',
    patchAvailable: true,
    exploitability: 'low',
    impact: 'Unauthorized actions on behalf of authenticated users',
    recommendation: 'Update axios to version 1.6.0 or later',
    references: ['https://github.com/axios/axios/security/advisories/GHSA-wf5p-g6vw-rhxx'],
    discoveredAt: '2023-11-08T00:00:00Z'
  }]
};

// Simulate security scanning
const performSecurityScan = async (
  pluginId: string,
  pluginName: string,
  version: string,
  dependencies: Record<string, string>
): Promise<SecurityScanResult> => {
  const scanId = crypto.randomBytes(8).toString('hex');
  const startedAt = new Date().toISOString();
  
  // Simulate scanning delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check for known vulnerabilities in dependencies
  const vulnerabilities: SecurityVulnerability[] = [];
  let vulnerableDeps = 0;
  let outdatedDeps = 0;
  
  for (const [dep, depVersion] of Object.entries(dependencies)) {
    // Check if dependency has known vulnerabilities
    if (knownVulnerabilities[dep]) {
      const depVulns = knownVulnerabilities[dep];
      vulnerabilities.push(...depVulns);
      vulnerableDeps++;
    }
    
    // Simulate checking for outdated dependencies
    if (Math.random() > 0.7) {
      outdatedDeps++;
    }
  }
  
  // Add some simulated code analysis issues
  const codeIssues = [];
  if (Math.random() > 0.5) {
    codeIssues.push({
      type: 'security',
      severity: 'medium',
      message: 'Potential SQL injection vulnerability detected',
      file: 'src/database/queries.ts',
      line: 142
    });
  }
  
  if (Math.random() > 0.6) {
    codeIssues.push({
      type: 'security',
      severity: 'low',
      message: 'Hardcoded API key detected',
      file: 'src/config/api.ts',
      line: 23
    });
  }
  
  // Calculate security score
  let securityScore = 100;
  vulnerabilities.forEach(vuln => {
    switch (vuln.severity) {
      case 'critical': securityScore -= 25; break;
      case 'high': securityScore -= 15; break;
      case 'medium': securityScore -= 10; break;
      case 'low': securityScore -= 5; break;
    }
  });
  codeIssues.forEach(issue => {
    if (issue.severity === 'high') securityScore -= 10;
    else if (issue.severity === 'medium') securityScore -= 5;
    else securityScore -= 2;
  });
  securityScore = Math.max(0, securityScore);
  
  // Generate recommendations
  const recommendations = [];
  if (vulnerabilities.length > 0) {
    recommendations.push('Update vulnerable dependencies to their latest secure versions');
  }
  if (outdatedDeps > 0) {
    recommendations.push(`Update ${outdatedDeps} outdated dependencies`);
  }
  if (codeIssues.length > 0) {
    recommendations.push('Address code security issues identified in static analysis');
  }
  if (securityScore < 70) {
    recommendations.push('Consider a comprehensive security audit');
  }
  
  return {
    pluginId,
    pluginName,
    version,
    scanId,
    scanStatus: 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    securityScore,
    vulnerabilities,
    dependencies: {
      total: Object.keys(dependencies).length,
      outdated: outdatedDeps,
      vulnerable: vulnerableDeps
    },
    codeAnalysis: {
      linesOfCode: Math.floor(Math.random() * 10000) + 1000,
      complexity: Math.floor(Math.random() * 100) + 10,
      coverage: Math.floor(Math.random() * 30) + 70,
      issues: codeIssues
    },
    licenseCompliance: {
      compatible: Math.random() > 0.2,
      licenses: ['MIT', 'Apache-2.0', 'ISC'],
      conflicts: Math.random() > 0.8 ? ['GPL-3.0'] : []
    },
    recommendations,
    passed: securityScore >= 70 && vulnerabilities.filter(v => v.severity === 'critical').length === 0
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, pluginName, version, dependencies = {} } = body;
    
    if (!pluginId || !pluginName || !version) {
      return NextResponse.json(
        { error: 'Plugin ID, name, and version are required' },
        { status: 400 }
      );
    }
    
    // Perform security scan
    const scanResult = await performSecurityScan(
      pluginId,
      pluginName,
      version,
      dependencies
    );
    
    return NextResponse.json(scanResult);
    
  } catch (error) {
    console.error('Security scan failed:', error);
    return NextResponse.json(
      { error: 'Security scan failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const scanId = searchParams.get('scanId');
    
    // In a real implementation, this would fetch scan results from storage
    if (scanId) {
      // Return specific scan result
      return NextResponse.json({
        scanId,
        status: 'completed',
        message: 'Scan result retrieved successfully'
      });
    }
    
    if (pluginId) {
      // Return scan history for a plugin
      return NextResponse.json({
        pluginId,
        scans: [
          {
            scanId: 'scan-001',
            version: '1.0.0',
            scanDate: new Date(Date.now() - 86400000).toISOString(),
            securityScore: 85,
            passed: true
          },
          {
            scanId: 'scan-002',
            version: '1.0.1',
            scanDate: new Date(Date.now() - 43200000).toISOString(),
            securityScore: 92,
            passed: true
          }
        ]
      });
    }
    
    // Return recent scans
    return NextResponse.json({
      recentScans: [
        {
          pluginId: 'github-actions',
          pluginName: 'GitHub Actions',
          scanDate: new Date(Date.now() - 3600000).toISOString(),
          securityScore: 95,
          passed: true
        },
        {
          pluginId: 'kubernetes',
          pluginName: 'Kubernetes',
          scanDate: new Date(Date.now() - 7200000).toISOString(),
          securityScore: 88,
          passed: true
        }
      ]
    });
    
  } catch (error) {
    console.error('Failed to fetch scan results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan results' },
      { status: 500 }
    );
  }
}