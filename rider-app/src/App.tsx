import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import LoginPage from './pages/Login';
import HomePage from './pages/Home';
import DriverHomePage from './pages/DriverHome';
import TripActivePage from './pages/TripActive';
import DriverTripActivePage from './pages/DriverTripActive';

function AuthGuard({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function GuestGuard({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('token');

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * RoleRouter: Routes to the correct home page based on user role.
 * Reads the role from localStorage (set at login time).
 */
function RoleBasedHome() {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user.role === 'DRIVER') {
        return <DriverHomePage />;
      }
    }
  } catch {
    // fallback to rider
  }
  return <HomePage />;
}

/**
 * RoleBasedTrip: Routes to the correct trip page based on user role.
 */
function RoleBasedTrip() {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user.role === 'DRIVER') {
        return <DriverTripActivePage />;
      }
    }
  } catch {
    // fallback to rider
  }
  return <TripActivePage />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestGuard>
              <LoginPage />
            </GuestGuard>
          }
        />
        <Route
          path="/"
          element={
            <AuthGuard>
              <RoleBasedHome />
            </AuthGuard>
          }
        />
        <Route
          path="/trip/:id"
          element={
            <AuthGuard>
              <RoleBasedTrip />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
