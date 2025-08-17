/**
 * Comprehensive Input Validation and Sanitization
 * Enterprise-grade security for all user inputs
 */

import validator from 'validator';
import crypto from 'crypto';

// Common regex patterns for validation
const PATTERNS = {
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  username: /^[a-zA-Z0-9_-]{3,30}$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  objectId: /^[0-9a-fA-F]{24}$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  phoneNumber: /^\+?[1-9]\d{1,14}$/,
  semver: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  base64: /^[A-Za-z0-9+/]+(=)*$/,
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
};

// Dangerous patterns that should be blocked
const DANGEROUS_PATTERNS = {
  sqlInjection: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(['"][\s]*;[\s]*--)/i,
    /(\/\*[\s\S]*?\*\/)/i,
    /(\bOR\b[\s]*[\w]*[\s]*=[\s]*[\w]*)/i,
    /(\bAND\b[\s]*[\w]*[\s]*=[\s]*[\w]*)/i
  ],
  xss: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ],
  commandInjection: [
    /[;&|`$(){}[\]]/,
    /\.\.\//,
    /\/etc\/passwd/i,
    /\/bin\//i,
    /cmd\.exe/i,
    /powershell/i
  ],
  ldapInjection: [
    /[()&|!>=<~*]/,
    /\\\\/
  ],
  xmlInjection: [
    /<!\[CDATA\[/i,
    /<!DOCTYPE/i,
    /<!ENTITY/i,
    /<\?xml/i
  ],
  pathTraversal: [
    /\.\.\//,
    /\.\.\\/g,
    /%2e%2e%2f/i,
    /%252e%252e%252f/i,
    /\.\.%2f/i,
    /%2e%2e%5c/i
  ]
};

// Common password patterns to reject
const WEAK_PASSWORDS = [
  'password', '123456', 'password123', 'admin', 'qwerty', 'letmein',
  'welcome', 'monkey', '1234567890', 'abc123', 'password1', '12345678',
  'qwerty123', 'dragon', 'master', 'login', 'passw0rd', 'football'
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: string;
}

interface ValidationOptions {
  allowEmpty?: boolean;
  minLength?: number;
  maxLength?: number;
  allowHtml?: boolean;
  customPattern?: RegExp;
  customValidator?: (value: string) => boolean;
  trim?: boolean;
  toLowerCase?: boolean;
  stripTags?: boolean;
}

/**
 * Basic HTML sanitizer for edge runtime compatibility
 */
function sanitizeHtmlBasic(html: string): string {
  // Define allowed tags and attributes
  const allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const allowedAttributes: Record<string, string[]> = {
    'a': ['href', 'target', 'rel']
  };

  // Remove all tags except allowed ones
  let sanitized = html.replace(/<([^>]+)>/g, (match, tagContent) => {
    const tagMatch = tagContent.match(/^\/?\s*([a-zA-Z0-9]+)(\s+.*)?$/);
    if (!tagMatch) return '';
    
    const tagName = tagMatch[1].toLowerCase();
    const isClosingTag = tagContent.startsWith('/');
    
    if (!allowedTags.includes(tagName)) {
      return '';
    }
    
    if (isClosingTag) {
      return `</${tagName}>`;
    }
    
    // For opening tags, check attributes
    const attributes = tagMatch[2] || '';
    const allowedAttrs = allowedAttributes[tagName] || [];
    
    if (allowedAttrs.length === 0 || !attributes.trim()) {
      return `<${tagName}>`;
    }
    
    // Basic attribute sanitization
    const cleanAttributes = attributes.replace(/([a-zA-Z]+)=["']([^"']*)["']/g, (attrMatch, attrName, attrValue) => {
      if (allowedAttrs.includes(attrName.toLowerCase())) {
        // Basic URL validation for href attributes
        if (attrName.toLowerCase() === 'href') {
          if (attrValue.startsWith('javascript:') || attrValue.startsWith('data:') || attrValue.includes('<script')) {
            return '';
          }
        }
        return `${attrName}="${attrValue.replace(/[<>'"]/g, '')}"`;
      }
      return '';
    }).trim();
    
    return cleanAttributes ? `<${tagName} ${cleanAttributes}>` : `<${tagName}>`;
  });
  
  // Remove any remaining script tags or event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  return sanitized;
}

