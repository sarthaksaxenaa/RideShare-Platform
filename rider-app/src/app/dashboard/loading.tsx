/**
 * 📚 NEXT.JS LOADING STATE (loading.tsx)
 * ────────────────────────────────────────────────────────
 *
 * This file is another Next.js convention. It automatically
 * renders while any page inside /dashboard is loading its
 * server-side data or being lazy-loaded.
 *
 * HOW IT WORKS:
 * 1. User navigates to /dashboard/profile
 * 2. Next.js starts loading the page component
 * 3. While loading, this loading.tsx renders as a placeholder
 * 4. Once the page is ready, it replaces the loading state
 *
 * This is equivalent to wrapping every page in a <Suspense>
 * with this component as the fallback — but Next.js does it
 * automatically when it finds a loading.tsx file.
 *
 * WHY NOT JUST A SPINNER?
 * A skeleton layout (matching the shape of the real content)
 * provides much better perceived performance than a centered
 * spinner. Users feel like the page is "almost ready" rather
 * than "still loading from scratch".
 * ────────────────────────────────────────────────────────
 */

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8 animate-pulse">
      {/* Greeting skeleton */}
      <div className="mb-4">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded-lg mb-2" />
        <div className="h-3.5 w-56 bg-gray-100 dark:bg-gray-800/60 rounded-lg" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Map placeholder */}
        <div className="lg:col-span-3 h-[400px] lg:h-[600px] rounded-2xl bg-gray-200 dark:bg-gray-800" />

        {/* Booking card placeholder */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4">
          <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-3.5 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          <div className="space-y-3 mt-6">
            <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
            <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
          </div>
          <div className="h-9 w-full bg-gray-100 dark:bg-gray-800 rounded-xl mt-4" />
          <div className="space-y-3 mt-6">
            <div className="h-16 w-full bg-gray-50 dark:bg-gray-800/50 rounded-xl" />
            <div className="h-16 w-full bg-gray-50 dark:bg-gray-800/50 rounded-xl" />
            <div className="h-16 w-full bg-gray-50 dark:bg-gray-800/50 rounded-xl" />
          </div>
          <div className="h-12 w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-xl mt-4" />
        </div>
      </div>
    </div>
  );
}
