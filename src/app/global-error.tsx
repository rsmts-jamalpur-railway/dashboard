'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#000',
          color: '#fff',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ fontSize: '2.5rem', color: '#EF4444' }}>FATAL SYSTEM ERROR</h1>
          <p style={{ color: '#9CA3AF', marginBottom: '32px' }}>
            A catastrophic error prevented the application from loading.
          </p>
          <button 
            onClick={() => reset()}
            style={{
              backgroundColor: '#374151',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            REBOOT SYSTEM
          </button>
        </div>
      </body>
    </html>
  );
}
