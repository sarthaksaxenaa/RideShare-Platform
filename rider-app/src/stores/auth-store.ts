/**
 * ────────────────────────────────────────────────────────────
 * Auth Store — Zustand (HttpOnly Cookie Edition)
 * ────────────────────────────────────────────────────────────
 *
 * 📚 WHAT CHANGED AND WHY:
 *
 * BEFORE: We stored both the JWT token AND user data in
 * localStorage. The token was readable by any JavaScript code,
 * meaning an XSS attack could steal it.
 *
 * AFTER: The JWT is stored in an HttpOnly cookie (set by the
 * server). This store ONLY keeps the user object for UI display
 * (name, email, role, avatar). The token is NEVER accessible
 * to JavaScript — the browser manages it automatically.
 *
 * 📚 WHAT'S STILL IN LOCALSTORAGE?
 * Only the user object (name, email, role) — NOT the token.
 * This is safe because:
 *   1. It contains no secrets (name/email are not sensitive)
 *   2. Even if someone modifies it, the server validates the
 *      HttpOnly cookie on every request, not the localStorage
 *   3. It's only used for displaying "Hello, Sarthak" in the UI
 *
 * 📚 WHY KEEP `token` IN THE INTERFACE?
 * For backwards compatibility — some components may reference
 * `token`. We keep it as null always. The actual auth token is
 * in the HttpOnly cookie, managed entirely by the browser.
 * ────────────────────────────────────────────────────────────
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '@/types/user';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null; // Always null — kept for interface compatibility
  isAuthenticated: boolean;

  // Actions
  login: (user: User, token?: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, _token?: string) => {
        // Token is now in an HttpOnly cookie — we don't store it
        // We only keep the user object for UI rendering
        set({ user, token: null, isAuthenticated: true });
      },

      logout: async () => {
        try {
          // Call the server to clear the HttpOnly cookie
          // (JavaScript can't clear HttpOnly cookies directly)
          await api.post('/auth/logout');
        } catch {
          // Even if the API call fails, clear local state
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (updates) =>
        set((state) => {
          const updatedUser = state.user ? { ...state.user, ...updates } : null;
          return { user: updatedUser };
        }),
    }),
    {
      name: 'rideshare-auth',
      partialize: (state) => ({
        user: state.user,
        // Don't persist token — it's in the HttpOnly cookie
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors
export const useUser = () => useAuthStore((s) => s.user);
export const useToken = () => useAuthStore((s) => s.token);
export const useIsDriver = () => useAuthStore((s) => s.user?.role === 'DRIVER');
export const useUserRole = (): UserRole => useAuthStore((s) => s.user?.role ?? 'RIDER');
