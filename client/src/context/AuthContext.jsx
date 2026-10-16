import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('pos_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      // Render the cached session immediately. The backend still verifies the
      // token in the background and protects every API request.
      if (user) setLoading(false);

      try {
        const res = await api.getMe();
        setUser(res.data.user);
        localStorage.setItem('pos_user', JSON.stringify(res.data.user));
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }

    verifyUser();

    const handleAuthChange = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth_change', handleAuthChange);
    return () => window.removeEventListener('auth_change', handleAuthChange);
  }, [token]);

  const login = async (username, password) => {
    const res = await api.login({ username, password });
    const { token: receivedToken, user: receivedUser } = res.data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem('pos_token', receivedToken);
    localStorage.setItem('pos_user', JSON.stringify(receivedUser));
    return receivedUser;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
