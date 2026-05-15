/**
 * Strip all HTML tags from a string.
 */
export function stripHtml(dirty: string): string {
  return dirty.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize text fields: trim, collapse whitespace, strip control chars.
 */
export function sanitizeTextField(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Sanitize a photo URL: only allow blob: and relative paths.
 */
export function sanitizePhotoUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('/')) return url;
  return '';
}

/**
 * Sanitize rich HTML: allow safe tags only.
 * Uses DOMPurify in browser, falls back to tag stripping on server.
 */
export function sanitizeRichHtml(dirty: string): string {
  if (typeof window === 'undefined') return stripHtml(dirty);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DOMPurify = require('dompurify');
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  } catch {
    return stripHtml(dirty);
  }
}

/**
 * Alias for sanitizeRichHtml — used by SafeHtml component.
 */
export function sanitizeHtml(dirty: string): string {
  return sanitizeRichHtml(dirty);
}