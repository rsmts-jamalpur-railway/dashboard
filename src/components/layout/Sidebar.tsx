'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import classes from './Sidebar.module.css';

import { FiHome, FiSettings, FiLogOut, FiTool, FiBox, FiCheckSquare, FiAlertCircle, FiDatabase, FiUsers, FiActivity } from 'react-icons/fi';
import { FaTrainSubway } from 'react-icons/fa6';

export default function Sidebar({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';

  // Structure based on 10/10 Architecture (Placeholders for missing APIs)
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <FiHome /> },
    { name: 'Yard', path: '/yard', icon: <FaTrainSubway /> },
    { name: 'Repair', path: '/repair', icon: <FiTool /> },
    { name: 'Manufacturing', path: '/manufacturing', icon: <FiBox /> },
    { name: 'QA', path: '/qa', icon: <FiCheckSquare /> },
    { name: 'Exceptions', path: '/exceptions', icon: <FiAlertCircle /> },
  ];

  const systemItems = [
    { name: 'Users', path: '/system/users', icon: <FiUsers /> },
    { name: 'Roles', path: '/system/roles', icon: <FiSettings /> },
    { name: 'Sync Monitor', path: '/system/sync', icon: <FiActivity /> },
  ];

  return (
    <aside className={`${classes.sidebar} ${isOpen ? classes.open : classes.closed}`}>
      <div className={classes.logoContainer} style={{ display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', padding: isOpen ? '16px' : '16px 0' }}>
        <Image src="/logo_bg_removed.png" alt="RSMTS Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
        {isOpen && <h2 style={{ marginLeft: '12px', marginBottom: 0 }}>RSMTS</h2>}
      </div>
      
      <nav className={classes.nav}>
        <div style={{ marginBottom: '8px', paddingLeft: isOpen ? '16px' : '0', fontSize: '12px', color: '#6b7280', textAlign: isOpen ? 'left' : 'center' }}>
          OPERATIONS
        </div>
        {menuItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
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

        {isSystemAdmin && (
          <>
            <div style={{ marginTop: '24px', marginBottom: '8px', paddingLeft: isOpen ? '16px' : '0', fontSize: '12px', color: '#6b7280', textAlign: isOpen ? 'left' : 'center' }}>
              SYSTEM
            </div>
            {systemItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
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
          </>
        )}
      </nav>

      <div className={classes.footer} style={{ marginTop: 'auto', padding: isOpen ? '16px' : '16px 0', display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={logout} 
          className={classes.link} 
          style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: '#ef4444' }}
          title="Logout"
        >
          <span className={classes.icon}><FiLogOut /></span>
          {isOpen && <span className={classes.name} style={{ color: '#ef4444' }}>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

