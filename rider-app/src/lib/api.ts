/**
 * ────────────────────────────────────────────────────────────
 * API Client — Axios with Silent Token Refresh
 * ────────────────────────────────────────────────────────────
 *
 * 📚 HOW THE REFRESH FLOW WORKS:
 *
 * 1. User makes an API call (e.g., GET /api/trips)
 * 2. Access token cookie has expired (15 min lifetime)
 * 3. Server returns 401 Unauthorized
 * 4. Our response interceptor catches this 401
 * 5. Interceptor calls POST /api/auth/refresh
 *    → The browser automatically sends the refresh token cookie
 *      (it has path: '/api/auth' so it's included)
 * 6. Server validates refresh token, issues new access token cookie
 * 7. Interceptor retries the ORIGINAL request → SUCCESS!
 *
 * The user never sees any interruption. The entire flow is invisible.
 *
 * 📚 QUEUE MECHANISM:
 * If multiple API calls fail simultaneously (common on page load),
 * we don't want 10 parallel refresh calls. We use a flag
 * (`isRefreshing`) and a queue (`failedQueue`) to:
 *  - Send only ONE refresh request
 *  - Queue all other failed requests
 *  - Retry them ALL after the refresh succeeds
 * ────────────────────────────────────────────────────────────
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // Send cookies cross-origin
});

// ── Refresh Token Queue ─────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

/**
 * Process all queued requests after a successful token refresh.
 * Each request is retried with the new access token (which is
 * automatically included via the cookie — no manual header work).
 */
function processQueue(error: AxiosError | null) {
  failedQueue.forEach((entry) => {
    if (error) {
      entry.reject(error);
    } else {
      // Retry the original request — the new access token cookie
      // is automatically sent by the browser
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

    // Only attempt refresh on 401 errors (not on login/register/refresh itself)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login')
      || originalRequest?.url?.includes('/auth/register')
      || originalRequest?.url?.includes('/auth/refresh')
      || originalRequest?.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      // Mark this request as already retried (prevent infinite loops)
      originalRequest._retry = true;

      if (isRefreshing) {
        // Another refresh is already in progress — queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      isRefreshing = true;

      try {
        // Call the refresh endpoint — browser sends the jwt_refresh cookie
        await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });

        // Refresh succeeded! Process all queued requests
        processQueue(null);

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — token expired or invalid
        processQueue(refreshError as AxiosError);

        // Redirect to login
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
