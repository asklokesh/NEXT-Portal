/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { randomBytes } from 'crypto';
import { prisma } from '../db/client';
import { createAuditLog } from '../audit/service';
import type { User } from '@prisma/client';

// Type definitions for MFA
export type MFAMethod = 'TOTP' | 'SMS' | 'EMAIL' | 'BACKUP_CODE';

export interface TOTPSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAChallenge {
  id: string;
  type: MFAMethod;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface MFAVerification {
  challengeId: string;
  code: string;
  rememberDevice?: boolean;
}

/**
 * Generate TOTP secret and QR code for setup
 */
export const setupTOTP = async (user: User): Promise<TOTPSetup> => {
  // Generate a secure random secret (32 bytes = 256 bits)
  const secret = randomBytes(32).toString('base32');
  
  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () => 
    randomBytes(4).toString('hex').toUpperCase()
  );

  // Create QR code URL for authenticator apps
  const appName = process.env.MFA_ISSUER_NAME || 'IDP Platform';
  const qrCodeUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

  // Store hashed backup codes in database (don't store them plaintext)
  const bcrypt = await import('bcryptjs');
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 12))
  );

  // Update user with MFA settings (but don't enable until verified)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaSecret: secret,
      mfaBackupCodes: hashedBackupCodes,
      mfaEnabled: false, // Will be enabled after first successful verification
    }
  });

  await createAuditLog({
    action: 'mfa.totp_setup_initiated',
    resource: 'user',
    resourceId: user.id,
    userId: user.id,
    details: {
      method: 'TOTP',
      backupCodesGenerated: backupCodes.length
    },
    status: 'success'
  });

  return {
    secret,
    qrCodeUrl,
    backupCodes
  };
};

/**
 * Verify TOTP code during initial setup
 */
export const verifyTOTPSetup = async (user: User, code: string): Promise<boolean> => {
  try {
    if (!user.mfaSecret) {
      return false;
    }

    const isValid = await verifyTOTPCode(user.mfaSecret, code);
    
    if (isValid) {
      // Enable MFA for the user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaMethod: 'TOTP'
        }
      });

      await createAuditLog({
        action: 'mfa.totp_enabled',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        details: {
          method: 'TOTP'
        },
        status: 'success'
      });
    }

    return isValid;
  } catch (error) {
    console.error('TOTP setup verification failed:', error);
    return false;
  }
};

/**
 * Create MFA challenge for authentication
 */
export const createMFAChallenge = async (
  user: User, 
  method: MFAMethod = 'TOTP'
): Promise<MFAChallenge> => {
  const challengeId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const challenge: MFAChallenge = {
    id: challengeId,
    type: method,
    expiresAt,
    metadata: {}
  };

  // Store challenge in database
  await prisma.mfaChallenge.create({
    data: {
      id: challengeId,
      userId: user.id,
      method,
      expiresAt,
      metadata: challenge.metadata || {},
      completed: false
    }
  });

  // If SMS method, send SMS
  if (method === 'SMS' && user.phoneNumber) {
    const smsCode = Math.random().toString(10).slice(2, 8); // 6 digit code
    challenge.metadata = { smsCode };
    
    // Update challenge with SMS code
    await prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: { metadata: challenge.metadata }
    });

    // Send SMS (implement based on your SMS provider)
    await sendSMS(user.phoneNumber, `Your IDP Platform verification code is: ${smsCode}`);
  }

  await createAuditLog({
    action: 'mfa.challenge_created',
    resource: 'user',
    resourceId: user.id,
    userId: user.id,
    details: {
      challengeId,
      method,
      expiresAt
    },
    status: 'success'
  });

  return challenge;
};

/**
 * Verify MFA challenge
 */
