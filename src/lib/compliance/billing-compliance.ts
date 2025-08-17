import { PrismaClient } from '@prisma/client';
import { config } from '../env-validation';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface ComplianceReport {
  reportType: 'SOX' | 'GDPR' | 'PCI_DSS' | 'SOC2' | 'HIPAA' | 'CCPA';
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  findings: {
    compliant: boolean;
    issues: ComplianceIssue[];
    recommendations: string[];
  };
  evidence: {
    auditLogs: number;
    dataRetentionCompliance: boolean;
    encryptionCompliance: boolean;
    accessControlCompliance: boolean;
  };
}

interface ComplianceIssue {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
  remediation: string;
  affectedRecords?: number;
}

interface DataRetentionPolicy {
  dataType: 'customer_data' | 'payment_data' | 'audit_logs' | 'billing_data';
  retentionPeriod: number; // in days
  anonymizationRequired: boolean;
  deletionRequired: boolean;
  legalHoldExemptions?: string[];
}

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
}

// Billing Compliance Service
export class BillingComplianceService {
  private encryptionConfig: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 32
  };

  private dataRetentionPolicies: DataRetentionPolicy[] = [
    {
      dataType: 'customer_data',
      retentionPeriod: 2555, // 7 years
      anonymizationRequired: true,
      deletionRequired: false
    },
    {
      dataType: 'payment_data',
      retentionPeriod: 2555, // 7 years (regulatory requirement)
      anonymizationRequired: false,
      deletionRequired: false
    },
    {
      dataType: 'audit_logs',
      retentionPeriod: 2190, // 6 years
      anonymizationRequired: false,
      deletionRequired: false
    },
    {
      dataType: 'billing_data',
      retentionPeriod: 2555, // 7 years
      anonymizationRequired: true,
      deletionRequired: false
    }
  ];

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(
    reportType: ComplianceReport['reportType'],
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const issues: ComplianceIssue[] = [];
    const recommendations: string[] = [];

    // Check data retention compliance
    const dataRetentionCompliance = await this.checkDataRetentionCompliance();
    if (!dataRetentionCompliance.compliant) {
      issues.push(...dataRetentionCompliance.issues);
      recommendations.push(...dataRetentionCompliance.recommendations);
    }

    // Check encryption compliance
    const encryptionCompliance = await this.checkEncryptionCompliance();
    if (!encryptionCompliance.compliant) {
      issues.push(...encryptionCompliance.issues);
      recommendations.push(...encryptionCompliance.recommendations);
    }

    // Check access control compliance
    const accessControlCompliance = await this.checkAccessControlCompliance();
    if (!accessControlCompliance.compliant) {
      issues.push(...accessControlCompliance.issues);
      recommendations.push(...accessControlCompliance.recommendations);
    }

    // Check audit logging compliance
    const auditLogCount = await prisma.auditLog.count({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Specific compliance checks based on report type
    switch (reportType) {
      case 'GDPR':
        await this.performGDPRChecks(issues, recommendations, startDate, endDate);
        break;
      case 'PCI_DSS':
        await this.performPCIDSSChecks(issues, recommendations);
        break;
      case 'SOC2':
        await this.performSOC2Checks(issues, recommendations, startDate, endDate);
        break;
      case 'SOX':
        await this.performSOXChecks(issues, recommendations, startDate, endDate);
        break;
    }

    const compliant = issues.filter(issue => issue.severity === 'HIGH' || issue.severity === 'CRITICAL').length === 0;

    return {
      reportType,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      findings: {
        compliant,
        issues,
        recommendations
      },
      evidence: {
        auditLogs: auditLogCount,
        dataRetentionCompliance: dataRetentionCompliance.compliant,
        encryptionCompliance: encryptionCompliance.compliant,
        accessControlCompliance: accessControlCompliance.compliant
      }
    };
  }

  /**
   * Encrypt sensitive data
   */
  encryptSensitiveData(data: string, context?: string): {
    encrypted: string;
    iv: string;
    authTag: string;
    salt?: string;
  } {
    try {
      const key = this.getDerivedKey(context);
      const iv = crypto.randomBytes(this.encryptionConfig.ivLength);
      
      const cipher = crypto.createCipher(this.encryptionConfig.algorithm, key);
      cipher.setAAD(Buffer.from(context || 'billing-data'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(
    encryptedData: string,
    iv: string,
    authTag: string,
    context?: string
  ): string {
    try {
      const key = this.getDerivedKey(context);
      
      const decipher = crypto.createDecipher(this.encryptionConfig.algorithm, key);
      decipher.setAAD(Buffer.from(context || 'billing-data'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Anonymize personal data for compliance
   */
  async anonymizeCustomerData(organizationId: string): Promise<void> {
    try {
      // Generate anonymous identifier
      const anonymousId = crypto.randomBytes(16).toString('hex');
      
      // Update organization with anonymized data
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          name: anonymousId,
          displayName: `Anonymous-${anonymousId.substring(0, 8)}`,
          billingEmail: `anonymous-${anonymousId}@example.com`,
          billingAddress: null,
          metadata: {
            anonymized: true,
            anonymizedAt: new Date().toISOString(),
            originalId: organizationId
          }
        }
      });

      // Log anonymization action
      await prisma.auditLog.create({
        data: {
          action: 'DATA_ANONYMIZED',
          resource: 'organization',
          resourceId: organizationId,
          metadata: {
            anonymizedAt: new Date().toISOString(),
            reason: 'GDPR_COMPLIANCE'
          }
        }
      });

      console.log(`Successfully anonymized data for organization ${organizationId}`);
    } catch (error) {
      console.error('Error anonymizing customer data:', error);
      throw error;
    }
  }

  /**
   * Handle data deletion requests (GDPR Right to be Forgotten)
   */
  async handleDataDeletionRequest(organizationId: string, reason: string): Promise<void> {
    try {
      // Check for legal hold or regulatory requirements
      const hasActiveSubscription = await prisma.subscription.count({
        where: {
          organizationId,
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
        }
      });

      const hasUnpaidInvoices = await prisma.invoice.count({
        where: {
          organizationId,
          status: 'OPEN'
        }
      });

      if (hasActiveSubscription > 0 || hasUnpaidInvoices > 0) {
        throw new Error('Cannot delete data with active subscriptions or unpaid invoices');
      }

      // Mark for deletion (soft delete initially)
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          status: 'CANCELLED',
          metadata: {
            markedForDeletion: true,
            deletionRequestedAt: new Date().toISOString(),
            deletionReason: reason,
            scheduledDeletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
          }
        }
      });

      // Log deletion request
      await prisma.auditLog.create({
        data: {
          action: 'DATA_DELETION_REQUESTED',
          resource: 'organization',
          resourceId: organizationId,
          metadata: {
            requestedAt: new Date().toISOString(),
            reason,
            scheduledDeletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      });

      console.log(`Data deletion request processed for organization ${organizationId}`);
    } catch (error) {
      console.error('Error processing data deletion request:', error);
      throw error;
    }
  }

  /**
   * Export customer data for compliance (GDPR Data Portability)
   */
  async exportCustomerData(organizationId: string): Promise<{
    organization: any;
    subscriptions: any[];
    invoices: any[];
    payments: any[];
    usage: any[];
    auditLogs: any[];
  }> {
    try {
      const [organization, subscriptions, invoices, payments, usage, auditLogs] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: organizationId }
        }),
        prisma.subscription.findMany({
          where: { organizationId },
          include: { plan: true }
        }),
        prisma.invoice.findMany({
          where: { organizationId },
          include: { lineItems: true }
        }),
        prisma.payment.findMany({
          where: { organizationId }
        }),
        prisma.resourceUsage.findMany({
          where: { organizationId }
        }),
        prisma.auditLog.findMany({
          where: {
            OR: [
              { resourceId: organizationId },
              { userId: { in: [] } } // Would need to get user IDs for the organization
            ]
          }
        })
      ]);

      // Log data export
      await prisma.auditLog.create({
        data: {
          action: 'DATA_EXPORTED',
          resource: 'organization',
          resourceId: organizationId,
          metadata: {
            exportedAt: new Date().toISOString(),
            recordCounts: {
              subscriptions: subscriptions.length,
              invoices: invoices.length,
              payments: payments.length,
              usage: usage.length,
              auditLogs: auditLogs.length
            }
          }
        }
      });

      return {
        organization,
        subscriptions,
        invoices,
        payments,
        usage,
        auditLogs
      };
    } catch (error) {
      console.error('Error exporting customer data:', error);
      throw error;
    }
  }

  /**
   * Validate PCI DSS compliance for payment data
   */
  async validatePCICompliance(): Promise<{
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if payment data is encrypted
    const paymentMethodsWithPlainText = await prisma.organization.count({
      where: {
        defaultPaymentMethod: { not: null },
        // Check if payment method data is encrypted (implementation-specific)
      }
    });

    if (paymentMethodsWithPlainText > 0) {
      issues.push('Payment method data not properly encrypted');
      recommendations.push('Implement field-level encryption for all payment method data');
    }

    // Check for proper access logging
    const recentPaymentAccess = await prisma.auditLog.count({
      where: {
        action: { contains: 'PAYMENT' },
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    if (recentPaymentAccess === 0) {
      issues.push('No audit logs found for payment data access');
      recommendations.push('Implement comprehensive audit logging for all payment data access');
    }

    return {
      compliant: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Generate SOC 2 compliance report
   */
  async generateSOC2Report(startDate: Date, endDate: Date): Promise<{
    controls: {
      security: boolean;
      availability: boolean;
      processing: boolean;
      confidentiality: boolean;
      privacy: boolean;
    };
    evidenceCount: number;
    exceptions: any[];
  }> {
    // Security controls
    const securityControls = await this.checkSecurityControls();
    
    // Availability controls
    const availabilityControls = await this.checkAvailabilityControls(startDate, endDate);
    
    // Processing integrity controls
    const processingControls = await this.checkProcessingIntegrityControls(startDate, endDate);
    
    // Confidentiality controls
    const confidentialityControls = await this.checkConfidentialityControls();
    
    // Privacy controls
    const privacyControls = await this.checkPrivacyControls();

    // Count evidence records
    const evidenceCount = await prisma.auditLog.count({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    return {
      controls: {
        security: securityControls,
        availability: availabilityControls,
        processing: processingControls,
        confidentiality: confidentialityControls,
        privacy: privacyControls
      },
      evidenceCount,
      exceptions: [] // Would be populated based on control failures
    };
  }

  /**
   * Automated compliance monitoring
   */
  async runComplianceMonitoring(): Promise<void> {
    try {
      console.log('Starting automated compliance monitoring...');

      // Check data retention policies
      await this.enforceDataRetentionPolicies();

      // Check for encryption compliance
      await this.checkEncryptionStatus();

      // Check access control compliance
      await this.auditAccessControls();

      // Generate alerts for compliance issues
      await this.generateComplianceAlerts();

      console.log('Compliance monitoring completed successfully');
    } catch (error) {
      console.error('Error in compliance monitoring:', error);
    }
  }

  // Private helper methods

  private getDerivedKey(context?: string): Buffer {
    const password = config.getStripeConfig().secretKey || 'default-key';
    const salt = crypto.createHash('sha256').update(context || 'billing').digest();
    return crypto.pbkdf2Sync(password, salt, 100000, this.encryptionConfig.keyLength, 'sha512');
  }

  private async checkDataRetentionCompliance(): Promise<{
    compliant: boolean;
    issues: ComplianceIssue[];
    recommendations: string[];
  }> {
    const issues: ComplianceIssue[] = [];
    const recommendations: string[] = [];

    for (const policy of this.dataRetentionPolicies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

      let expiredCount = 0;

      switch (policy.dataType) {
        case 'customer_data':
          expiredCount = await prisma.organization.count({
            where: {
              createdAt: { lt: cutoffDate },
              status: { not: 'CANCELLED' }
            }
          });
          break;
        case 'audit_logs':
          expiredCount = await prisma.auditLog.count({
            where: {
              timestamp: { lt: cutoffDate }
            }
          });
          break;
      }

      if (expiredCount > 0) {
        issues.push({
          severity: 'MEDIUM',
          category: 'DATA_RETENTION',
          description: `${expiredCount} ${policy.dataType} records exceed retention period`,
          remediation: policy.anonymizationRequired 
            ? 'Anonymize expired records' 
            : 'Review and delete expired records',
          affectedRecords: expiredCount
        });
        recommendations.push(`Implement automated ${policy.dataType} retention policy enforcement`);
      }
    }

    return {
      compliant: issues.length === 0,
      issues,
      recommendations
    };
  }

  private async checkEncryptionCompliance(): Promise<{
    compliant: boolean;
    issues: ComplianceIssue[];
    recommendations: string[];
  }> {
    const issues: ComplianceIssue[] = [];
    const recommendations: string[] = [];

    // This would check if sensitive data is properly encrypted
    // Implementation would depend on your specific encryption strategy

    return {
      compliant: issues.length === 0,
      issues,
      recommendations
    };
  }

  private async checkAccessControlCompliance(): Promise<{
    compliant: boolean;
    issues: ComplianceIssue[];
    recommendations: string[];
  }> {
    const issues: ComplianceIssue[] = [];
    const recommendations: string[] = [];

    // Check for users without proper access controls
    // Implementation would check your RBAC system

    return {
      compliant: issues.length === 0,
      issues,
      recommendations
    };
  }

  private async performGDPRChecks(
    issues: ComplianceIssue[],
    recommendations: string[],
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Check for data processing without consent
    const organizationsWithoutConsent = await prisma.organization.count({
      where: {
        metadata: {
          path: ['gdprConsent'],
          equals: null
        }
      }
    });

    if (organizationsWithoutConsent > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'GDPR_CONSENT',
        description: `${organizationsWithoutConsent} organizations without GDPR consent records`,
        remediation: 'Implement consent tracking for all data processing activities',
        affectedRecords: organizationsWithoutConsent
      });
    }

    // Check for data deletion requests response time
    const pendingDeletionRequests = await prisma.organization.count({
      where: {
        metadata: {
          path: ['markedForDeletion'],
          equals: true
        },
        createdAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Older than 30 days
        }
      }
    });

    if (pendingDeletionRequests > 0) {
      issues.push({
        severity: 'CRITICAL',
        category: 'GDPR_DELETION',
        description: `${pendingDeletionRequests} data deletion requests exceeding 30-day response time`,
        remediation: 'Process pending deletion requests immediately',
        affectedRecords: pendingDeletionRequests
      });
    }
  }

  private async performPCIDSSChecks(
    issues: ComplianceIssue[],
    recommendations: string[]
  ): Promise<void> {
    const pciValidation = await this.validatePCICompliance();
    
    if (!pciValidation.compliant) {
      issues.push({
        severity: 'CRITICAL',
        category: 'PCI_DSS',
        description: 'PCI DSS compliance violations detected',
        remediation: 'Address all PCI DSS compliance issues immediately'
      });
      recommendations.push(...pciValidation.recommendations);
    }
  }

  private async performSOC2Checks(
    issues: ComplianceIssue[],
    recommendations: string[],
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const soc2Report = await this.generateSOC2Report(startDate, endDate);
    
    const failedControls = Object.entries(soc2Report.controls)
      .filter(([_, compliant]) => !compliant)
      .map(([control]) => control);

    if (failedControls.length > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'SOC2',
        description: `SOC 2 control failures: ${failedControls.join(', ')}`,
        remediation: 'Address all failed SOC 2 controls'
      });
    }
  }

  private async performSOXChecks(
    issues: ComplianceIssue[],
    recommendations: string[],
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Check for financial data integrity
    const invoicesWithoutAuditTrail = await prisma.invoice.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        // Check if there's corresponding audit log
      }
    });

    if (invoicesWithoutAuditTrail > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'SOX_AUDIT_TRAIL',
        description: `${invoicesWithoutAuditTrail} invoices without complete audit trail`,
        remediation: 'Ensure all financial transactions have complete audit trails',
        affectedRecords: invoicesWithoutAuditTrail
      });
    }
  }

  private async checkSecurityControls(): Promise<boolean> {
    // Implementation would check various security controls
    return true; // Placeholder
  }

  private async checkAvailabilityControls(startDate: Date, endDate: Date): Promise<boolean> {
    // Implementation would check system availability metrics
    return true; // Placeholder
  }

  private async checkProcessingIntegrityControls(startDate: Date, endDate: Date): Promise<boolean> {
    // Implementation would check data processing integrity
    return true; // Placeholder
  }

  private async checkConfidentialityControls(): Promise<boolean> {
    // Implementation would check confidentiality measures
    return true; // Placeholder
  }

  private async checkPrivacyControls(): Promise<boolean> {
    // Implementation would check privacy controls
    return true; // Placeholder
  }

  private async enforceDataRetentionPolicies(): Promise<void> {
    // Implementation would enforce data retention policies
  }

  private async checkEncryptionStatus(): Promise<void> {
    // Implementation would check encryption status
  }

  private async auditAccessControls(): Promise<void> {
    // Implementation would audit access controls
  }

  private async generateComplianceAlerts(): Promise<void> {
    // Implementation would generate compliance alerts
  }
}

export const billingCompliance = new BillingComplianceService();
