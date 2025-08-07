/**
 * Mutual TLS (mTLS) Authentication System
 * Implements service-to-service authentication with certificate management
 * Supports certificate lifecycle, validation, and secure communication
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash, createSign, createVerify, generateKeyPairSync, X509Certificate } from 'crypto';
import { z } from 'zod';
import { AuditLogger } from '../logging/audit-logger';

// Certificate Schema Definitions
export const CertificateSchema = z.object({
  certificateId: z.string().uuid(),
  commonName: z.string().min(1),
  organizationUnit: z.string().optional(),
  organization: z.string().optional(),
  locality: z.string().optional(),
  state: z.string().optional(),
  country: z.string().length(2).optional(),
  subjectAlternativeNames: z.array(z.string()).optional(),
  keyUsage: z.array(z.enum([
    'digitalSignature', 'keyEncipherment', 'keyAgreement',
    'certificateSigning', 'crlSigning', 'encipherOnly', 'decipherOnly'
  ])),
  extendedKeyUsage: z.array(z.enum([
    'serverAuth', 'clientAuth', 'codeSigning', 'emailProtection',
    'timeStamping', 'ocspSigning'
  ])).optional(),
  validFrom: z.date(),
  validTo: z.date(),
  serialNumber: z.string(),
  issuer: z.string(),
  fingerprint: z.string(),
  publicKey: z.string(),
  privateKey: z.string().optional(), // Only for owned certificates
  certificatePEM: z.string(),
  status: z.enum(['active', 'expired', 'revoked', 'pending']),
  createdAt: z.date(),
  revokedAt: z.date().optional(),
  revokedReason: z.string().optional(),
  metadata: z.record(z.any()),
  isCA: z.boolean(),
  pathLength: z.number().optional()
});

export const ServiceIdentitySchema = z.object({
  serviceId: z.string().uuid(),
  serviceName: z.string().min(1),
  serviceType: z.enum(['plugin', 'backend', 'frontend', 'gateway', 'external']),
  certificateId: z.string().uuid(),
  allowedPeers: z.array(z.string()), // Service IDs that this service can communicate with
  environment: z.enum(['development', 'staging', 'production']),
  namespace: z.string().min(1),
  endpoints: z.array(z.object({
    protocol: z.enum(['https', 'grpc']),
    host: z.string(),
    port: z.number().min(1).max(65535),
    path: z.string().optional()
  })),
  trustStore: z.array(z.string().uuid()), // Certificate IDs of trusted CAs
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastUsed: z.date().optional(),
  metadata: z.record(z.any())
});

export type Certificate = z.infer<typeof CertificateSchema>;
export type ServiceIdentity = z.infer<typeof ServiceIdentitySchema>;

export interface mTLSConfig {
  caPrivateKeyPath: string;
  caCertificatePath: string;
  certificateValidityDays: number;
  keySize: number;
  signatureAlgorithm: string;
  cipherSuites: string[];
  minimumTLSVersion: '1.2' | '1.3';
  certificateRevocationEnabled: boolean;
  ocspEnabled: boolean;
  crlUrl?: string;
  ocspUrl?: string;
}

export interface CertificateRequest {
  commonName: string;
  organizationUnit?: string;
  organization?: string;
  locality?: string;
  state?: string;
  country?: string;
  subjectAlternativeNames?: string[];
  keyUsage: Certificate['keyUsage'];
  extendedKeyUsage?: Certificate['extendedKeyUsage'];
  validityDays: number;
  isCA?: boolean;
  pathLength?: number;
}

export interface mTLSValidationResult {
  isValid: boolean;
  certificate: X509Certificate;
  chain: X509Certificate[];
  errors: string[];
  warnings: string[];
  details: {
    subject: string;
    issuer: string;
    serialNumber: string;
    validFrom: Date;
    validTo: Date;
    keyUsage: string[];
    extendedKeyUsage: string[];
    subjectAltNames: string[];
  };
  trustLevel: 'trusted' | 'untrusted' | 'self-signed' | 'unknown';
  riskScore: number;
}

export interface ServiceAuthRequest {
  serviceId: string;
  clientCertificate: string;
  targetService: string;
  operation: string;
  timestamp: Date;
  nonce: string;
  signature: string;
}

export interface ServiceAuthResult {
  authenticated: boolean;
  serviceIdentity: ServiceIdentity | null;
  permissions: string[];
  expiresAt: Date;
  errors: string[];
  metadata: {
    certificateFingerprint: string;
    authMethod: 'certificate' | 'jwt' | 'api_key';
    riskScore: number;
    trustLevel: string;
  };
}

export class mTLSAuthenticationSystem {
  private certificates: Map<string, Certificate> = new Map();
  private serviceIdentities: Map<string, ServiceIdentity> = new Map();
  private certificateRevocationList: Set<string> = new Set();
  private auditLogger: AuditLogger;
  private config: mTLSConfig;

  constructor(config: mTLSConfig) {
    this.config = config;
    this.auditLogger = new AuditLogger();
    this.initializeCertificateAuthority();
  }

  /**
   * Initialize Certificate Authority
   */
  private async initializeCertificateAuthority(): Promise<void> {
    // Check if CA certificate and key exist
    if (!existsSync(this.config.caCertificatePath) || !existsSync(this.config.caPrivateKeyPath)) {
      await this.createCertificateAuthority();
    }

    // Load CA certificate
    try {
      const caCertPEM = readFileSync(this.config.caCertificatePath, 'utf8');
      const caPrivateKey = readFileSync(this.config.caPrivateKeyPath, 'utf8');
      
      const caCert = new X509Certificate(caCertPEM);
      
      // Create CA certificate record
      const caCertificate: Certificate = {
        certificateId: crypto.randomUUID(),
        commonName: caCert.subject,
        validFrom: new Date(caCert.validFrom),
        validTo: new Date(caCert.validTo),
        serialNumber: caCert.serialNumber,
        issuer: caCert.issuer,
        fingerprint: caCert.fingerprint256,
        publicKey: caCert.publicKey.export({ format: 'pem', type: 'spki' }) as string,
        privateKey: caPrivateKey,
        certificatePEM: caCertPEM,
        status: 'active',
        keyUsage: ['certificateSigning', 'crlSigning'],
        createdAt: new Date(),
        metadata: { type: 'ca', source: 'internal' },
        isCA: true,
        pathLength: 0
      };

      this.certificates.set(caCertificate.certificateId, caCertificate);

      await this.auditLogger.logSecurityEvent({
        eventType: 'CA_INITIALIZED',
        certificateId: caCertificate.certificateId,
        details: { commonName: caCertificate.commonName }
      });
    } catch (error) {
      throw new Error(`Failed to initialize CA: ${error.message}`);
    }
  }

  /**
   * Create a new Certificate Authority
   */
  private async createCertificateAuthority(): Promise<void> {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: this.config.keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Create self-signed CA certificate
    const caCertPEM = await this.createSelfSignedCertificate({
      commonName: 'Portal Internal CA',
      organization: 'Portal Platform',
      organizationUnit: 'Security',
      country: 'US',
      keyUsage: ['certificateSigning', 'crlSigning'],
      validityDays: 3650, // 10 years
      isCA: true,
      pathLength: 0
    }, publicKey, privateKey);

    // Save CA certificate and private key
    writeFileSync(this.config.caCertificatePath, caCertPEM);
    writeFileSync(this.config.caPrivateKeyPath, privateKey);

    await this.auditLogger.logSecurityEvent({
      eventType: 'CA_CREATED',
      details: { certificatePath: this.config.caCertificatePath }
    });
  }

  /**
   * Issue a new certificate
   */
  async issueCertificate(request: CertificateRequest): Promise<Certificate> {
    // Generate key pair for the certificate
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: this.config.keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Get CA certificate and private key
    const caCertificate = this.getCACertificate();
    if (!caCertificate) {
      throw new Error('CA certificate not found');
    }

    // Create certificate
    const certificatePEM = await this.signCertificate(request, publicKey, caCertificate);
    const cert = new X509Certificate(certificatePEM);

    const certificate: Certificate = {
      certificateId: crypto.randomUUID(),
      commonName: request.commonName,
      organizationUnit: request.organizationUnit,
      organization: request.organization,
      locality: request.locality,
      state: request.state,
      country: request.country,
      subjectAlternativeNames: request.subjectAlternativeNames,
      keyUsage: request.keyUsage,
      extendedKeyUsage: request.extendedKeyUsage,
      validFrom: new Date(cert.validFrom),
      validTo: new Date(cert.validTo),
      serialNumber: cert.serialNumber,
      issuer: cert.issuer,
      fingerprint: cert.fingerprint256,
      publicKey,
      privateKey,
      certificatePEM,
      status: 'active',
      createdAt: new Date(),
      metadata: { requestedBy: 'system' },
      isCA: request.isCA || false,
      pathLength: request.pathLength
    };

    // Validate certificate schema
    const validationResult = CertificateSchema.safeParse(certificate);
    if (!validationResult.success) {
      throw new Error(`Invalid certificate: ${validationResult.error.message}`);
    }

    // Store certificate
    this.certificates.set(certificate.certificateId, certificate);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'CERTIFICATE_ISSUED',
      certificateId: certificate.certificateId,
      details: {
        commonName: certificate.commonName,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        keyUsage: certificate.keyUsage
      }
    });

    return certificate;
  }

  /**
   * Create service identity with certificate
   */
  async createServiceIdentity(
    serviceName: string,
    serviceType: ServiceIdentity['serviceType'],
    certificateRequest: CertificateRequest,
    config: {
      allowedPeers: string[];
      environment: ServiceIdentity['environment'];
      namespace: string;
      endpoints: ServiceIdentity['endpoints'];
    }
  ): Promise<ServiceIdentity> {
    // Issue certificate for the service
    const certificate = await this.issueCertificate({
      ...certificateRequest,
      commonName: serviceName,
      keyUsage: ['digitalSignature', 'keyEncipherment'],
      extendedKeyUsage: ['serverAuth', 'clientAuth']
    });

    // Create service identity
    const serviceIdentity: ServiceIdentity = {
      serviceId: crypto.randomUUID(),
      serviceName,
      serviceType,
      certificateId: certificate.certificateId,
      allowedPeers: config.allowedPeers,
      environment: config.environment,
      namespace: config.namespace,
      endpoints: config.endpoints,
      trustStore: [this.getCACertificate()?.certificateId!], // Trust our CA
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    // Validate service identity schema
    const validationResult = ServiceIdentitySchema.safeParse(serviceIdentity);
    if (!validationResult.success) {
      throw new Error(`Invalid service identity: ${validationResult.error.message}`);
    }

    // Store service identity
    this.serviceIdentities.set(serviceIdentity.serviceId, serviceIdentity);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SERVICE_IDENTITY_CREATED',
      serviceId: serviceIdentity.serviceId,
      certificateId: certificate.certificateId,
      details: {
        serviceName,
        serviceType,
        environment: config.environment,
        endpoints: config.endpoints.length
      }
    });

    return serviceIdentity;
  }

  /**
   * Authenticate service using mTLS certificate
   */
  async authenticateService(request: ServiceAuthRequest): Promise<ServiceAuthResult> {
    try {
      // Validate and parse client certificate
      const validationResult = await this.validateCertificate(request.clientCertificate);
      if (!validationResult.isValid) {
        return {
          authenticated: false,
          serviceIdentity: null,
          permissions: [],
          expiresAt: new Date(),
          errors: validationResult.errors,
          metadata: {
            certificateFingerprint: '',
            authMethod: 'certificate',
            riskScore: 100,
            trustLevel: 'untrusted'
          }
        };
      }

      // Find service identity by certificate fingerprint
      const serviceIdentity = this.findServiceByCertificate(validationResult.certificate.fingerprint256);
      if (!serviceIdentity) {
        return {
          authenticated: false,
          serviceIdentity: null,
          permissions: [],
          expiresAt: new Date(),
          errors: ['Service identity not found'],
          metadata: {
            certificateFingerprint: validationResult.certificate.fingerprint256,
            authMethod: 'certificate',
            riskScore: 80,
            trustLevel: validationResult.trustLevel
          }
        };
      }

      // Check if service is active
      if (!serviceIdentity.isActive) {
        return {
          authenticated: false,
          serviceIdentity: null,
          permissions: [],
          expiresAt: new Date(),
          errors: ['Service identity is inactive'],
          metadata: {
            certificateFingerprint: validationResult.certificate.fingerprint256,
            authMethod: 'certificate',
            riskScore: 90,
            trustLevel: validationResult.trustLevel
          }
        };
      }

      // Verify signature (optional additional security)
      if (!await this.verifyRequestSignature(request, serviceIdentity)) {
        return {
          authenticated: false,
          serviceIdentity: null,
          permissions: [],
          expiresAt: new Date(),
          errors: ['Invalid request signature'],
          metadata: {
            certificateFingerprint: validationResult.certificate.fingerprint256,
            authMethod: 'certificate',
            riskScore: 85,
            trustLevel: validationResult.trustLevel
          }
        };
      }

      // Check peer authorization
      if (!this.isAuthorizedPeer(serviceIdentity, request.targetService)) {
        return {
          authenticated: false,
          serviceIdentity,
          permissions: [],
          expiresAt: new Date(),
          errors: ['Not authorized to access target service'],
          metadata: {
            certificateFingerprint: validationResult.certificate.fingerprint256,
            authMethod: 'certificate',
            riskScore: 70,
            trustLevel: validationResult.trustLevel
          }
        };
      }

      // Calculate expiration time (shorter of certificate expiry or session timeout)
      const certExpiry = new Date(validationResult.certificate.validTo);
      const sessionExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      const expiresAt = certExpiry < sessionExpiry ? certExpiry : sessionExpiry;

      // Generate permissions based on service type and configuration
      const permissions = this.generateServicePermissions(serviceIdentity, request.operation);

      // Update last used timestamp
      serviceIdentity.lastUsed = new Date();
      serviceIdentity.updatedAt = new Date();
      this.serviceIdentities.set(serviceIdentity.serviceId, serviceIdentity);

      // Audit log
      await this.auditLogger.logSecurityEvent({
        eventType: 'SERVICE_AUTHENTICATED',
        serviceId: serviceIdentity.serviceId,
        details: {
          serviceName: serviceIdentity.serviceName,
          targetService: request.targetService,
          operation: request.operation,
          certificateFingerprint: validationResult.certificate.fingerprint256,
          riskScore: validationResult.riskScore
        }
      });

      return {
        authenticated: true,
        serviceIdentity,
        permissions,
        expiresAt,
        errors: [],
        metadata: {
          certificateFingerprint: validationResult.certificate.fingerprint256,
          authMethod: 'certificate',
          riskScore: validationResult.riskScore,
          trustLevel: validationResult.trustLevel
        }
      };
    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        eventType: 'SERVICE_AUTH_ERROR',
        serviceId: request.serviceId,
        error: error.message,
        details: { operation: request.operation }
      });

      return {
        authenticated: false,
        serviceIdentity: null,
        permissions: [],
        expiresAt: new Date(),
        errors: [`Authentication error: ${error.message}`],
        metadata: {
          certificateFingerprint: '',
          authMethod: 'certificate',
          riskScore: 100,
          trustLevel: 'unknown'
        }
      };
    }
  }

  /**
   * Validate certificate chain and status
   */
  async validateCertificate(certificatePEM: string): Promise<mTLSValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const certificate = new X509Certificate(certificatePEM);
      const chain: X509Certificate[] = [certificate];

      // Basic certificate validation
      const now = new Date();
      if (now < new Date(certificate.validFrom)) {
        errors.push('Certificate is not yet valid');
      }
      if (now > new Date(certificate.validTo)) {
        errors.push('Certificate has expired');
      }

      // Check if certificate is revoked
      if (this.certificateRevocationList.has(certificate.serialNumber)) {
        errors.push('Certificate has been revoked');
      }

      // Verify certificate chain
      const chainValidation = await this.verifyCertificateChain(certificate);
      if (!chainValidation.isValid) {
        errors.push(...chainValidation.errors);
      }
      chain.push(...chainValidation.chain);

      // Check key usage
      const keyUsage = this.extractKeyUsage(certificate);
      if (!keyUsage.includes('digitalSignature')) {
        warnings.push('Certificate does not have digital signature usage');
      }

      // Calculate risk score
      let riskScore = 0;
      if (errors.length > 0) riskScore += 50;
      if (warnings.length > 0) riskScore += 20;
      if (this.isSelfSigned(certificate)) riskScore += 30;
      
      const trustLevel = this.determineTrustLevel(certificate, chainValidation);

      return {
        isValid: errors.length === 0,
        certificate,
        chain,
        errors,
        warnings,
        details: {
          subject: certificate.subject,
          issuer: certificate.issuer,
          serialNumber: certificate.serialNumber,
          validFrom: new Date(certificate.validFrom),
          validTo: new Date(certificate.validTo),
          keyUsage: keyUsage,
          extendedKeyUsage: this.extractExtendedKeyUsage(certificate),
          subjectAltNames: this.extractSubjectAltNames(certificate)
        },
        trustLevel,
        riskScore: Math.min(100, riskScore)
      };
    } catch (error) {
      return {
        isValid: false,
        certificate: null as any,
        chain: [],
        errors: [`Certificate parsing error: ${error.message}`],
        warnings: [],
        details: {
          subject: '',
          issuer: '',
          serialNumber: '',
          validFrom: new Date(0),
          validTo: new Date(0),
          keyUsage: [],
          extendedKeyUsage: [],
          subjectAltNames: []
        },
        trustLevel: 'unknown',
        riskScore: 100
      };
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(certificateId: string, reason: string): Promise<void> {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) {
      throw new Error(`Certificate ${certificateId} not found`);
    }

    // Update certificate status
    certificate.status = 'revoked';
    certificate.revokedAt = new Date();
    certificate.revokedReason = reason;

    // Add to revocation list
    this.certificateRevocationList.add(certificate.serialNumber);

    // Update certificate in storage
    this.certificates.set(certificateId, certificate);

    // Deactivate associated service identities
    for (const [serviceId, serviceIdentity] of this.serviceIdentities.entries()) {
      if (serviceIdentity.certificateId === certificateId) {
        serviceIdentity.isActive = false;
        serviceIdentity.updatedAt = new Date();
        this.serviceIdentities.set(serviceId, serviceIdentity);
      }
    }

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'CERTIFICATE_REVOKED',
      certificateId,
      details: {
        commonName: certificate.commonName,
        reason,
        revokedAt: certificate.revokedAt
      }
    });
  }

  /**
   * Renew a certificate
   */
  async renewCertificate(certificateId: string, validityDays?: number): Promise<Certificate> {
    const oldCertificate = this.certificates.get(certificateId);
    if (!oldCertificate) {
      throw new Error(`Certificate ${certificateId} not found`);
    }

    // Create renewal request
    const renewalRequest: CertificateRequest = {
      commonName: oldCertificate.commonName,
      organizationUnit: oldCertificate.organizationUnit,
      organization: oldCertificate.organization,
      locality: oldCertificate.locality,
      state: oldCertificate.state,
      country: oldCertificate.country,
      subjectAlternativeNames: oldCertificate.subjectAlternativeNames,
      keyUsage: oldCertificate.keyUsage,
      extendedKeyUsage: oldCertificate.extendedKeyUsage,
      validityDays: validityDays || this.config.certificateValidityDays,
      isCA: oldCertificate.isCA,
      pathLength: oldCertificate.pathLength
    };

    // Issue new certificate
    const newCertificate = await this.issueCertificate(renewalRequest);

    // Update service identities to use new certificate
    for (const [serviceId, serviceIdentity] of this.serviceIdentities.entries()) {
      if (serviceIdentity.certificateId === certificateId) {
        serviceIdentity.certificateId = newCertificate.certificateId;
        serviceIdentity.updatedAt = new Date();
        this.serviceIdentities.set(serviceId, serviceIdentity);
      }
    }

    // Mark old certificate as expired
    oldCertificate.status = 'expired';
    this.certificates.set(certificateId, oldCertificate);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'CERTIFICATE_RENEWED',
      certificateId: oldCertificate.certificateId,
      newCertificateId: newCertificate.certificateId,
      details: {
        commonName: newCertificate.commonName,
        validTo: newCertificate.validTo
      }
    });

    return newCertificate;
  }

  /**
   * Get certificate by ID
   */
  getCertificate(certificateId: string): Certificate | undefined {
    return this.certificates.get(certificateId);
  }

  /**
   * Get service identity by ID
   */
  getServiceIdentity(serviceId: string): ServiceIdentity | undefined {
    return this.serviceIdentities.get(serviceId);
  }

  /**
   * List all certificates
   */
  getCertificates(): Certificate[] {
    return Array.from(this.certificates.values());
  }

  /**
   * List all service identities
   */
  getServiceIdentities(): ServiceIdentity[] {
    return Array.from(this.serviceIdentities.values());
  }

  /**
   * Generate mTLS configuration for a service
   */
  generateServiceTLSConfig(serviceId: string): {
    cert: string;
    key: string;
    ca: string;
    requestCert: boolean;
    rejectUnauthorized: boolean;
    ciphers: string[];
    minVersion: string;
    maxVersion: string;
  } | null {
    const serviceIdentity = this.serviceIdentities.get(serviceId);
    if (!serviceIdentity) {
      return null;
    }

    const certificate = this.certificates.get(serviceIdentity.certificateId);
    const caCertificate = this.getCACertificate();
    
    if (!certificate || !caCertificate) {
      return null;
    }

    return {
      cert: certificate.certificatePEM,
      key: certificate.privateKey!,
      ca: caCertificate.certificatePEM,
      requestCert: true,
      rejectUnauthorized: true,
      ciphers: this.config.cipherSuites.join(':'),
      minVersion: `TLSv${this.config.minimumTLSVersion}`,
      maxVersion: 'TLSv1.3'
    };
  }

  // Private helper methods
  private getCACertificate(): Certificate | undefined {
    return Array.from(this.certificates.values()).find(cert => cert.isCA);
  }

  private async createSelfSignedCertificate(
    request: CertificateRequest,
    publicKey: string,
    privateKey: string
  ): Promise<string> {
    // This is a simplified implementation
    // In production, would use proper X.509 certificate creation library
    return `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKZZ... (mock certificate)
-----END CERTIFICATE-----`;
  }

  private async signCertificate(
    request: CertificateRequest,
    publicKey: string,
    caCertificate: Certificate
  ): Promise<string> {
    // This is a simplified implementation
    // In production, would use proper certificate signing
    return `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKZZ... (mock signed certificate)
-----END CERTIFICATE-----`;
  }

  private findServiceByCertificate(fingerprint: string): ServiceIdentity | undefined {
    for (const serviceIdentity of this.serviceIdentities.values()) {
      const certificate = this.certificates.get(serviceIdentity.certificateId);
      if (certificate?.fingerprint === fingerprint) {
        return serviceIdentity;
      }
    }
    return undefined;
  }

  private async verifyRequestSignature(request: ServiceAuthRequest, serviceIdentity: ServiceIdentity): Promise<boolean> {
    const certificate = this.certificates.get(serviceIdentity.certificateId);
    if (!certificate) {
      return false;
    }

    try {
      const verify = createVerify('RSA-SHA256');
      const signatureData = `${request.serviceId}:${request.targetService}:${request.operation}:${request.timestamp}:${request.nonce}`;
      verify.update(signatureData);
      verify.end();

      return verify.verify(certificate.publicKey, request.signature, 'base64');
    } catch {
      return false;
    }
  }

  private isAuthorizedPeer(serviceIdentity: ServiceIdentity, targetService: string): boolean {
    return serviceIdentity.allowedPeers.includes('*') || 
           serviceIdentity.allowedPeers.includes(targetService);
  }

  private generateServicePermissions(serviceIdentity: ServiceIdentity, operation: string): string[] {
    const permissions: string[] = [];
    
    // Basic permissions based on service type
    switch (serviceIdentity.serviceType) {
      case 'plugin':
        permissions.push('plugin:execute', 'sandbox:create', 'secret:read');
        break;
      case 'backend':
        permissions.push('api:access', 'database:read', 'secret:read');
        break;
      case 'gateway':
        permissions.push('route:forward', 'auth:validate', 'rate_limit:check');
        break;
    }

    // Add operation-specific permissions
    if (operation === 'read') {
      permissions.push('resource:read');
    } else if (operation === 'write') {
      permissions.push('resource:write');
    }

    return permissions;
  }

  private async verifyCertificateChain(certificate: X509Certificate): Promise<{
    isValid: boolean;
    chain: X509Certificate[];
    errors: string[];
  }> {
    const chain: X509Certificate[] = [];
    const errors: string[] = [];

    // Simplified chain validation
    // In production, would implement full chain verification
    const caCertificate = this.getCACertificate();
    if (caCertificate) {
      const caCert = new X509Certificate(caCertificate.certificatePEM);
      
      if (certificate.issuer === caCert.subject) {
        chain.push(caCert);
      } else {
        errors.push('Certificate not issued by trusted CA');
      }
    } else {
      errors.push('No trusted CA found');
    }

    return {
      isValid: errors.length === 0,
      chain,
      errors
    };
  }

  private extractKeyUsage(certificate: X509Certificate): string[] {
    // Simplified key usage extraction
    // In production, would parse certificate extensions properly
    return ['digitalSignature', 'keyEncipherment'];
  }

  private extractExtendedKeyUsage(certificate: X509Certificate): string[] {
    return ['serverAuth', 'clientAuth'];
  }

  private extractSubjectAltNames(certificate: X509Certificate): string[] {
    return certificate.subjectAltName?.split(',').map(s => s.trim()) || [];
  }

  private isSelfSigned(certificate: X509Certificate): boolean {
    return certificate.subject === certificate.issuer;
  }

  private determineTrustLevel(certificate: X509Certificate, chainValidation: any): mTLSValidationResult['trustLevel'] {
    if (chainValidation.isValid) {
      return 'trusted';
    }
    if (this.isSelfSigned(certificate)) {
      return 'self-signed';
    }
    return 'untrusted';
  }
}

export { mTLSAuthenticationSystem };