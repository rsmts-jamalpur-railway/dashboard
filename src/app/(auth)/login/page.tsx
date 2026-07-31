'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import classes from './page.module.css';

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('');
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
        body: JSON.stringify({ employee_id: employeeId, password }),
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
          <h1>RSMTS</h1>
          <p>Jamalpur Workshop Management</p>
        </div>
        
        <form className={classes.form} onSubmit={handleLogin}>
          {error && <div className={classes.error}>{error}</div>}
          
          <div className={classes.inputGroup}>
            <label htmlFor="employeeId">Employee ID</label>
            <input 
              id="employeeId"
              type="text" 
              className={classes.input}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>
          
          <div className={classes.inputGroup}>
            <label htmlFor="password">Password</label>
            <div className={classes.passwordContainer}>
              <input 
                id="password"
                type={showPassword ? "text" : "password"} 
                className={classes.inputPassword}
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
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          
          <button type="submit" className={classes.submitBtn} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
