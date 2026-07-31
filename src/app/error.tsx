'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg)',
      color: 'var(--color-text-primary)',
      padding: '24px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '2.5rem', margin: '0 0 16px 0', borderBottom: '4px solid var(--color-danger)', paddingBottom: '16px' }}>
        SYSTEM ERROR
      </h1>
      <h2 style={{ fontSize: '1.25rem', margin: '0 0 24px 0', fontWeight: '400', color: 'var(--color-danger)' }}>
        A critical error occurred while rendering this interface.
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', maxWidth: '600px' }}>
        {error.message || 'An unexpected error occurred in the React component tree.'}
      </p>
      <button 
        onClick={() => reset()}
        style={{
          backgroundColor: 'var(--color-primary-action)',
          color: 'white',
          padding: '12px 24px',
          fontWeight: '600',
          border: '1px solid #000',
          cursor: 'pointer'
        }}
      >
        RETRY OPERATION
      </button>
    </div>
  );
}
