'use client';

/**
 * 📚 NEXT.JS ERROR BOUNDARY (error.tsx)
 * ────────────────────────────────────────────────────────
 *
 * This file is a Next.js convention. When any component inside
 * the /dashboard route tree throws an unhandled error during
 * rendering, Next.js catches it and renders this component
 * instead of showing a white screen.
 *
 * HOW IT WORKS:
 * 1. A component crashes (e.g., API returns unexpected data)
 * 2. React's error boundary catches the error
 * 3. Next.js renders this error.tsx component
 * 4. User sees a friendly message with a "Try Again" button
 * 5. The `reset()` function re-renders the failed component
 *
 * WHY 'use client'?
 * Error boundaries MUST be client components because they use
 * React's useEffect and event handlers. Server components
 * can't catch client-side rendering errors.
 *
 * FILE PLACEMENT:
 * Placing this at /dashboard/error.tsx means it catches errors
 * for ALL pages under /dashboard/* (profile, trip, admin, etc.)
 * without affecting the login or landing pages.
 * ────────────────────────────────────────────────────────
 */

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error for debugging (visible in browser console)
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Error icon */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          An unexpected error occurred. This has been logged and we&apos;ll look into it.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Go Home
          </a>
        </div>

        {/* Technical details (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              Technical Details
            </summary>
            <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
