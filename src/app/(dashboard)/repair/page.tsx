'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RepairPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?pipeline=REPAIR');
  }, [router]);

  return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
      <p style={{ fontSize: '14px', fontWeight: 600 }}>Switching to Repair Operations Command Center...</p>
    </div>
  );
}
