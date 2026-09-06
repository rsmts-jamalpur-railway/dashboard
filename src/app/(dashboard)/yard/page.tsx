'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function YardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?shop=NSY');
  }, [router]);

  return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
      <p style={{ fontSize: '14px', fontWeight: 600 }}>Switching to North Store Yard (NSY) Command Center...</p>
    </div>
  );
}
