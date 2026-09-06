'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManufacturingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?pipeline=MANUFACTURING');
  }, [router]);

  return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
      <p style={{ fontSize: '14px', fontWeight: 600 }}>Switching to Manufacturing Lifecycle Command Center...</p>
    </div>
  );
}