/**
 * Input sanitization functions
 */
export function sanitizeInput(input: string, options: ValidationOptions = {}): string {
  if (typeof input !== 'string') {
    input = String(input || '');
  }

  let sanitized = input;

  // Trim whitespace by default
  if (options.trim !== false) {
    sanitized = sanitized.trim();
  }

  // Convert to lowercase if specified
  if (options.toLowerCase) {
    sanitized = sanitized.toLowerCase();
  }

  // Remove HTML tags if specified
  if (options.stripTags) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Sanitize HTML if HTML is allowed but needs cleaning
  if (options.allowHtml) {
    // Simple HTML sanitizer for edge runtime compatibility
    sanitized = sanitizeHtmlBasic(sanitized);
  } else {
    // Escape HTML entities for non-HTML content
    sanitized = validator.escape(sanitized);
  }

  return sanitized;
}

/**
 * Check for dangerous patterns in input
 */
export function containsDangerousPattern(input: string): {
  dangerous: boolean;
  patterns: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
} {
  const foundPatterns: string[] = [];
  let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Check for SQL injection patterns
  for (const pattern of DANGEROUS_PATTERNS.sqlInjection) {
    if (pattern.test(input)) {
      foundPatterns.push('SQL Injection');
      maxSeverity = 'critical';
    }
  }

  // Check for XSS patterns
  for (const pattern of DANGEROUS_PATTERNS.xss) {
    if (pattern.test(input)) {
      foundPatterns.push('XSS');
      if (maxSeverity !== 'critical') maxSeverity = 'high';
    }
  }

  // Check for command injection patterns
  for (const pattern of DANGEROUS_PATTERNS.commandInjection) {
    if (pattern.test(input)) {
      foundPatterns.push('Command Injection');
      if (maxSeverity !== 'critical' && maxSeverity !== 'high') maxSeverity = 'medium';
    }
  }

  // Check for LDAP injection patterns
  for (const pattern of DANGEROUS_PATTERNS.ldapInjection) {
    if (pattern.test(input)) {
      foundPatterns.push('LDAP Injection');
      if (maxSeverity !== 'critical' && maxSeverity !== 'high') maxSeverity = 'medium';
    }
  }

  // Check for XML injection patterns
  for (const pattern of DANGEROUS_PATTERNS.xmlInjection) {
    if (pattern.test(input)) {
      foundPatterns.push('XML Injection');
      if (maxSeverity !== 'critical' && maxSeverity !== 'high') maxSeverity = 'medium';
    }
  }

  // Check for path traversal patterns
  for (const pattern of DANGEROUS_PATTERNS.pathTraversal) {
    if (pattern.test(input)) {
      foundPatterns.push('Path Traversal');
      if (maxSeverity === 'low') maxSeverity = 'medium';
    }
  }

  return {
    dangerous: foundPatterns.length > 0,
    patterns: foundPatterns,
    severity: maxSeverity
  };
}

/**
 * Comprehensive input validation functions
 */
