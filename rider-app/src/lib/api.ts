/**
 * ────────────────────────────────────────────────────────────
 * API Client — Axios Instance with Cookie-Based Auth
 * ────────────────────────────────────────────────────────────
 *
 * 📚 HOW AUTHENTICATION WORKS NOW:
 *
 * BEFORE (insecure):
 *   1. Login → server sends JWT in response body
 *   2. Frontend stores JWT in localStorage
 *   3. Every request → read from localStorage → set Authorization header
 *   ❌ Problem: Any XSS attack can steal the token via JavaScript
 *
 * AFTER (secure):
 *   1. Login → server sets JWT as HttpOnly cookie
 *   2. Frontend stores NOTHING (cookie is managed by the browser)
 *   3. Every request → browser automatically sends the cookie
 *   ✅ Secure: JavaScript CANNOT read HttpOnly cookies
 *
 * 📚 WHAT IS `withCredentials`?
 * By default, browsers don't send cookies on cross-origin requests.
 * Since our frontend (localhost:3000) and backend (localhost:3001)
 * are on different ports (= different origins), we need:
 *   - Frontend: `withCredentials: true` on axios
 *   - Backend: `credentials: true` in CORS config
 * This tells the browser "yes, include cookies for this domain."
 * ────────────────────────────────────────────────────────────
 */

import axios from 'axios';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },

  /**
   * 📚 withCredentials: true
   * This single line is what makes HttpOnly cookie auth work.
   * Without it, the browser won't send the 'jwt' cookie to
   * our backend, and every request would return 401.
   */
  withCredentials: true,
});

// Handle 401s globally — auto-redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Don't redirect if already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
