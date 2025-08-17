/**
 * Secure ID Generation Utilities
 * Provides cryptographically secure identifier generation for various use cases
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Generate cryptographically secure random ID with optional prefix
 */
export function generateSecureId(prefix?: string, length: number = 24): string {
  const buffer = randomBytes(Math.ceil(length / 2));
  const randomId = buffer.toString('hex').substring(0, length);
  
  return prefix ? `${prefix}_${randomId}` : randomId;
}

/**
 * Generate UUID v4 (random UUID)
 */
export function generateUUID(): string {
  const bytes = randomBytes(16);
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = bytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

/**
 * Generate short ID (URL-safe, base62)
 */
export function generateShortId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
}

/**
 * Generate tenant-specific identifiers
 */
export function generateTenantId(): string {
  return generateSecureId('tenant', 16);
}

export function generateUserId(): string {
  return generateSecureId('user', 16);
}

export function generatePluginId(): string {
  return generateSecureId('plugin', 16);
}

export function generateApiKey(): string {
  return generateSecureId('sk', 32); // Secret key format
}

export function generateSessionToken(): string {
  return generateSecureId('sess', 48);
}

export function generateSetupToken(): string {
  return generateSecureId('setup', 32);
}

/**
 * Generate deterministic ID from input (for consistent IDs)
 */
export function generateDeterministicId(input: string, prefix?: string): string {
  const hash = createHash('sha256').update(input).digest('hex').substring(0, 16);
  return prefix ? `${prefix}_${hash}` : hash;
}

/**
 * Validate ID format
 */
export function validateIdFormat(id: string, expectedPrefix?: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  if (expectedPrefix) {
    if (!id.startsWith(`${expectedPrefix}_`)) {
      return false;
    }
    const idPart = id.substring(expectedPrefix.length + 1);
    return /^[a-f0-9]{16,}$/.test(idPart);
  }
  
  // General hex format validation
  return /^[a-f0-9]{16,}$/.test(id);
}

/**
 * Generate API key with specific format and metadata
 */
export function generateApiKeyWithMetadata(tenantId: string, userId: string): {
  key: string;
  keyId: string;
  hashedKey: string;
} {
  const keyId = generateShortId(8);
  const key = `sk_${keyId}_${generateSecureId('', 32)}`;
  const hashedKey = createHash('sha256').update(key).digest('hex');
  
  return {
    key,
    keyId,
    hashedKey
  };
}

/**
 * Generate verification codes
 */
export function generateVerificationCode(length: number = 6): string {
  const bytes = randomBytes(length);
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += (bytes[i] % 10).toString();
  }
  
  return code;
}

/**
 * Generate secure password
 */
export function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[randomBytes(1)[0] % lowercase.length];
  password += uppercase[randomBytes(1)[0] % uppercase.length];
  password += numbers[randomBytes(1)[0] % numbers.length];
  password += symbols[randomBytes(1)[0] % symbols.length];
  
  // Fill remaining length with random characters
  for (let i = 4; i < length; i++) {
    password += allChars[randomBytes(1)[0] % allChars.length];
  }
  
  // Shuffle the password
  return password.split('').sort(() => randomBytes(1)[0] - 128).join('');
}

/**
 * Generate slug from text (URL-friendly identifier)
 */
export function generateSlug(text: string, maxLength: number = 50): string {
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength).replace(/-[^-]*$/, '');
  }
  
  // Ensure uniqueness by appending random suffix if needed
  if (slug.length === 0) {
    slug = 'item';
  }
  
  return slug;
}

/**
 * Generate unique slug with collision detection
 */
export function generateUniqueSlug(baseText: string, existingSlugs: string[] = []): string {
  let slug = generateSlug(baseText);
  let counter = 1;
  const originalSlug = slug;
  
  while (existingSlugs.includes(slug)) {
    slug = `${originalSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

export default {
  generateSecureId,
  generateUUID,
  generateShortId,
  generateTenantId,
  generateUserId,
  generatePluginId,
  generateApiKey,
  generateSessionToken,
  generateSetupToken,
  generateDeterministicId,
  validateIdFormat,
  generateApiKeyWithMetadata,
  generateVerificationCode,
  generateSecurePassword,
  generateSlug,
  generateUniqueSlug
};