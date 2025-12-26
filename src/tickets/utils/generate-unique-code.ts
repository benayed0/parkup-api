import { randomBytes } from 'crypto';

/**
 * Character set for unique codes - excludes confusing characters:
 * - 0 and O (look similar)
 * - 1, I, and L (look similar)
 * Total: 32 characters for easy bit mapping
 */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a cryptographically secure unique code
 * @param length - Length of the code (default: 6)
 * @returns A random alphanumeric code
 *
 * With 6 characters and 32 possible values per character:
 * 32^6 = 1,073,741,824 possible combinations (~1 billion)
 */
export function generateUniqueCode(length: number = 6): string {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((byte) => CHARSET[byte % CHARSET.length])
    .join('');
}
