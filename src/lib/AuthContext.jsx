/**
 * AuthContext – real sign-up / sign-in (Supabase) with the old dev-mock login kept for sample-data preview.
 */
import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/api/client';
import { appParams } from '@/lib/app-params';
import { setMockUser } from '@/lib/mockSession';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  // Dashboards call db.auth.logout() directly; this keeps the React state in step with that.
  useEffect(() => {
    const onSignedOut = () => { setUser(null); setIsAuthenticated(false); };
    window.addEventListener('meditrust-signed-out', onSignedOut);
    return () => window.removeEventListener('meditrust-signed-out', onSignedOut);
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({
        id: appParams.appId || 'meditrust',
        public_settings: { require_auth: false, app_name: 'Medi Trust' },
      });
      setIsLoadingPublicSettings(false);
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected error in checkAppState:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await db.auth.me();
      if (currentUser) {
        await db.auth.restoreLocation?.();
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
    }
  };

  // Real account functions (used by the SignIn screen)
  const signIn = async ({ email, password }) => {
    const u = await db.auth.signIn({ email, password });
    await db.auth.restoreLocation?.();
    setUser(u);
    setIsAuthenticated(true);
    return u;
  };

  const signUp = async ({ email, password, fullName, role }) => {
    const result = await db.auth.signUp({ email, password, fullName, role });
    if (!result.needsEmailConfirmation) await checkUserAuth();
    return result;
  };

  const resetPassword = (email) => db.auth.resetPassword(email);

  // Sample-data preview only
  const loginAs = (role = 'patient', extra = {}) => {
    const mockUser = {
      id: 'local-' + Date.now(),
      email: extra.email || `${role}@meditrust.local`,
      full_name: extra.full_name || (role === 'doctor' ? 'Dr. Demo' : role === 'pharmacy' ? 'Pharmacy Demo' : 'Patient Demo'),
      role,
      ...extra,
    };
    setMockUser(mockUser);
    setUser(mockUser);
    setIsAuthenticated(true);
    return mockUser;
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    db.auth.logout(shouldRedirect ? '/' : null);
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
        loginAs,
        signIn,
        signUp,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};