export const validateInput = {
  /**
   * Validate email address
   */
  email(email: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const sanitized = sanitizeInput(email, { ...options, toLowerCase: true, trim: true });

    if (!sanitized && !options.allowEmpty) {
      result.valid = false;
      result.errors.push('Email is required');
      return result;
    }

    if (sanitized) {
      if (!PATTERNS.email.test(sanitized) || !validator.isEmail(sanitized)) {
        result.valid = false;
        result.errors.push('Invalid email format');
      }

      if (sanitized.length > 254) {
        result.valid = false;
        result.errors.push('Email is too long');
      }

      // Check for disposable email domains
      const disposableDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
      const domain = sanitized.split('@')[1]?.toLowerCase();
      if (domain && disposableDomains.includes(domain)) {
        result.warnings.push('Disposable email detected');
      }
    }

    result.sanitized = sanitized;
    return result;
  },

  /**
   * Validate password strength
   */
  password(password: string, options: { minLength?: number } = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const minLength = options.minLength || 8;

    if (!password) {
      result.valid = false;
      result.errors.push('Password is required');
      return result;
    }

    // Length check
    if (password.length < minLength) {
      result.valid = false;
      result.errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (password.length > 128) {
      result.valid = false;
      result.errors.push('Password is too long');
    }

    // Complexity checks
    if (!/[a-z]/.test(password)) {
      result.valid = false;
      result.errors.push('Password must contain lowercase letters');
    }

    if (!/[A-Z]/.test(password)) {
      result.valid = false;
      result.errors.push('Password must contain uppercase letters');
    }

    if (!/\d/.test(password)) {
      result.valid = false;
      result.errors.push('Password must contain numbers');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      result.valid = false;
      result.errors.push('Password must contain special characters');
    }

    // Check for common weak passwords
    if (WEAK_PASSWORDS.some(weak => password.toLowerCase().includes(weak))) {
      result.valid = false;
      result.errors.push('Password is too common');
    }

    // Check for patterns
    if (/(.)\1{2,}/.test(password)) {
      result.warnings.push('Avoid repeating characters');
    }

    if (/^(?:password|123456|qwerty)/i.test(password)) {
      result.valid = false;
      result.errors.push('Password contains common patterns');
    }

    return result;
  },

  /**
   * Validate username
   */
  username(username: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const sanitized = sanitizeInput(username, { ...options, trim: true, toLowerCase: true });

    if (!sanitized && !options.allowEmpty) {
      result.valid = false;
      result.errors.push('Username is required');
      return result;
    }

    if (sanitized) {
      if (!PATTERNS.username.test(sanitized)) {
        result.valid = false;
        result.errors.push('Username can only contain letters, numbers, hyphens, and underscores');
      }

      if (sanitized.length < 3) {
        result.valid = false;
        result.errors.push('Username must be at least 3 characters long');
      }

      if (sanitized.length > 30) {
        result.valid = false;
        result.errors.push('Username must be no more than 30 characters long');
      }

      // Check for reserved usernames
      const reserved = ['admin', 'root', 'system', 'api', 'www', 'mail', 'support', 'help'];
      if (reserved.includes(sanitized)) {
        result.valid = false;
        result.errors.push('Username is reserved');
      }
    }

    result.sanitized = sanitized;
    return result;
  },

  /**
   * Validate URL
   */
  url(url: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const sanitized = sanitizeInput(url, { ...options, trim: true });

    if (!sanitized && !options.allowEmpty) {
      result.valid = false;
      result.errors.push('URL is required');
      return result;
    }

    if (sanitized) {
      if (!validator.isURL(sanitized, {
        protocols: ['http', 'https'],
        require_protocol: true,
        allow_underscores: false
      })) {
        result.valid = false;
        result.errors.push('Invalid URL format');
      }

      // Check for dangerous protocols
      if (/^(javascript|data|vbscript):/i.test(sanitized)) {
        result.valid = false;
        result.errors.push('Dangerous URL protocol detected');
      }

      // Warn about non-HTTPS URLs
      if (sanitized.startsWith('http://')) {
        result.warnings.push('Consider using HTTPS for better security');
      }
    }

    result.sanitized = sanitized;
    return result;
  },

  /**
   * Validate phone number
   */
  phoneNumber(phone: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const sanitized = sanitizeInput(phone, { ...options, trim: true });

    if (!sanitized && !options.allowEmpty) {
      result.valid = false;
      result.errors.push('Phone number is required');
      return result;
    }

    if (sanitized) {
      // Remove common formatting characters
      const cleaned = sanitized.replace(/[\s\-\(\)\.]/g, '');
      
      if (!PATTERNS.phoneNumber.test(cleaned)) {
        result.valid = false;
        result.errors.push('Invalid phone number format');
      }

      result.sanitized = cleaned;
    }

    return result;
  },

  /**
   * Validate JSON string
   */
  json(jsonString: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const sanitized = sanitizeInput(jsonString, { ...options, trim: true });

    if (!sanitized && !options.allowEmpty) {
      result.valid = false;
      result.errors.push('JSON is required');
      return result;
    }

    if (sanitized) {
      try {
        const parsed = JSON.parse(sanitized);
        
        // Check for dangerous object depth
        const maxDepth = 10;
        if (this.getObjectDepth(parsed) > maxDepth) {
          result.valid = false;
          result.errors.push('JSON object too deeply nested');
        }

        // Check for potentially dangerous properties
        const dangerousProps = ['__proto__', 'constructor', 'prototype'];
        if (this.containsDangerousProperties(parsed, dangerousProps)) {
          result.valid = false;
          result.errors.push('JSON contains dangerous properties');
        }

      } catch (error) {
        result.valid = false;
        result.errors.push('Invalid JSON format');
      }
    }

    result.sanitized = sanitized;
    return result;
  },

  /**
   * Validate general text input
   */
  text(text: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const sanitized = sanitizeInput(text, options);

    if (!sanitized && !options.allowEmpty) {
      result.valid = false;
      result.errors.push('Text is required');
      return result;
    }

    if (sanitized) {
      // Length validation
      if (options.minLength && sanitized.length < options.minLength) {
        result.valid = false;
        result.errors.push(`Text must be at least ${options.minLength} characters long`);
      }

      if (options.maxLength && sanitized.length > options.maxLength) {
        result.valid = false;
        result.errors.push(`Text must be no more than ${options.maxLength} characters long`);
      }

      // Pattern validation
      if (options.customPattern && !options.customPattern.test(sanitized)) {
        result.valid = false;
        result.errors.push('Text format is invalid');
      }

      // Custom validator
      if (options.customValidator && !options.customValidator(sanitized)) {
        result.valid = false;
        result.errors.push('Text failed custom validation');
      }

      // Check for dangerous patterns
      const dangerCheck = containsDangerousPattern(sanitized);
      if (dangerCheck.dangerous) {
        result.valid = false;
        result.errors.push(`Potentially dangerous content detected: ${dangerCheck.patterns.join(', ')}`);
      }
    }

    result.sanitized = sanitized;
    return result;
  },

  /**
   * Validate UUID
   */
  uuid(uuid: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const sanitized = sanitizeInput(uuid, { ...options, trim: true, toLowerCase: true });

    if (!sanitized && !options.allowEmpty) {
      result.valid = false;
      result.errors.push('UUID is required');
      return result;
    }

    if (sanitized && !PATTERNS.uuid.test(sanitized)) {
      result.valid = false;
      result.errors.push('Invalid UUID format');
    }

    result.sanitized = sanitized;
    return result;
  },

  /**
   * Helper methods
   */
  getObjectDepth(obj: any, depth = 0): number {
    if (typeof obj !== 'object' || obj === null || depth > 20) {
      return depth;
    }

    const depths = Object.values(obj).map(value => this.getObjectDepth(value, depth + 1));
    return Math.max(depth, ...depths);
  },

  containsDangerousProperties(obj: any, dangerousProps: string[]): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    for (const key in obj) {
      if (dangerousProps.includes(key)) {
        return true;
      }
      if (typeof obj[key] === 'object' && this.containsDangerousProperties(obj[key], dangerousProps)) {
        return true;
      }
    }

    return false;
  }
};

