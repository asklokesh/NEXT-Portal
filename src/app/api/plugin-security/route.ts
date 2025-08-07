import { NextRequest, NextResponse } from 'next/server';

interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cve?: string;
  cvss?: number;
  affectedVersions: string[];
  patchedVersion?: string;
  exploitable: boolean;
  publicExploit: boolean;
  references: string[];
  discoveredAt: string;
  publishedAt: string;
  lastModified: string;
}

interface SecurityScan {
  pluginId: string;
  pluginName: string;
  version: string;
  scanId: string;
  scanDate: string;
  status: 'scanning' | 'completed' | 'failed' | 'pending';
  securityScore: number; // 0-100
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  vulnerabilities: SecurityVulnerability[];
  dependencies: {
    id: string;
    version: string;
    vulnerabilities: SecurityVulnerability[];
    outdated: boolean;
    malicious: boolean;
  }[];
  licenses: {
    name: string;
    type: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
    compatible: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    url?: string;
  }[];
  codeQuality: {
    maintainability: number;
    reliability: number;
    security: number;
    testCoverage: number;
    codeSmells: number;
    duplicatedLines: number;
  };
  compliance: {
    gdpr: boolean;
    hipaa: boolean;
    sox: boolean;
    pci: boolean;
    issues: string[];
  };
  recommendations: {
    priority: 'immediate' | 'high' | 'medium' | 'low';
    action: string;
    description: string;
    impact: string;
  }[];
}

interface SecurityDashboard {
  totalScans: number;
  criticalIssues: number;
  highRiskPlugins: number;
  averageScore: number;
  trendsData: {
    date: string;
    newVulnerabilities: number;
    resolvedIssues: number;
    securityScore: number;
  }[];
  topVulnerabilities: SecurityVulnerability[];
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    minimal: number;
  };
}

// Mock vulnerability database
const VULNERABILITY_DB: SecurityVulnerability[] = [
  {
    id: 'CVE-2024-1234',
    severity: 'critical',
    title: 'Remote Code Execution in React Component',
    description: 'A critical vulnerability allows remote code execution through unsanitized props in React components.',
    cve: 'CVE-2024-1234',
    cvss: 9.8,
    affectedVersions: ['1.0.0', '1.1.0', '1.2.0'],
    patchedVersion: '1.2.1',
    exploitable: true,
    publicExploit: true,
    references: [
      'https://github.com/advisories/GHSA-xxxx-xxxx-xxxx',
      'https://nvd.nist.gov/vuln/detail/CVE-2024-1234'
    ],
    discoveredAt: '2024-01-15T10:30:00Z',
    publishedAt: '2024-01-16T14:00:00Z',
    lastModified: '2024-01-18T09:15:00Z'
  },
  {
    id: 'CVE-2024-5678',
    severity: 'high',
    title: 'SQL Injection in Database Plugin',
    description: 'SQL injection vulnerability in database query handling allows unauthorized data access.',
    cve: 'CVE-2024-5678',
    cvss: 8.1,
    affectedVersions: ['2.0.0', '2.1.0'],
    patchedVersion: '2.1.1',
    exploitable: true,
    publicExploit: false,
    references: [
      'https://github.com/advisories/GHSA-yyyy-yyyy-yyyy'
    ],
    discoveredAt: '2024-01-20T16:45:00Z',
    publishedAt: '2024-01-21T10:00:00Z',
    lastModified: '2024-01-22T11:30:00Z'
  },
  {
    id: 'SNYK-001',
    severity: 'medium',
    title: 'Cross-Site Scripting (XSS) Vulnerability',
    description: 'Stored XSS vulnerability in user input handling allows script injection.',
    cvss: 6.1,
    affectedVersions: ['1.5.0', '1.5.1'],
    patchedVersion: '1.5.2',
    exploitable: true,
    publicExploit: false,
    references: [
      'https://snyk.io/vuln/SNYK-JS-001'
    ],
    discoveredAt: '2024-01-18T12:00:00Z',
    publishedAt: '2024-01-19T08:30:00Z',
    lastModified: '2024-01-20T14:15:00Z'
  }
];

