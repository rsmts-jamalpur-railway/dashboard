'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?shop=WRS-5');
  }, [router]);

  return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
      <p style={{ fontSize: '14px', fontWeight: 600 }}>Switching to Quality Assurance (WRS-5) Command Center...</p>
    </div>
  );
}
