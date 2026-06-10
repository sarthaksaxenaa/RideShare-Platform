import { useParams, useNavigate } from 'react-router-dom';

function TripActivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1a0a 0%, #0d1711 50%, #0a1a0e 100%)',
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
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</p>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #00d68f, #059669)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}
        >
          Trip Active
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Trip ID: {id}
        </p>
        <p
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '14px',
            marginBottom: '32px',
            fontStyle: 'italic',
          }}
        >
          Live trip tracking coming in Phase 3
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '12px 32px',
            background: 'rgba(0, 214, 143, 0.15)',
            border: '1px solid rgba(0, 214, 143, 0.3)',
            borderRadius: '12px',
            color: '#6ee7b7',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(0, 214, 143, 0.25)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(0, 214, 143, 0.15)';
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default TripActivePage;
