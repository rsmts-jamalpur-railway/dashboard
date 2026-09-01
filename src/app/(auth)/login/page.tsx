'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import classes from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Login failed');
      }

      const { user, tokens } = json.data;
      login(tokens.access_token, user);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.loginBox}>
        <div className={classes.header}>
          <h1>Login to your<br />account</h1>
        </div>
        
        <form className={classes.form} onSubmit={handleLogin}>
          {error && <div className={classes.error}>{error}</div>}
          
          <div className={classes.inputGroup}>
            <div className={classes.icon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </div>
            <input 
              id="email"
              type="email" 
              className={classes.input}
              placeholder="Enter your mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className={classes.inputGroup}>
            <div className={classes.icon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <input 
              id="password"
              type={showPassword ? "text" : "password"} 
              className={classes.inputPassword}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button 
              type="button" 
              className={classes.togglePassword}
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? "Hide Password" : "Show Password"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              )}
            </button>
          </div>
          
          <div className={classes.optionsRow}>
            <label className={classes.checkboxContainer}>
              <input type="checkbox" />
              <span className={classes.checkboxLabel}>Remember me</span>
            </label>
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Contact Administrator'); }} className={classes.forgotLink}>
              Forgot password
            </a>
          </div>
          
          <button type="submit" className={classes.submitBtn} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>
      </div>

      <div style={{ position: 'absolute', bottom: '32px', width: '100%', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
        Don't have an account? <span style={{ color: '#38B2AC', fontWeight: 500 }}>Contact administrator</span>
      </div>
    </div>
  );
}
