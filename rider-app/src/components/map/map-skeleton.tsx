/**
 * ────────────────────────────────────────────────────────────
 * MapSkeleton — Loading placeholder for the Leaflet map
 * ────────────────────────────────────────────────────────────
 *
 * 📚 WHAT IS A SKELETON?
 * A skeleton is a lightweight placeholder that mimics the shape
 * of real content while it's loading. Instead of showing a blank
 * space or a spinner, skeletons give users a visual preview of
 * what's coming — this makes the app FEEL faster (even though
 * the actual load time is the same).
 *
 * This is called "perceived performance" — a UX principle that
 * says FEELING fast is just as important as BEING fast.
 *
 * 📚 HOW IT WORKS:
 * - `animate-pulse` is a Tailwind class that creates a smooth
 *   opacity animation (fades in and out repeatedly)
 * - We draw fake UI elements (zoom buttons, search bar, pin)
 *   that match the real map's layout
 * - When the real MapView finishes loading, React's <Suspense>
 *   automatically swaps this skeleton out
 *
 * 📚 WHY A SEPARATE COMPONENT?
 * We use this skeleton in 3 places (rider dashboard, driver
 * dashboard, trip page), so making it reusable avoids copying
 * the same JSX three times — the DRY principle (Don't Repeat
 * Yourself).
 * ────────────────────────────────────────────────────────────
 */

export default function MapSkeleton() {
  return (
    <div className="w-full h-full bg-gray-100 relative overflow-hidden">
      {/* Pulsing background to signal "loading" */}
      <div className="absolute inset-0 animate-pulse">
        {/* Fake map grid lines */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Fake zoom controls (top-right, like real Leaflet) */}
      <div className="absolute top-3 right-3 flex flex-col gap-0.5 z-10">
        <div className="w-[30px] h-[30px] bg-white rounded-t-lg shadow-sm" />
        <div className="w-[30px] h-[30px] bg-white rounded-b-lg shadow-sm" />
      </div>

      {/* Fake center pin */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
        <div className="w-3 h-3 bg-indigo-300 rounded-full animate-pulse" />
        <div className="w-0.5 h-4 bg-indigo-200" />
      </div>

      {/* Loading text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-xs text-gray-500 font-medium">Loading map...</span>
      </div>

      {/* Fake road lines for visual interest */}
      <div className="absolute top-1/3 left-0 right-0 h-px bg-gray-200/60" />
      <div className="absolute top-0 bottom-0 left-1/4 w-px bg-gray-200/60" />
      <div className="absolute top-0 bottom-0 left-2/3 w-px bg-gray-200/40" />
    </div>
  );
}
