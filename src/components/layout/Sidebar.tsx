'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import classes from './Sidebar.module.css';

import { 
  FiHome, FiSettings, FiLogOut, FiActivity, 
  FiUsers, FiDatabase, FiFileText 
} from 'react-icons/fi';

export default function Sidebar({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const isSystemAdmin = 
    user?.role === 'SYSTEM_ADMIN' || 
    (Array.isArray(user?.roles) && user.roles.includes('SYSTEM_ADMIN'));

  // Streamlined navigation focusing on Operations and System Control
  const operationItems = [
    { name: 'Command Center', path: '/', icon: <FiHome size={17} /> },
    { name: 'Analytics', path: '/analytics', icon: <FiActivity size={17} /> },
  ];

  const adminItems = [
    { name: 'Users', path: '/users', icon: <FiUsers size={17} /> },
    { name: 'Settings', path: '/settings', icon: <FiSettings size={17} /> },
  ];

  return (
    <aside className={`${classes.sidebar} ${isOpen ? classes.open : classes.closed}`}>
      <div 
        className={classes.logoContainer} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isOpen ? 'flex-start' : 'center', 
          padding: isOpen ? '16px' : '16px 0' 
        }}
      >
        <Image src="/logo_bg_removed.png" alt="RSMTS Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
        {isOpen && (
          <div style={{ marginLeft: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
              RSMTS
            </h2>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
              Jamalpur Workshop
            </div>
          </div>
        )}
      </div>
      
      <nav className={classes.nav}>
        {/* Section: Operations */}
        <div 
          style={{ 
            marginBottom: '4px', 
            paddingLeft: isOpen ? '16px' : '0', 
            fontSize: '11px', 
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: '#94A3B8', 
            textAlign: isOpen ? 'left' : 'center' 
          }}
        >
          {isOpen ? 'OPERATIONS' : '•••'}
        </div>

        {operationItems.map((item) => {
          const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`${classes.link} ${isActive ? classes.active : ''}`}
              title={item.name}
            >
              <span className={classes.icon}>{item.icon}</span>
              {isOpen && <span className={classes.name}>{item.name}</span>}
            </Link>
          );
        })}

        {/* Section: Administration & System */}
        <div 
          style={{ 
            marginTop: '20px', 
            marginBottom: '4px', 
            paddingLeft: isOpen ? '16px' : '0', 
            fontSize: '11px', 
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: '#94A3B8', 
            textAlign: isOpen ? 'left' : 'center' 
          }}
        >
          {isOpen ? 'ADMINISTRATION' : '•••'}
        </div>

        {adminItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`${classes.link} ${isActive ? classes.active : ''}`}
              title={item.name}
            >
              <span className={classes.icon}>{item.icon}</span>
              {isOpen && <span className={classes.name}>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User profile & Logout Footer */}
      <div 
        className={classes.footer} 
        style={{ 
          marginTop: 'auto', 
          padding: isOpen ? '16px' : '16px 0', 
          borderTop: '1px solid #F1F5F9',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px' 
        }}
      >
        {isOpen && user && (
          <div style={{ padding: '0 12px', fontSize: '11px' }}>
            <div style={{ fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name || 'System User'}
            </div>
            <div style={{ color: '#64748B', fontSize: '10px' }}>
              {user.role || (Array.isArray(user.roles) ? user.roles[0] : 'Admin')}
            </div>
          </div>
        )}

        <button 
          onClick={logout} 
          className={classes.link} 
          style={{ 
            background: 'transparent', 
            border: 'none', 
            cursor: 'pointer', 
            color: '#DC2626',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          title="Sign Out"
        >
          <span className={classes.icon}><FiLogOut size={16} /></span>
          {isOpen && <span className={classes.name} style={{ color: '#DC2626', fontWeight: 600 }}>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
