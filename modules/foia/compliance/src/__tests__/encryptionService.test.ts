/**
 * Encryption Service Tests
 * Tests AES-256-CBC encryption/decryption
 */

import { EncryptionService } from '../services/encryptionService';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt string data', () => {
      const plaintext = 'sensitive audit data';

      const { encrypted, iv } = encryptionService.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(iv).toBeDefined();
      expect(encrypted).not.toBe(plaintext);

      const decrypted = encryptionService.decrypt(encrypted, iv);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON objects', () => {
      const data = {
        event_id: 'event-123',
        user_id: 'user-456',
        metadata: {
          sensitive: 'information',
          nested: { data: true }
        }
      };

      const { encrypted, iv } = encryptionService.encrypt(data);

      expect(encrypted).toBeDefined();
      expect(iv).toBeDefined();

      const decrypted = encryptionService.decryptJSON(encrypted, iv);

      expect(decrypted).toEqual(data);
    });

    it('should use different IVs for each encryption', () => {
      const plaintext = 'same data';

      const result1 = encryptionService.encrypt(plaintext);
      const result2 = encryptionService.encrypt(plaintext);

      // Different IVs
      expect(result1.iv).not.toBe(result2.iv);

      // Different encrypted output
      expect(result1.encrypted).not.toBe(result2.encrypted);

      // But both decrypt to same plaintext
      expect(encryptionService.decrypt(result1.encrypted, result1.iv)).toBe(plaintext);
      expect(encryptionService.decrypt(result2.encrypted, result2.iv)).toBe(plaintext);
    });

    it('should fail to decrypt with wrong IV', () => {
      const plaintext = 'test data';
      const { encrypted, iv } = encryptionService.encrypt(plaintext);

      const wrongIv = 'wrong-iv-value-1234567890123456';

      expect(() => {
        encryptionService.decrypt(encrypted, wrongIv);
      }).toThrow();
    });

    it('should fail to decrypt with corrupted data', () => {
      const plaintext = 'test data';
      const { iv } = encryptionService.encrypt(plaintext);

      const corruptedData = 'corrupted-encrypted-data';

      expect(() => {
        encryptionService.decrypt(corruptedData, iv);
      }).toThrow();
    });
  });

  describe('generateKey', () => {
    it('should generate a random encryption key', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1.length).toBeGreaterThan(0);

      // Keys should be different
      expect(key1).not.toBe(key2);
    });
  });

  describe('isKeySet', () => {
    it('should check if encryption key is set', () => {
      const isSet = encryptionService.isKeySet();

      // Depends on environment variable
      // In tests, it uses default key
      expect(typeof isSet).toBe('boolean');
    });
  });
});
