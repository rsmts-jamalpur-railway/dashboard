'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import classes from './page.module.css';

// Random 5-character alphanumeric captcha generator (excluding confusing chars like 0/O, 1/I)
const CHAR_SET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateCaptchaCode = () => {
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += CHAR_SET.charAt(Math.floor(Math.random() * CHAR_SET.length));
  }
  return result;
};

export default function LoginPage() {
  const [email, setEmail] = useState('farhanaiyyar04@gmail.com');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [enteredCaptcha, setEnteredCaptcha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  // Refresh captcha
  const refreshCaptcha = useCallback(() => {
    setCaptchaCode(generateCaptchaCode());
    setEnteredCaptcha('');
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Verify Captcha
    if (enteredCaptcha.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      setError('Invalid security code. Please check the text from the image.');
      refreshCaptcha();
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';
      // Backend expects identifier and password
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email.trim(),
          password: password,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Invalid credentials');
      }

      const { user, tokens } = json.data;
      login(tokens.access_token, user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.loginCard}>
        {/* Title Header */}
        <div className={classes.header}>
          <h1 className={classes.title}>Sign in</h1>
          <p className={classes.subtitle}>Enter your details to access your account.</p>
          
          {/* Quick-fill credential chips */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@rsmts.gov.in');
                setPassword('Admin@123!');
                setEnteredCaptcha(captchaCode);
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              ⚡ Quick Fill: Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('farhanaiyyar04@gmail.com');
                setPassword('Admin@123!');
                setEnteredCaptcha(captchaCode);
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: '#F0FDF4',
                color: '#15803D',
                border: '1px solid #BBF7D0',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              ⚡ Quick Fill: Farhan Aiyyar
            </button>
          </div>
        </div>

        {error && <div className={classes.errorBanner}>{error}</div>}

        <form className={classes.form} onSubmit={handleLogin}>
          {/* Email / Identifier Field */}
          <div className={classes.fieldGroup}>
            <label className={classes.label}>Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. farhanaiyyar04@gmail.com or ADM-001"
              required
              className={classes.inputTinted}
            />
          </div>

          {/* Password Field */}
          <div className={classes.fieldGroup}>
            <label className={classes.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••••••"
              required
              className={classes.inputTinted}
            />
          </div>

          {/* Security Check (CAPTCHA) */}
          <div className={classes.fieldGroup}>
            <label className={classes.label}>Security Check</label>
            
            <div className={classes.captchaRow}>
              {/* Distorted CAPTCHA Box */}
              <div className={classes.captchaBox}>
                <svg width="100%" height="70" viewBox="0 0 240 70" className={classes.captchaSvg}>
                  {/* Subtle Background Mesh / Noise */}
                  <rect width="240" height="70" fill="#EEF2F6" rx="4" />
                  
                  {/* Distorting Lines matching screenshot */}
                  <line x1="10" y1="60" x2="230" y2="15" stroke="#CBD5E1" strokeWidth="2.5" />
                  <line x1="15" y1="15" x2="225" y2="55" stroke="#CBD5E1" strokeWidth="2.5" />
                  <line x1="120" y1="5" x2="120" y2="65" stroke="#CBD5E1" strokeWidth="1.5" />
                  <line x1="30" y1="35" x2="210" y2="35" stroke="#E2E8F0" strokeWidth="2" />

                  {/* Character glyphs with slight individual offsets */}
                  {captchaCode.split('').map((char, index) => {
                    const x = 32 + index * 40;
                    const y = 46 + (index % 2 === 0 ? -2 : 3);
                    return (
                      <text
                        key={index}
                        x={x}
                        y={y}
                        fill="#1E293B"
                        fontSize="32"
                        fontWeight="800"
                        fontFamily="monospace, sans-serif"
                        letterSpacing="4"
                      >
                        {char}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={refreshCaptcha}
                className={classes.refreshBtn}
                title="Generate new security code"
              >
                Refresh
              </button>
            </div>

            {/* Captcha Input */}
            <input
              type="text"
              value={enteredCaptcha}
              onChange={(e) => setEnteredCaptcha(e.target.value.toUpperCase())}
              placeholder="ENTER TEXT FROM IMAGE"
              required
              maxLength={6}
              className={classes.inputCaptcha}
            />
          </div>

          {/* Links Row: Back & Forgot Password */}
          <div className={classes.linksRow}>
            <button
              type="button"
              onClick={() => router.back()}
              className={classes.backLink}
            >
              ← Back
            </button>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('Please contact Workshop System Administrator (ADM-001) to reset credentials.');
              }}
              className={classes.forgotLink}
            >
              Forgot password?
            </a>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className={classes.signInBtn}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
