'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import classes from './DashboardLayout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  // Simple breadcrumb generator based on pathname
  const generateBreadcrumbs = () => {
    if (pathname === '/') return <span>Dashboard</span>;
    const paths = pathname.split('/').filter(Boolean);
    return (
      <>
        Dashboard /{' '}
        {paths.map((path, index) => {
          const isLast = index === paths.length - 1;
          const capitalized = path.charAt(0).toUpperCase() + path.slice(1);
          return (
            <span key={path}>
              {capitalized}
              {!isLast && ' / '}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className={classes.layout}>
      <Sidebar isOpen={isSidebarOpen} />
      <div className={classes.mainWrapper}>
        <Header toggleSidebar={toggleSidebar} />
        <main className={classes.content}>
          <div className={classes.breadcrumbs}>
            {generateBreadcrumbs()}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
