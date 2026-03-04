/**
 * FOIA Encryption Service
 * Handles AES-256-CBC encryption/decryption for audit log payloads
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.AUDIT_ENCRYPTION_KEY || '';

/**
 * Encryption Service
 */
export class EncryptionService {
  private key: Buffer;

  constructor() {
    if (!ENCRYPTION_KEY) {
      console.warn('[EncryptionService] AUDIT_ENCRYPTION_KEY not set, using default (INSECURE for production)');
    }

    // Ensure key is exactly 32 bytes for AES-256
    const keyString = ENCRYPTION_KEY || 'default-insecure-key-change-me-32';
    this.key = crypto.scryptSync(keyString, 'salt', 32);
  }

  /**
   * Encrypt data using AES-256-CBC
   * Returns { encrypted: string, iv: string }
   */
  encrypt(data: string | object): { encrypted: string; iv: string } {
    try {
      // Convert object to JSON string if needed
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

      // Generate random initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      console.error('[EncryptionService] Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-CBC
   * Returns decrypted string
   */
  decrypt(encrypted: string, ivHex: string): string {
    try {
      // Convert IV from hex
      const iv = Buffer.from(ivHex, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[EncryptionService] Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Decrypt and parse JSON
   */
  decryptJSON<T = any>(encrypted: string, ivHex: string): T {
    const decrypted = this.decrypt(encrypted, ivHex);
    return JSON.parse(decrypted);
  }

  /**
   * Generate a secure encryption key
   * Use this to generate AUDIT_ENCRYPTION_KEY
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify encryption key is set
   */
  isKeySet(): boolean {
    return ENCRYPTION_KEY.length > 0;
  }
}
