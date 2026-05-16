import { useState, useEffect, useRef } from 'react';

/**
 * Creates object URL from a Blob for display, revoking on cleanup.
 * Returns the URL string for use in <Image src={...} /> or similar.
 *
 * @param blob The Blob (or File) to display. Null/undefined = no photo.
 * @returns The object URL (string) for the blob, or null if no blob.
 */
export function usePhotoUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const prevRef = useRef<Blob | null | undefined>(undefined);

  useEffect(() => {
    // Skip if blob hasn't changed
    if (prevRef.current === blob) return;

    // Revoke previous URL
    if (url) {
      URL.revokeObjectURL(url);
    }

    // Create new URL
    if (blob instanceof Blob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      const newUrl = URL.createObjectURL(blob);
      setUrl(newUrl);
      prevRef.current = blob;
    } else {
      setUrl(null);
      prevRef.current = undefined;
    }

    return () => {
      // Cleanup on unmount — revoke current URL
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
    // We intentionally don't track 'url' as a dep to avoid re-revoke loops.
    // The effect runs when 'blob' changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  return url;
}
