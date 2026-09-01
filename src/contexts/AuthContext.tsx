'use client';
import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { User, AuthState } from '../types/user';

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  can: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
  can: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    localStorage.removeItem('rsmts_token');
    localStorage.removeItem('rsmts_user');
    Cookies.remove('rsmts_token');
    setState({ user: null, isAuthenticated: false, isLoading: false });
    router.push('/login');
  }, [router]);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem('rsmts_token', token);
    localStorage.setItem('rsmts_user', JSON.stringify(user));
    Cookies.set('rsmts_token', token, { expires: 1 }); // 1 day cookie
    setState({ user, isAuthenticated: true, isLoading: false });
    router.push('/'); // Redirect to dashboard
  }, [router]);

  useEffect(() => {
    // Check if token exists on mount
    const token = localStorage.getItem('rsmts_token');
    const userData = localStorage.getItem('rsmts_user');
    
    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (e) {
        logout();
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }));
      
      // Auto redirect to login if trying to access dashboard
      if (pathname !== '/login') {
        router.push('/login');
      }
    }
  }, [pathname, router, logout]);

  const can = useCallback((permission: string) => {
    return state.user?.permissions?.includes(permission) ?? false;
  }, [state.user]);

  // Prevent rendering protected routes while checking token
  if (state.isLoading && pathname !== '/login') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F9FAFB' }}>
        <p style={{ color: '#6B7280' }}>Loading session...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}
