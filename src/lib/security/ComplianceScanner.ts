import { Entity } from '@/services/backstage/types/entities';

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'compliance' | 'best-practice' | 'governance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  check: (entity: Entity) => ComplianceCheckResult;
}

export interface ComplianceCheckResult {
  passed: boolean;
  message: string;
  details?: string;
  remediation?: string;
  references?: string[];
}

export interface ComplianceScanResult {
  entityRef: string;
  entityName: string;
  entityKind: string;
  scanDate: Date;
  overallScore: number;
  passed: number;
  failed: number;
  violations: ComplianceViolation[];
  suggestions: ComplianceSuggestion[];
}

export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: string;
  message: string;
  details?: string;
  remediation?: string;
  references?: string[];
}

export interface ComplianceSuggestion {
  type: 'improvement' | 'recommendation' | 'warning';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export class ComplianceScanner {
  private rules: ComplianceRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules() {
    // Security Rules
    this.rules.push({
      id: 'SEC-001',
      name: 'No Hardcoded Secrets',
      description: 'Ensure no hardcoded secrets or API keys in metadata',
      category: 'security',
      severity: 'critical',
      tags: ['security', 'secrets'],
      check: (entity) => {
        const secretPatterns = [
          /api[_-]?key/i,
          /secret/i,
          /password/i,
          /token/i,
          /private[_-]?key/i,
          /access[_-]?key/i,
        ];

        const metadata = JSON.stringify(entity.metadata);
        const spec = JSON.stringify(entity.spec);
        
        for (const pattern of secretPatterns) {
          if (pattern.test(metadata) || pattern.test(spec)) {
            // Check if it's actually a value, not just a key name
            const suspiciousValues = [
              /[a-zA-Z0-9]{32,}/,  // Long alphanumeric strings
              /-----BEGIN/,         // Private keys
              /Bearer\s+[a-zA-Z0-9]+/i,
            ];
            
            for (const valuePattern of suspiciousValues) {
              if (valuePattern.test(metadata) || valuePattern.test(spec)) {
                return {
                  passed: false,
                  message: 'Potential hardcoded secret detected',
                  details: 'Found suspicious patterns that may indicate hardcoded secrets',
                  remediation: 'Use environment variables or secret management systems instead of hardcoding secrets',
                  references: ['https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure'],
                };
              }
            }
          }
        }

        return {
          passed: true,
          message: 'No hardcoded secrets detected',
        };
      },
    });

    this.rules.push({
      id: 'SEC-002',
      name: 'HTTPS URLs Only',
      description: 'Ensure all URLs use HTTPS protocol',
      category: 'security',
      severity: 'high',
      tags: ['security', 'encryption'],
      check: (entity) => {
        const httpUrls: string[] = [];
        
        // Check metadata links
        if (entity.metadata.links) {
          entity.metadata.links.forEach(link => {
            if (link.url && link.url.startsWith('http://') && !link.url.startsWith('http://localhost')) {
              httpUrls.push(link.url);
            }
          });
        }

        // Check annotations
        if (entity.metadata.annotations) {
          Object.values(entity.metadata.annotations).forEach(value => {
            if (typeof value === 'string' && value.startsWith('http://') && !value.startsWith('http://localhost')) {
              httpUrls.push(value);
            }
          });
        }

        if (httpUrls.length > 0) {
          return {
            passed: false,
            message: 'Found non-HTTPS URLs',
            details: `Insecure HTTP URLs found: ${httpUrls.join(', ')}`,
            remediation: 'Replace all HTTP URLs with HTTPS to ensure encrypted communication',
            references: ['https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content'],
          };
        }

        return {
          passed: true,
          message: 'All URLs use HTTPS',
        };
      },
    });

    // Compliance Rules
    this.rules.push({
      id: 'COMP-001',
      name: 'Required Metadata Fields',
      description: 'Ensure all required metadata fields are present',
      category: 'compliance',
      severity: 'high',
      tags: ['compliance', 'metadata'],
      check: (entity) => {
        const requiredFields = ['name', 'description'];
        const missingFields: string[] = [];

        requiredFields.forEach(field => {
          if (!entity.metadata[field as keyof typeof entity.metadata]) {
            missingFields.push(field);
          }
        });

        if (missingFields.length > 0) {
          return {
            passed: false,
            message: 'Missing required metadata fields',
            details: `Missing fields: ${missingFields.join(', ')}`,
            remediation: 'Add the missing metadata fields to comply with catalog standards',
          };
        }

        return {
          passed: true,
          message: 'All required metadata fields present',
        };
      },
    });

    this.rules.push({
      id: 'COMP-002',
      name: 'Valid Owner Assignment',
      description: 'Ensure entity has a valid owner',
      category: 'compliance',
      severity: 'high',
      tags: ['compliance', 'ownership'],
      check: (entity) => {
        if (!entity.spec?.owner) {
          return {
            passed: false,
            message: 'No owner assigned',
            details: 'Entity must have an owner for accountability',
            remediation: 'Assign an owner using the format: user:username or group:groupname',
          };
        }

        const ownerPattern = /^(user|group|team):[a-zA-Z0-9-_]+$/;
        if (!ownerPattern.test(entity.spec.owner)) {
          return {
            passed: false,
            message: 'Invalid owner format',
            details: `Owner "${entity.spec.owner}" does not match required format`,
            remediation: 'Use format: user:username, group:groupname, or team:teamname',
          };
        }

        return {
          passed: true,
          message: 'Valid owner assigned',
        };
      },
    });

    this.rules.push({
      id: 'COMP-003',
      name: 'Lifecycle Stage Defined',
      description: 'Ensure entity has a valid lifecycle stage',
      category: 'compliance',
      severity: 'medium',
      tags: ['compliance', 'lifecycle'],
      check: (entity) => {
        const validLifecycles = ['experimental', 'production', 'deprecated', 'development'];
        
        if (!entity.spec?.lifecycle) {
          return {
            passed: false,
            message: 'No lifecycle stage defined',
            details: 'Entity must specify its lifecycle stage',
            remediation: `Set lifecycle to one of: ${validLifecycles.join(', ')}`,
          };
        }

        if (!validLifecycles.includes(entity.spec.lifecycle)) {
          return {
            passed: false,
            message: 'Invalid lifecycle stage',
            details: `Lifecycle "${entity.spec.lifecycle}" is not a valid stage`,
            remediation: `Use one of: ${validLifecycles.join(', ')}`,
          };
        }

        return {
          passed: true,
          message: 'Valid lifecycle stage defined',
        };
      },
    });

    // Best Practice Rules
    this.rules.push({
      id: 'BP-001',
      name: 'Meaningful Description',
      description: 'Ensure entity has a meaningful description',
      category: 'best-practice',
      severity: 'medium',
      tags: ['best-practice', 'documentation'],
      check: (entity) => {
        const description = entity.metadata.description;
        
        if (!description) {
          return {
            passed: false,
            message: 'No description provided',
            details: 'Entity lacks a description',
            remediation: 'Add a clear, concise description of what this entity represents',
          };
        }

        if (description.length < 10) {
          return {
            passed: false,
            message: 'Description too short',
            details: `Description "${description}" is not meaningful`,
            remediation: 'Provide a more detailed description (at least 10 characters)',
          };
        }

        const genericDescriptions = [
          'todo',
          'tbd',
          'n/a',
          'none',
          'test',
          'temp',
        ];

        if (genericDescriptions.includes(description.toLowerCase())) {
          return {
            passed: false,
            message: 'Generic description detected',
            details: 'Description appears to be a placeholder',
            remediation: 'Replace with a meaningful description of the entity',
          };
        }

        return {
          passed: true,
          message: 'Meaningful description provided',
        };
      },
    });

    this.rules.push({
      id: 'BP-002',
      name: 'Proper Tagging',
      description: 'Ensure entity has appropriate tags',
      category: 'best-practice',
      severity: 'low',
      tags: ['best-practice', 'organization'],
      check: (entity) => {
        const tags = entity.metadata.tags || [];
        
        if (tags.length === 0) {
          return {
            passed: false,
            message: 'No tags defined',
            details: 'Entity should have tags for better organization',
            remediation: 'Add relevant tags to categorize and organize the entity',
          };
        }

        // Check for meaningful tags
        const meaningfulTags = tags.filter(tag => tag.length > 2);
        if (meaningfulTags.length === 0) {
          return {
            passed: false,
            message: 'Tags too short',
            details: 'Tags should be meaningful and descriptive',
            remediation: 'Use descriptive tags that help categorize the entity',
          };
        }

        return {
          passed: true,
          message: 'Proper tags defined',
        };
      },
    });

    this.rules.push({
      id: 'BP-003',
      name: 'Documentation Links',
      description: 'Check if entity has documentation links',
      category: 'best-practice',
      severity: 'low',
      tags: ['best-practice', 'documentation'],
      check: (entity) => {
        const links = entity.metadata.links || [];
        const docLinks = links.filter(link => 
          link.title?.toLowerCase().includes('doc') ||
          link.url?.toLowerCase().includes('doc') ||
          link.title?.toLowerCase().includes('wiki')
        );

        if (docLinks.length === 0) {
          return {
            passed: false,
            message: 'No documentation links found',
            details: 'Entity should have links to documentation',
            remediation: 'Add links to relevant documentation, wikis, or runbooks',
          };
        }

        return {
          passed: true,
          message: 'Documentation links present',
        };
      },
    });

    // Governance Rules
    this.rules.push({
      id: 'GOV-001',
      name: 'Cost Attribution',
      description: 'Ensure entity has cost attribution metadata',
      category: 'governance',
      severity: 'medium',
      tags: ['governance', 'cost'],
      check: (entity) => {
        const costAnnotations = [
          'cost-center',
          'budget-code',
          'billing-tag',
          'finance/cost-center',
        ];

        const hasCostAttribution = costAnnotations.some(annotation => 
          entity.metadata.annotations?.[annotation]
        );

        if (!hasCostAttribution) {
          return {
            passed: false,
            message: 'No cost attribution metadata',
            details: 'Entity lacks cost center or budget information',
            remediation: 'Add cost attribution annotations for financial tracking',
          };
        }

        return {
          passed: true,
          message: 'Cost attribution present',
        };
      },
    });

    this.rules.push({
      id: 'GOV-002',
      name: 'Compliance Labels',
      description: 'Check for compliance-related labels',
      category: 'governance',
      severity: 'medium',
      tags: ['governance', 'compliance'],
      check: (entity) => {
        const complianceLabels = entity.metadata.labels || {};
        const requiredLabels = ['data-classification', 'compliance-scope'];
        const missingLabels: string[] = [];

        requiredLabels.forEach(label => {
          if (!complianceLabels[label]) {
            missingLabels.push(label);
          }
        });

        if (missingLabels.length > 0) {
          return {
            passed: false,
            message: 'Missing compliance labels',
            details: `Missing labels: ${missingLabels.join(', ')}`,
            remediation: 'Add required compliance labels for governance tracking',
          };
        }

        return {
          passed: true,
          message: 'Compliance labels present',
        };
      },
    });
  }

  async scanEntity(entity: Entity): Promise<ComplianceScanResult> {
    const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
    const violations: ComplianceViolation[] = [];
    const suggestions: ComplianceSuggestion[] = [];
    
    let passed = 0;
    let failed = 0;

    // Run all rules
    for (const rule of this.rules) {
      try {
        const result = rule.check(entity);
        
        if (result.passed) {
          passed++;
        } else {
          failed++;
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            message: result.message,
            details: result.details,
            remediation: result.remediation,
            references: result.references,
          });
        }
      } catch (error) {
        console.error(`Error running rule ${rule.id}:`, error);
      }
    }

