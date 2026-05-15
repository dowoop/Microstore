'use client';

import React, { useMemo } from 'react';
import { sanitizeHtml } from '@/lib/security';

/**
 * Render sanitized HTML content safely.
 *
 * Use this instead of dangerouslySetInnerHTML when rendering user-provided
 * rich text (e.g., item descriptions). Input is sanitized through DOMPurify
 * before rendering.
 */
export function SafeHtml({
  html,
  className,
  as: Tag = 'div',
}: {
  html: string;
  className?: string;
  as?: React.ElementType;
}) {
  const sanitized = useMemo(() => sanitizeHtml(html), [html]);

  if (!sanitized) return null;

  return <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
