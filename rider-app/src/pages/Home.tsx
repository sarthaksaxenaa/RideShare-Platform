import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

function HomePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Rider');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        if (user.name) setUserName(user.name);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a0e1a 100%)',
        padding: '24px',
        gap: '24px',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '24px',
          padding: '48px',
          textAlign: 'center',
          maxWidth: '500px',
          width: '100%',
        }}
      >
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>🚗</p>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}
        >
          Welcome, {userName}!
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '16px',
            marginBottom: '32px',
          }}
        >
          RideShare — Rider Dashboard
        </p>
        <p
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '14px',
            marginBottom: '32px',
            fontStyle: 'italic',
          }}
        >
          Full dashboard coming in Phase 2
        </p>
        <button
          onClick={handleLogout}
          style={{
            padding: '12px 32px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#fca5a5',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default HomePage;
