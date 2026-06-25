import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(api.getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = useCallback(async (phone) => {
    setLoading(true); setError('');
    try {
      await api.post('/auth/otp/request', { phone });
      setLoading(false);
      return true;
    } catch (e) {
      setError(e.message); setLoading(false);
      return false;
    }
  }, []);

  const verifyOtp = useCallback(async (phone, code) => {
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/otp/verify', { phone, code });
      api.setTokens(data.access, data.refresh);
      api.setUser(data.user);
      setUser(data.user);
      setLoading(false);
      return data;
    } catch (e) {
      setError(e.message); setLoading(false);
      return null;
    }
  }, []);

  const login = useCallback(async (phone, password) => {
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/login', { phone, password });
      api.setTokens(data.access, data.refresh);
      api.setUser(data.user);
      setUser(data.user);
      setLoading(false);
      return data;
    } catch (e) {
      setError(e.message); setLoading(false);
      throw e;
    }
  }, []);

  const register = useCallback(async (registerData) => {
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/register', registerData);
      api.setTokens(data.access, data.refresh);
      api.setUser(data.user);
      setUser(data.user);
      setLoading(false);
      return data;
    } catch (e) {
      setError(e.message); setLoading(false);
      throw e;
    }
  }, []);

  const completeProfile = useCallback(async (profileData) => {
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/complete-profile', profileData);
      api.setUser(data);
      setUser(data);
      setLoading(false);
      return true;
    } catch (e) {
      setError(e.message); setLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    api.clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/users/me');
      api.setUser(data);
      setUser(data);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, error, setError,
      isAuthenticated: !!user,
      isDriver: user?.role === 'driver',
      isPassenger: user?.role === 'passenger',
      isProfileComplete: !!(user?.first_name && user?.last_name),
      login, register, requestOtp, verifyOtp, completeProfile, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
