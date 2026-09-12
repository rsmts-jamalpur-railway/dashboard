import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
});

// Request Interceptor: Attach the JWT token dynamically
api.interceptors.request.use(
  (config) => {
    // Read the token from cookies or localStorage
    let token = Cookies.get('rsmts_token');
    
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('rsmts_token') || undefined;
    }
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors and token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is expired or invalid
      // Instead of relying on AuthContext here (which is a React hook),
      // we can clear the cookie and force a hard reload to let middleware handle it
      // or dispatch a custom event.
      
      // Let's force logout by removing cookies if a 401 hits.
      Cookies.remove('rsmts_token');
      localStorage.removeItem('rsmts_token');
      localStorage.removeItem('rsmts_user');
      
      // Only redirect if we are in the browser and not already on the login page
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        // Use a slight delay to prevent rapid loop if the backend is consistently rejecting
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