/**
 * Validate API request body
 */
export function validateRequestBody(
  body: any,
  schema: Record<string, ValidationOptions & { type: string; required?: boolean }>
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const sanitizedBody: any = {};

  for (const [field, config] of Object.entries(schema)) {
    const value = body[field];

    if (config.required && (value === undefined || value === null || value === '')) {
      result.valid = false;
      result.errors.push(`${field} is required`);
      continue;
    }

    if (value !== undefined && value !== null && value !== '') {
      let fieldResult: ValidationResult;

      switch (config.type) {
        case 'email':
          fieldResult = validateInput.email(value, config);
          break;
        case 'password':
          fieldResult = validateInput.password(value, config);
          break;
        case 'username':
          fieldResult = validateInput.username(value, config);
          break;
        case 'url':
          fieldResult = validateInput.url(value, config);
          break;
        case 'phone':
          fieldResult = validateInput.phoneNumber(value, config);
          break;
        case 'json':
          fieldResult = validateInput.json(value, config);
          break;
        case 'uuid':
          fieldResult = validateInput.uuid(value, config);
          break;
        case 'text':
        default:
          fieldResult = validateInput.text(value, config);
          break;
      }

      if (!fieldResult.valid) {
        result.valid = false;
        result.errors.push(...fieldResult.errors.map(err => `${field}: ${err}`));
      }

      result.warnings.push(...fieldResult.warnings.map(warn => `${field}: ${warn}`));
      sanitizedBody[field] = fieldResult.sanitized;
    }
  }

  result.sanitized = sanitizedBody;
  return result;
}

/**
 * Generate secure random tokens
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate cryptographic hash
 */
export function generateHash(input: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(input).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}