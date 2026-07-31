/**
 * ────────────────────────────────────────────────────────────
 * API Client — Axios with JWT Auth Header + Silent Refresh
 * ────────────────────────────────────────────────────────────
 *
 * 📚 WHY BOTH COOKIES AND AUTHORIZATION HEADER?
 *
 * Cross-origin cookies between vercel.app (frontend) and
 * render.com (backend) are blocked by browsers due to SameSite
 * cookie policies. To ensure authentication always works, we
 * send the JWT in BOTH:
 *   1. HttpOnly cookie (withCredentials: true) — works same-origin
 *   2. Authorization: Bearer header — works cross-origin
 *
 * The server middleware checks both and uses whichever is present.
 * ────────────────────────────────────────────────────────────
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Request Interceptor — Attach JWT as Authorization header ─
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rideshare-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        const token = parsed?.state?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // localStorage parse error — ignore
    }
  }
  return config;
});

// ── Refresh Token Queue ─────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

function processQueue(error: AxiosError | null) {
  failedQueue.forEach((entry) => {
    if (error) {
      entry.reject(error);
    } else {
      entry.resolve(api(entry.config));
    }
  });
  failedQueue = [];
}

// ── Response Interceptor — Silent Refresh ───────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401 errors (not on auth endpoints)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login')
      || originalRequest?.url?.includes('/auth/register')
      || originalRequest?.url?.includes('/auth/refresh')
      || originalRequest?.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      isRefreshing = true;

      try {
        await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        // ⚠️ DO NOT redirect with window.location.href here!
        // That causes a full page reload loop. Just reject the
        // promise — the UI will handle the error gracefully.
        console.error('[API] Token refresh failed — user may need to re-login');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
