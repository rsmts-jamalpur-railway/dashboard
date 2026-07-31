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
        <div className={classes.welcome}>
          Welcome, <strong>{user?.full_name || 'Admin'}</strong>
        </div>
        <button className={classes.iconBtn} title="Notifications">
          🔔
        </button>
        <button className={classes.logoutBtn} onClick={logout} title="Logout">
          Logout
        </button>
      </div>
    </header>
  );
}
