'use client';

// ---------------------------------------------------------------------------
// ErrorLogViewer — expandable error log viewer for the Settings page
// ---------------------------------------------------------------------------
// Shows recent errors with expandable stack traces, copy-to-clipboard
// button for sharing with support, and a clear-log button.

import { useState, useEffect, useCallback } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  getRecentErrors,
  clearLog,
  type ErrorLogEntry,
} from '@/lib/errorLog';
import { isReportingEnabled } from '@/lib/errorReporter';

export function ErrorLogViewer() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  const reportingEnabled = isReportingEnabled();

  const loadErrors = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getRecentErrors(50);
      setErrors(entries);
    } catch {
      // IndexedDB unavailable — leave empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (entry: ErrorLogEntry) => {
    const text = [
      `[${new Date(entry.timestamp).toISOString()}] ${entry.message}`,
      entry.stack ? `\nStack:\n${entry.stack}` : '',
      entry.componentStack
        ? `\nComponent Stack:\n${entry.componentStack}`
        : '',
      `\nURL: ${entry.url}`,
      `\nUA: ${entry.userAgent}`,
    ].join('');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id ?? null);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearLog();
      setErrors([]);
      setClearDone(true);
      setTimeout(() => setClearDone(false), 3000);
    } catch {
      // Silently fail
    } finally {
      setClearing(false);
    }
  };

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();

    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3_600_000) {
      const mins = Math.floor(diffMs / 60_000);
      return `${mins}m ago`;
    }
    if (diffMs < 86_400_000) {
      const hrs = Math.floor(diffMs / 3_600_000);
      return `${hrs}h ago`;
    }
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Error Log</h3>
          {!loading && errors.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              {errors.length}
            </span>
          )}
          {reportingEnabled && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              Reporting on
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadErrors}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {errors.length > 0 && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Clear all errors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Clear confirmation */}
      {clearDone && (
        <div className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Error log cleared.
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-sm text-gray-400">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Loading error log...
        </div>
      )}

      {/* Empty state */}
      {!loading && errors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <CheckCircle2 className="mb-2 h-8 w-8 text-green-300" />
          <p className="text-sm font-medium">No errors recorded</p>
          <p className="mt-1 text-xs">
            Errors from error boundaries and unhandled rejections will appear
            here.
          </p>
        </div>
      )}

      {/* Error list */}
      {!loading && errors.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="divide-y divide-gray-100">
            {errors.map((entry) => {
              const isExpanded = expandedIds.has(entry.id ?? -1);
              const isCopied = copiedId === entry.id;

              return (
                <div key={entry.id ?? entry.timestamp}>
                  {/* Summary row */}
                  <button
                    onClick={() => toggleExpand(entry.id ?? -1)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="mt-0.5 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </span>

                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.message}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {formatTime(entry.timestamp)}
                        </span>
                        {entry.context?.type != null && (
                          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            {String(entry.context!.type)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(entry);
                      }}
                      className="flex-shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title={isCopied ? 'Copied!' : 'Copy to clipboard'}
                    >
                      {isCopied ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-3">
                      {entry.stack && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-gray-500 mb-1">
                            Stack Trace
                          </p>
                          <pre className="whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs text-gray-700 font-mono max-h-48 overflow-auto">
                            {entry.stack}
                          </pre>
                        </div>
                      )}

                      {entry.componentStack && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-gray-500 mb-1">
                            Component Stack
                          </p>
                          <pre className="whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs text-gray-700 font-mono max-h-48 overflow-auto">
                            {entry.componentStack}
                          </pre>
                        </div>
                      )}

                      {entry.context && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-gray-500 mb-1">
                            Context
                          </p>
                          <pre className="whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs text-gray-700 font-mono max-h-32 overflow-auto">
                            {JSON.stringify(entry.context, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 space-y-0.5">
                        <p>
                          <span className="font-medium">URL:</span>{' '}
                          {entry.url}
                        </p>
                        <p>
                          <span className="font-medium">Time:</span>{' '}
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                        <p className="truncate">
                          <span className="font-medium">UA:</span>{' '}
                          {entry.userAgent}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}