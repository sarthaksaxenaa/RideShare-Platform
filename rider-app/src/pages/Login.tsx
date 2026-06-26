import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import styles from './Login.module.css';

type Mode = 'signin' | 'signup';
type RoleOption = 'RIDER' | 'DRIVER';

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<RoleOption>('RIDER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // If ?logout param is present, clear session first
  useEffect(() => {
    if (searchParams.get('logout') === '1') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [searchParams]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your name.');
          setLoading(false);
          return;
        }
        const res = await api.post('/auth/register', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/', { replace: true });
      } else {
        const res = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password,
          role,
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      console.error('[Login] Error:', err);
      const axiosErr = err as { response?: { status?: number; data?: { message?: string; error?: string } } };
      const serverMessage = axiosErr?.response?.data?.message;
      const status = axiosErr?.response?.status;

      if (serverMessage) {
        setError(serverMessage);
      } else if (status === 403) {
        setError('Access denied. This email may be registered under a different role.');
      } else if (status === 401) {
        setError('Invalid email or password.');
      } else if (status === 404) {
        setError('No account found with this email. Please sign up first.');
      } else if (status) {
        setError(`Server error (${status}). Please try again.`);
      } else {
        setError('Cannot connect to server. Please check if the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isDriver = role === 'DRIVER';

  return (
    <div className={styles.page}>
      {/* ── Left Hero Panel ────────────────────── */}
      <div className={`${styles.hero} ${isDriver ? styles.heroDriver : ''}`}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroTagline}>
            {isDriver
              ? 'Drive with purpose — earn on your schedule.'
              : 'Real-time rides, real-time trust.'}
          </p>
          <h1 className={styles.heroHeading}>
            {isDriver ? (
              <>
                Earn on<br />
                your terms
              </>
            ) : (
              <>
                Book rides<br />
                instantly
              </>
            )}
          </h1>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>10K+</span>
              <span className={styles.heroStatLabel}>Active Riders</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>99.9%</span>
              <span className={styles.heroStatLabel}>Uptime</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>4.9★</span>
              <span className={styles.heroStatLabel}>Rating</span>
            </div>
          </div>
        </div>
        <div className={styles.heroFooter}>
          © {new Date().getFullYear()} RideShare Inc.
        </div>
      </div>

      {/* ── Right Form Panel ───────────────────── */}
      <div className={styles.formPanel}>
        {/* Top bar: logo + toggle */}
        <div className={styles.formTopBar}>
          <div className={styles.brand}>
            <img src="/favicon.png" alt="RideShare" className={styles.brandIcon} />
            <span className={styles.brandName}>RideShare</span>
          </div>
          <button className={styles.modeToggleTop} onClick={toggleMode}>
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        {/* Form card */}
        <div className={styles.formBody}>
          <h2 className={styles.formTitle}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>

          {/* Role Selector */}
          <div className={styles.roleSelector}>
            <button
              type="button"
              className={`${styles.roleBtn} ${role === 'RIDER' ? styles.roleBtnActive : ''}`}
              onClick={() => setRole('RIDER')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Rider
            </button>
            <button
              type="button"
              className={`${styles.roleBtn} ${role === 'DRIVER' ? styles.roleBtnActive : ''}`}
              onClick={() => setRole('DRIVER')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
                <path d="M16 8h4l3 5v5h-7V8z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              Driver
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className={styles.errorBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Name (signup only) */}
            {mode === 'signup' && (
              <div className={styles.inputGroup}>
                <label htmlFor="name" className={styles.label}>Full Name</label>
                <input
                  id="name"
                  type="text"
                  className={styles.input}
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </div>
            )}

            {/* Email */}
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Email Address</label>
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="password" className={styles.label}>Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className={styles.forgotLink}
                    onClick={() => showToast('Password reset will be available soon.')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={`${styles.submitBtn} ${isDriver ? styles.submitBtnDriver : ''}`}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or continue with</span>
            <span className={styles.dividerLine} />
          </div>

          {/* Social Buttons */}
          <div className={styles.socialRow}>
            <button
              type="button"
              className={styles.socialBtn}
              onClick={() => showToast('Google sign-in requires OAuth setup in .env')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
            <button
              type="button"
              className={styles.socialBtn}
              onClick={() => showToast('Apple sign-in requires OAuth setup in .env')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#111">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.53 8.82 9.27c1.28.07 2.16.72 2.91.76.96-.2 1.88-.76 2.96-.69 1.26.1 2.2.6 2.82 1.5-2.58 1.54-1.97 4.92.54 5.87-.45 1.18-.98 2.35-1.99 3.57zM12.03 9.2C11.88 7.15 13.5 5.45 15.43 5.3c.27 2.34-2.13 4.1-3.4 3.9z" />
              </svg>
              Apple
            </button>
          </div>

          {/* Bottom toggle */}
          <p className={styles.bottomToggle}>
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" className={styles.toggleLink} onClick={toggleMode}>
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <div className={styles.formFooter}>
          <span>© {new Date().getFullYear()} RideShare Inc.</span>
          <div className={styles.footerLinks}>
            <button onClick={() => showToast('Contact support: support@rideshare.app')}>Contact Us</button>
            <span>English</span>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {toast}
        </div>
      )}
    </div>
  );
}

export default LoginPage;