// Mock plugin security data
const generateSecurityScan = (pluginId: string, pluginName: string): SecurityScan => {
  const riskLevels: Array<'critical' | 'high' | 'medium' | 'low' | 'minimal'> = ['critical', 'high', 'medium', 'low', 'minimal'];
  const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];
  
  // Generate vulnerabilities based on plugin and risk level
  const vulnerabilities: SecurityVulnerability[] = [];
  const numVulns = riskLevel === 'critical' ? Math.floor(Math.random() * 3) + 2 :
                   riskLevel === 'high' ? Math.floor(Math.random() * 2) + 1 :
                   riskLevel === 'medium' ? Math.floor(Math.random() * 2) :
                   riskLevel === 'low' ? Math.floor(Math.random() * 1) : 0;

  for (let i = 0; i < numVulns; i++) {
    const vuln = VULNERABILITY_DB[Math.floor(Math.random() * VULNERABILITY_DB.length)];
    vulnerabilities.push({
      ...vuln,
      id: `${vuln.id}-${pluginId}-${i}`,
      severity: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : vuln.severity
    });
  }

  const securityScore = riskLevel === 'critical' ? Math.random() * 30 + 10 :
                       riskLevel === 'high' ? Math.random() * 30 + 40 :
                       riskLevel === 'medium' ? Math.random() * 25 + 60 :
                       riskLevel === 'low' ? Math.random() * 20 + 75 :
                       Math.random() * 10 + 90;

  return {
    pluginId,
    pluginName,
    version: '1.0.0',
    scanId: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    scanDate: new Date().toISOString(),
    status: 'completed',
    securityScore: Math.round(securityScore),
    riskLevel,
    vulnerabilities,
    dependencies: [
      {
        id: 'react',
        version: '18.2.0',
        vulnerabilities: Math.random() > 0.7 ? [vulnerabilities[0]] : [],
        outdated: Math.random() > 0.6,
        malicious: false
      },
      {
        id: 'lodash',
        version: '4.17.21',
        vulnerabilities: [],
        outdated: Math.random() > 0.8,
        malicious: false
      },
      {
        id: '@types/node',
        version: '18.19.0',
        vulnerabilities: [],
        outdated: false,
        malicious: false
      }
    ],
    licenses: [
      {
        name: 'MIT',
        type: 'permissive',
        compatible: true,
        riskLevel: 'low',
        url: 'https://opensource.org/licenses/MIT'
      },
      {
        name: 'Apache-2.0',
        type: 'permissive',
        compatible: true,
        riskLevel: 'low',
        url: 'https://opensource.org/licenses/Apache-2.0'
      }
    ],
    codeQuality: {
      maintainability: Math.random() * 40 + 60,
      reliability: Math.random() * 30 + 70,
      security: securityScore,
      testCoverage: Math.random() * 50 + 40,
      codeSmells: Math.floor(Math.random() * 20),
      duplicatedLines: Math.floor(Math.random() * 500)
    },
    compliance: {
      gdpr: Math.random() > 0.3,
      hipaa: Math.random() > 0.7,
      sox: Math.random() > 0.8,
      pci: Math.random() > 0.6,
      issues: riskLevel === 'critical' ? ['Data encryption not implemented', 'Audit logging missing'] : []
    },
    recommendations: generateRecommendations(riskLevel, vulnerabilities.length)
  };
};

