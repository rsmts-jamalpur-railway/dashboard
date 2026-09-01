'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { FiMenu, FiSearch, FiLogOut } from 'react-icons/fi';
import classes from './Header.module.css';

export default function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/assets?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className={classes.header}>
      <div className={classes.left}>
        <button onClick={toggleSidebar} className={classes.menuBtn}>
          <FiMenu size={20} />
        </button>
        <div className={classes.searchContainer}>
          <span className={classes.searchIcon}><FiSearch /></span>
          <input 
            type="text" 
            placeholder="Search Wagons & press Enter..." 
            className={classes.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>
      
      <div className={classes.right}>
        <button className={classes.iconBtn} title="Notifications">
          🔔
        </button>
        
        <div className={classes.userProfile} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {user?.role ? user.role.replace('_', ' ') : 'Admin'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Location: {user?.assignedLocationId || 'Global'}
          </div>
        </div>

        <button className={classes.logoutBtn} onClick={logout} title="Logout" style={{ marginLeft: '16px' }}>
          Logout
        </button>
      </div>
    </header>
  );
}
