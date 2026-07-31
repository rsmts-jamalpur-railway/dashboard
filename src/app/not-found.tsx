import Link from 'next/link';

export default function NotFound() {
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
      <h1 style={{ fontSize: '4rem', margin: '0 0 16px 0', borderBottom: '4px solid var(--color-border)', paddingBottom: '16px' }}>
        404
      </h1>
      <h2 style={{ fontSize: '1.5rem', margin: '0 0 24px 0', fontWeight: '400' }}>
        PAGE NOT FOUND
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
        The workshop route you are looking for does not exist or has been removed.
      </p>
      <Link 
        href="/"
        style={{
          backgroundColor: 'var(--color-primary-action)',
          color: 'white',
          padding: '12px 24px',
          textDecoration: 'none',
          fontWeight: '600',
          border: '1px solid #000'
        }}
      >
        RETURN TO DASHBOARD
      </Link>
    </div>
  );
}
