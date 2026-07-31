'use client';
import { createContext, useState, useContext, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  messages: string[];
}

interface ToastContextType {
  success: (title: string, msg?: string) => void;
  error: (title: string, err?: unknown) => void;
  info: (title: string, msg?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastType, title: string, messages: string[]) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, messages }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000); // auto dismiss after 5s
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (title: string, msg?: string) => {
    addToast('success', title, msg ? [msg] : []);
  };

  const info = (title: string, msg?: string) => {
    addToast('info', title, msg ? [msg] : []);
  };

  const error = (title: string, err?: unknown) => {
    let messages: string[] = [];
    
    if (typeof err === 'string') {
      messages = [err];
    } else if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as Record<string, unknown>;
      const response = axiosErr.response as Record<string, unknown> | undefined;
      const data = response?.data as Record<string, unknown> | undefined;
      const msg = data?.message;
      if (Array.isArray(msg)) {
        messages = msg as string[];
      } else {
        messages = [msg as string];
      }
    } else if (err && typeof err === 'object' && 'message' in err) {
      messages = [(err as Record<string, unknown>).message as string];
    } else {
      messages = ['An unknown error occurred.'];
    }

    addToast('error', title, messages);
  };

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999,
        maxWidth: '400px'
      }}>
        {toasts.map((t) => (
          <div 
            key={t.id}
            style={{
              backgroundColor: 'var(--color-bg)',
              border: `2px solid ${t.type === 'error' ? 'var(--color-danger)' : t.type === 'success' ? '#059669' : 'var(--color-primary-action)'}`,
              boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              position: 'relative'
            }}
          >
            <button 
              onClick={() => removeToast(t.id)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1.2rem'
              }}
            >
              ✕
            </button>
            <h4 style={{ 
              margin: 0, 
              color: t.type === 'error' ? 'var(--color-danger)' : t.type === 'success' ? '#059669' : 'var(--color-text-primary)' 
            }}>
              {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.title}
            </h4>
            
            {t.messages.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                {t.messages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
