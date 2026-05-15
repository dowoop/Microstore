'use client';

// ---------------------------------------------------------------------------
// ErrorLogViewer — expandable error log viewer for the Settings page
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Trash2,
  Bug,
  RefreshCw,
} from 'lucide-react';
import { getRecentErrors, clearLog } from '@/lib/errorLog';
import type { ErrorLogEntry } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString();
}

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  // Fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ErrorLogViewer() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load errors on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const entries = await getRecentErrors(50);
      if (!cancelled) {
        setErrors(entries);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Manual refresh
  const load = async () => {
    setLoading(true);
    const entries = await getRecentErrors(50);
    setErrors(entries);
    setLoading(false);
  };

  // Toggle expand
  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy stack
  const handleCopy = async (entry: ErrorLogEntry) => {
    const text = [
      `Time: ${formatTime(entry.timestamp)}`,
      `Message: ${entry.message}`,
      `URL: ${entry.url}`,
      `User-Agent: ${entry.userAgent}`,
      entry.stack ? `\nStack:\n${entry.stack}` : '',
      entry.context ? `\nContext: ${entry.context}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const ok = await copyToClipboard(text);
    if (ok && entry.id != null) {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Clear all
  const handleClear = async () => {
    await clearLog();
    setErrors([]);
    setShowClearConfirm(false);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Error Log
      </h2>

      <div className="rounded-lg border border-gray-200 bg-white">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Bug className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-700">
              {errors.length > 0
                ? `${errors.length} error${errors.length !== 1 ? 's' : ''}`
                : 'No errors recorded'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            {errors.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Clear error log"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error list or empty state */}
        {errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <AlertTriangle className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No errors recorded</p>
            <p className="mt-1 text-xs">
              App errors will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {errors.map((entry) => {
              const isExpanded =
                entry.id != null && expanded.has(entry.id);
              const wasCopied = entry.id != null && copiedId === entry.id;

              return (
                <div key={entry.id} className="px-4 py-3">
                  {/* Summary row */}
                  <button
                    onClick={() =>
                      entry.id != null && toggleExpand(entry.id)
                    }
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span className="mt-0.5 flex-shrink-0 text-gray-400">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.message}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {formatTime(entry.timestamp)} · {entry.url}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(entry);
                      }}
                      className="ml-2 flex-shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Copy error details"
                    >
                      {wasCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-6 space-y-2 text-xs">
                      {entry.stack && (
                        <div>
                          <p className="font-medium text-gray-500 mb-1">
                            Stack Trace
                          </p>
                          <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-gray-700 font-mono leading-relaxed whitespace-pre-wrap break-all">
                            {entry.stack}
                          </pre>
                        </div>
                      )}
                      {entry.context && (
                        <div>
                          <p className="font-medium text-gray-500 mb-1">
                            Context
                          </p>
                          <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-gray-700 font-mono whitespace-pre-wrap break-all">
                            {entry.context}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-1 text-gray-400">
                        <div>
                          <span className="font-medium">URL:</span>{' '}
                          {entry.url}
                        </div>
                        <div>
                          <span className="font-medium">User-Agent:</span>{' '}
                          <span className="break-all">
                            {entry.userAgent}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700 mb-2">
            Clear all {errors.length} error log entries? This cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
            >
              Yes, Clear All
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