const generateRecommendations = (riskLevel: string, vulnCount: number) => {
  const recommendations = [];
  
  if (riskLevel === 'critical') {
    recommendations.push({
      priority: 'immediate' as const,
      action: 'Disable plugin immediately',
      description: 'Critical security vulnerabilities detected. Disable plugin until patches are available.',
      impact: 'Prevents potential security breaches and data loss'
    });
  }
  
  if (vulnCount > 0) {
    recommendations.push({
      priority: 'high' as const,
      action: 'Update to latest version',
      description: 'Newer versions contain security patches for known vulnerabilities.',
      impact: 'Resolves known security issues and improves stability'
    });
  }
  
  recommendations.push({
    priority: 'medium' as const,
    action: 'Enable security monitoring',
    description: 'Set up continuous monitoring for this plugin to detect future vulnerabilities.',
    impact: 'Early detection of security issues and faster response times'
  });
  
  return recommendations;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';
    const pluginId = searchParams.get('pluginId');
    const severity = searchParams.get('severity');
    const riskLevel = searchParams.get('riskLevel');

    if (action === 'dashboard') {
      // Generate mock dashboard data
      const dashboard: SecurityDashboard = {
        totalScans: 156,
        criticalIssues: 8,
        highRiskPlugins: 23,
        averageScore: 78.5,
        trendsData: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          newVulnerabilities: Math.floor(Math.random() * 5),
          resolvedIssues: Math.floor(Math.random() * 8) + 2,
          securityScore: Math.random() * 20 + 70
        })),
        topVulnerabilities: VULNERABILITY_DB.slice(0, 5),
        riskDistribution: {
          critical: 8,
          high: 23,
          medium: 45,
          low: 67,
          minimal: 13
        }
      };

      return NextResponse.json({
        success: true,
        dashboard
      });
    }

    if (action === 'scan' && pluginId) {
      const pluginName = pluginId.split('/').pop()?.replace('plugin-', '') || pluginId;
      const scan = generateSecurityScan(pluginId, pluginName);
      
      return NextResponse.json({
        success: true,
        scan
      });
    }

    if (action === 'scans') {
      // Return list of security scans
      const plugins = [
        '@backstage/plugin-catalog',
        '@backstage/plugin-kubernetes',
        '@backstage/plugin-techdocs',
        '@roadiehq/backstage-plugin-github-actions',
        '@backstage/plugin-jenkins',
        '@spotify/backstage-plugin-lighthouse',
        '@backstage/plugin-cost-insights'
      ];

      let scans = plugins.map(pluginId => {
        const pluginName = pluginId.split('/').pop()?.replace('plugin-', '') || pluginId;
        return generateSecurityScan(pluginId, pluginName);
      });

      // Apply filters
      if (severity) {
        scans = scans.filter(scan => 
          scan.vulnerabilities.some(v => v.severity === severity)
        );
      }

      if (riskLevel) {
        scans = scans.filter(scan => scan.riskLevel === riskLevel);
      }

      return NextResponse.json({
        success: true,
        scans: scans.sort((a, b) => a.securityScore - b.securityScore), // Sort by risk (lowest score first)
        total: scans.length
      });
    }

    if (action === 'vulnerabilities') {
      let vulnerabilities = [...VULNERABILITY_DB];
      
      if (severity) {
        vulnerabilities = vulnerabilities.filter(v => v.severity === severity);
      }

      return NextResponse.json({
        success: true,
        vulnerabilities: vulnerabilities.sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error handling security request:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, pluginId, scanType, config } = await request.json();

    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Action is required'
      }, { status: 400 });
    }

    switch (action) {
      case 'start-scan':
        if (!pluginId) {
          return NextResponse.json({
            success: false,
            error: 'Plugin ID is required for scanning'
          }, { status: 400 });
        }

        // Simulate starting a security scan
        const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Return initial scan status
        return NextResponse.json({
          success: true,
          scanId,
          status: 'scanning',
          message: `Security scan started for ${pluginId}`,
          estimatedTime: '2-5 minutes'
        });

      case 'bulk-scan':
        const { plugins } = await request.json();
        if (!plugins || !Array.isArray(plugins)) {
          return NextResponse.json({
            success: false,
            error: 'Plugins array is required'
          }, { status: 400 });
        }

        const bulkScanId = `bulk-scan-${Date.now()}`;
        return NextResponse.json({
          success: true,
          bulkScanId,
          status: 'scanning',
          pluginsCount: plugins.length,
          message: `Bulk security scan started for ${plugins.length} plugins`,
          estimatedTime: `${plugins.length * 2}-${plugins.length * 5} minutes`
        });

      case 'configure-alerts':
        return NextResponse.json({
          success: true,
          message: 'Security alert configuration updated',
          config
        });

      case 'export-report':
        const { format, pluginIds } = await request.json();
        return NextResponse.json({
          success: true,
          message: `Security report exported in ${format} format`,
          reportId: `report-${Date.now()}`,
          pluginCount: pluginIds?.length || 0
        });

      case 'remediate-vulnerability':
        const { vulnerabilityId, remediationType } = await request.json();
        return NextResponse.json({
          success: true,
          message: `Remediation ${remediationType} applied for vulnerability ${vulnerabilityId}`,
          status: 'remediated'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error handling security POST request:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('scanId');

    if (!scanId) {
      return NextResponse.json({
        success: false,
        error: 'Scan ID is required'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Security scan ${scanId} cancelled and deleted`
    });

  } catch (error) {
    console.error('Error deleting security scan:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}