import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM encryption for sensitive data (billing keys etc.)
// Key must be 32 bytes (256 bits). Stored in env var BILLING_ENCRYPTION_KEY.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.BILLING_ENCRYPTION_KEY;
  if (!key) throw new Error('BILLING_ENCRYPTION_KEY not configured');
  // If key is hex-encoded (64 chars), decode it; otherwise use as-is padded/truncated to 32 bytes
  if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) {
    return Buffer.from(key, 'hex');
  }
  const buf = Buffer.alloc(32);
  buf.write(key);
  return buf;
}

/**
 * Encrypt a string. Returns base64-encoded `iv:ciphertext:tag`.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

/**
 * Decrypt a string produced by encrypt(). Input is `iv:ciphertext:tag`.
 * Returns null if decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(encoded: string): string | null {
  try {
    const parts = encoded.split(':');
    if (parts.length !== 3) return null;
    const key = getKey();
    const iv = Buffer.from(parts[0], 'base64');
    const ciphertext = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
