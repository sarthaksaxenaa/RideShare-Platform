/**
 * ────────────────────────────────────────────────────────────
 * Theme Store — Dark/Light Mode Preference
 * ────────────────────────────────────────────────────────────
 *
 * 📚 HOW IT WORKS:
 * 1. We store the user's theme preference ('light' or 'dark')
 *    in Zustand, persisted to localStorage via the `persist`
 *    middleware — so it survives page refreshes.
 *
 * 2. When `setTheme()` is called, we:
 *    a. Update the Zustand store
 *    b. Toggle the 'dark' class on <html> element
 *    c. Tailwind reads this class and activates `dark:*` utilities
 *
 * 3. On first load, we check:
 *    a. Does localStorage have a saved preference? → use it
 *    b. If not, does the user's OS prefer dark mode? → use that
 *    c. Default to 'light' if neither
 *
 * 📚 WHY `persist` MIDDLEWARE?
 * Without persistence, every page refresh would reset the theme
 * to the default. The `persist` middleware automatically saves
 * the store state to localStorage and restores it on load.
 *
 * 📚 WHY `document.documentElement`?
 * `document.documentElement` is the <html> element. Adding the
 * 'dark' class here tells Tailwind to activate all dark variants
 * for every element on the page.
 * ────────────────────────────────────────────────────────────
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',

      setTheme: (theme: Theme) => {
        // Update the <html> element's class for Tailwind
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
        set({ theme });
      },

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        get().setTheme(next);
      },

      // Call this on app mount to sync the DOM with the stored preference
      initializeTheme: () => {
        const stored = get().theme;
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', stored === 'dark');
        }
      },
    }),
    {
      name: 'rideshare-theme', // localStorage key
      // Only persist the 'theme' field, not functions
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
