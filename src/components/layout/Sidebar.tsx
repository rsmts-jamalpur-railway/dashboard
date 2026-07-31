'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import classes from './Sidebar.module.css';

import { FiHome, FiTrendingUp, FiBarChart2, FiTruck, FiUsers, FiMapPin, FiRadio, FiSettings } from 'react-icons/fi';
import { FaTrainSubway } from 'react-icons/fa6';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: <FiHome /> },
  { name: 'Analytics', path: '/analytics', icon: <FiTrendingUp /> },
  { name: 'Movement Reports', path: '/reports', icon: <FiBarChart2 /> },
  { name: 'Assets Master', path: '/assets', icon: <FaTrainSubway /> },
  { name: 'Users & Devices', path: '/users', icon: <FiUsers /> },
  { name: 'Locations', path: '/locations', icon: <FiMapPin /> },
  { name: 'Sync Monitor', path: '/sync', icon: <FiRadio /> },
  { name: 'Settings & Audit', path: '/settings', icon: <FiSettings /> },
];

export default function Sidebar({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname();

  return (
    <aside className={`${classes.sidebar} ${isOpen ? classes.open : classes.closed}`}>
      <div className={classes.logoContainer} style={{ display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', padding: isOpen ? '16px' : '16px 0' }}>
        <Image src="/logo_bg_removed.png" alt="RSMTS Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
        {isOpen && <h2 style={{ marginLeft: '12px', marginBottom: 0 }}>RSMTS</h2>}
      </div>
      <nav className={classes.nav}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
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
    </aside>
  );
}
