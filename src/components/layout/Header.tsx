'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { FiMenu, FiSearch, FiX, FiBell, FiLogOut, FiCornerDownLeft } from 'react-icons/fi';
import classes from './Header.module.css';

export default function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut (Ctrl+K or /) to quickly focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== inputRef.current && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/assets?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleExecuteSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/assets?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <header className={classes.header}>
      <div className={classes.left}>
        <button onClick={toggleSidebar} className={classes.menuBtn} title="Toggle Navigation">
          <FiMenu size={18} />
        </button>

        {/* High-End Enterprise Search Bar */}
        <div className={`${classes.searchContainer} ${isFocused ? classes.searchContainerFocused : ''}`}>
          <span className={`${classes.searchIcon} ${isFocused ? classes.searchIconActive : ''}`}>
            <FiSearch size={16} />
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search Wagons (11-digit), Locos (5-digit), Cranes..."
            className={classes.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {searchQuery ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={handleClear}
                className={classes.clearBtn}
                title="Clear search"
              >
                <FiX size={14} />
              </button>
              <button
                type="button"
                onClick={handleExecuteSearch}
                className={classes.enterBtn}
                title="Press Enter to search"
              >
                <FiCornerDownLeft size={12} />
              </button>
            </div>
          ) : (
            <div className={classes.shortcutPills}>
              <span className={classes.kbdBadge}>Ctrl K</span>
            </div>
          )}
        </div>
      </div>

      <div className={classes.right}>
        {/* Notification Bell */}
        <button className={classes.bellBtn} title="System Notifications">
          <FiBell size={17} />
          <span className={classes.bellDot} />
        </button>

        {/* User Identity Pill */}
        <div className={classes.userProfile}>
          <div className={classes.avatarCircle}>
            {(user?.role || 'A')[0].toUpperCase()}
          </div>
          <div className={classes.userInfo}>
            <div className={classes.userName}>
              {user?.role ? user.role.replace(/_/g, ' ') : 'Administrator'}
            </div>
            <div className={classes.userLocation}>
              Jamalpur Workshop • {user?.assignedLocationId || 'Global'}
            </div>
          </div>
        </div>

        {/* Styled Logout Button */}
        <button className={classes.logoutBtn} onClick={logout} title="Sign out of RSMTS">
          <FiLogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
