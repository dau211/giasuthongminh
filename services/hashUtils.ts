
/**
 * Generates a SHA-256 hash from a string (text or base64 file).
 * Used to identify unique content for caching purposes.
 */
export const computeContentHash = async (content: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
