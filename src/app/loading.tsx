export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '24px',
      height: '100%',
      width: '100%'
    }}>
      {/* Header Skeleton */}
      <div style={{
        height: '40px',
        width: '200px',
        backgroundColor: '#E5E7EB',
        animation: 'pulse 1.5s infinite ease-in-out'
      }} />

      {/* Grid Skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px'
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            height: '120px',
            backgroundColor: '#F3F4F6',
            border: '1px solid #D1D5DB',
            animation: 'pulse 1.5s infinite ease-in-out'
          }} />
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div style={{
        flex: 1,
        backgroundColor: '#F3F4F6',
        border: '1px solid #D1D5DB',
        animation: 'pulse 1.5s infinite ease-in-out'
      }} />
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