export const verifyMFAChallenge = async (
  verification: MFAVerification
): Promise<{ success: boolean; userId?: string; error?: string }> => {
  try {
    // Get challenge from database
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: verification.challengeId },
      include: { user: true }
    });

    if (!challenge) {
      return { success: false, error: 'Invalid challenge' };
    }

    if (challenge.completed) {
      return { success: false, error: 'Challenge already used' };
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.mfaChallenge.delete({
        where: { id: verification.challengeId }
      });
      return { success: false, error: 'Challenge expired' };
    }

    const user = challenge.user;
    let isValid = false;

    switch (challenge.method) {
      case 'TOTP':
        if (!user.mfaSecret) {
          return { success: false, error: 'TOTP not configured' };
        }
        isValid = await verifyTOTPCode(user.mfaSecret, verification.code);
        break;

      case 'SMS':
        const smsCode = challenge.metadata?.smsCode;
        isValid = smsCode === verification.code;
        break;

      case 'BACKUP_CODE':
        isValid = await verifyBackupCode(user, verification.code);
        break;

      default:
        return { success: false, error: 'Unsupported MFA method' };
    }

    if (isValid) {
      // Mark challenge as completed
      await prisma.mfaChallenge.update({
        where: { id: verification.challengeId },
        data: { completed: true }
      });

      // If remember device is requested, create trusted device token
      if (verification.rememberDevice) {
        await createTrustedDevice(user.id);
      }

      await createAuditLog({
        action: 'mfa.challenge_verified',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        details: {
          challengeId: verification.challengeId,
          method: challenge.method,
          rememberDevice: verification.rememberDevice
        },
        status: 'success'
      });

      return { success: true, userId: user.id };
    } else {
      await createAuditLog({
        action: 'mfa.challenge_failed',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        details: {
          challengeId: verification.challengeId,
          method: challenge.method
        },
        status: 'failed'
      });

      return { success: false, error: 'Invalid verification code' };
    }
  } catch (error) {
    console.error('MFA verification failed:', error);
    return { success: false, error: 'Verification failed' };
  }
};

/**
 * Verify TOTP code using time-based algorithm
 */
const verifyTOTPCode = async (secret: string, code: string): Promise<boolean> => {
  try {
    // Use a TOTP library like 'otplib' in production
    // For now, we'll implement a basic version
    const window = parseInt(process.env.TOTP_WINDOW || '1');
    const timeStep = 30; // 30 seconds
    const currentTime = Math.floor(Date.now() / 1000 / timeStep);

    // Check current time and adjacent windows
    for (let i = -window; i <= window; i++) {
      const testTime = currentTime + i;
      const expectedCode = await generateTOTPCode(secret, testTime);
      if (expectedCode === code) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('TOTP verification failed:', error);
    return false;
  }
};

/**
 * Generate TOTP code for given time
 */
const generateTOTPCode = async (secret: string, time: number): Promise<string> => {
  const crypto = await import('crypto');
  
  // Convert time to 8-byte buffer
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(Math.floor(time / Math.pow(2, 32)), 0);
  timeBuffer.writeUInt32BE(time & 0xffffffff, 4);

  // Convert base32 secret to buffer
  const secretBuffer = Buffer.from(secret, 'base32');

  // Generate HMAC
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[19] & 0xf;
  const code = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  // Return 6-digit code
  return (code % Math.pow(10, 6)).toString().padStart(6, '0');
};

/**
 * Verify backup code
 */
const verifyBackupCode = async (user: User, code: string): Promise<boolean> => {
  if (!user.mfaBackupCodes || user.mfaBackupCodes.length === 0) {
    return false;
  }

  const bcrypt = await import('bcryptjs');
  
  for (let i = 0; i < user.mfaBackupCodes.length; i++) {
    const hashedCode = user.mfaBackupCodes[i];
    const isValid = await bcrypt.compare(code, hashedCode);
    
    if (isValid) {
      // Remove used backup code
      const updatedCodes = [...user.mfaBackupCodes];
      updatedCodes.splice(i, 1);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaBackupCodes: updatedCodes }
      });

      return true;
    }
  }

  return false;
};

/**
 * Create trusted device token
 */
const createTrustedDevice = async (userId: string): Promise<string> => {
  const deviceToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.trustedDevice.create({
    data: {
      token: deviceToken,
      userId,
      expiresAt,
      isActive: true
    }
  });

  return deviceToken;
};

/**
 * Send SMS (placeholder - implement with your SMS provider)
 */
const sendSMS = async (phoneNumber: string, message: string): Promise<void> => {
  // Implement SMS sending based on your provider (Twilio, AWS SNS, etc.)
  console.log(`SMS to ${phoneNumber}: ${message}`);
  
  // Example Twilio implementation:
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });
};

/**
 * Disable MFA for user
 */
export const disableMFA = async (user: User): Promise<boolean> => {
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaMethod: null,
        mfaBackupCodes: []
      }
    });

    // Clean up MFA challenges
    await prisma.mfaChallenge.deleteMany({
      where: { userId: user.id }
    });

    // Clean up trusted devices
    await prisma.trustedDevice.deleteMany({
      where: { userId: user.id }
    });

    await createAuditLog({
      action: 'mfa.disabled',
      resource: 'user',
      resourceId: user.id,
      userId: user.id,
      details: {},
      status: 'success'
    });

    return true;
  } catch (error) {
    console.error('Failed to disable MFA:', error);
    return false;
  }
};

/**
 * Check if device is trusted
 */
export const isTrustedDevice = async (userId: string, deviceToken: string): Promise<boolean> => {
  try {
    const device = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        token: deviceToken,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    return !!device;
  } catch (error) {
    console.error('Failed to check trusted device:', error);
    return false;
  }
};