    // Generate suggestions based on scan results
    if (violations.filter(v => v.severity === 'critical').length > 0) {
      suggestions.push({
        type: 'warning',
        message: 'Critical security violations detected. Address these immediately.',
        priority: 'high',
      });
    }

    if (violations.filter(v => v.category === 'compliance').length > 2) {
      suggestions.push({
        type: 'recommendation',
        message: 'Multiple compliance issues found. Consider reviewing your entity metadata standards.',
        priority: 'medium',
      });
    }

    if (passed / (passed + failed) > 0.8) {
      suggestions.push({
        type: 'improvement',
        message: 'Entity is mostly compliant. Address remaining issues to achieve full compliance.',
        priority: 'low',
      });
    }

    // Calculate overall score (0-100)
    const overallScore = Math.round((passed / (passed + failed)) * 100);

    return {
      entityRef,
      entityName: entity.metadata.name,
      entityKind: entity.kind,
      scanDate: new Date(),
      overallScore,
      passed,
      failed,
      violations,
      suggestions,
    };
  }

  async scanMultipleEntities(entities: Entity[]): Promise<ComplianceScanResult[]> {
    const results: ComplianceScanResult[] = [];
    
    for (const entity of entities) {
      const result = await this.scanEntity(entity);
      results.push(result);
    }
    
    return results;
  }

  getRulesByCategory(category: string): ComplianceRule[] {
    return this.rules.filter(rule => rule.category === category);
  }

  getRulesBySeverity(severity: string): ComplianceRule[] {
    return this.rules.filter(rule => rule.severity === severity);
  }

  getRulesByTags(tags: string[]): ComplianceRule[] {
    return this.rules.filter(rule => 
      tags.some(tag => rule.tags.includes(tag))
    );
  }

  addCustomRule(rule: ComplianceRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  getAllRules(): ComplianceRule[] {
    return [...this.rules];
  }
}