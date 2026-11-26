import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

interface AuthUser {
  id: string;
  email?: string;
  name: string;
  role: 'teacher' | 'student' | 'admin';
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signInWithEmail: async () => null,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'MAGRANA_READY' }, '*');
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'MAGRANA_SSO_INIT' && event.data.session) {
        const { access_token, refresh_token, user: ssoUser } = event.data.session;
        try {
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        } catch (err) {
          console.warn('[Edukard SSO] setSession error:', err);
        }
        if (ssoUser) {
          setUser({
            id: ssoUser.id,
            email: ssoUser.email,
            name: ssoUser.full_name || ssoUser.name || ssoUser.email?.split('@')[0] || 'Docente',
            role: ssoUser.role || 'teacher',
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const u = session.user;
          setUser({
            id: u.id,
            email: u.email,
            name: (u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Docente') as string,
            role: (u.user_metadata?.role as 'teacher' | 'student' | 'admin') || 'teacher',
          });
        }
      } catch (err) {
        console.warn('[Edukard Auth] init error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email,
          name: (u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Docente') as string,
          role: (u.user_metadata?.role as 'teacher' | 'student' | 'admin') || 'teacher',
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
