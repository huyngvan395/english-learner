import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { CloudUserProfile, fetchCloudProfile } from '../services/syncService';

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'synced' | 'error';
export type AuthModalTab = 'signin' | 'signup' | 'forgot';

interface AuthActionResult {
  ok: boolean;
  message?: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  userProfile: CloudUserProfile | null;
  authLoading: boolean;
  isConfigured: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  syncError: string | null;

  authModalOpen: boolean;
  authModalTab: AuthModalTab;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;

  setSyncState: (status: SyncStatus, errorMsg?: string | null) => void;
  markSyncedNow: () => void;

  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<AuthActionResult>;
  resetPassword: (email: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function translateSupabaseAuthError(rawMessage?: string): string {
  const msg = (rawMessage || '').toLowerCase();
  if (!msg) return 'Đã xảy ra lỗi xác thực. Vui lòng thử lại.';
  if (msg.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Tài khoản chưa được xác nhận email. Hãy kiểm tra hộp thư (kể cả mục Spam) và bấm liên kết xác nhận.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Email này đã được đăng ký tài khoản. Vui lòng chuyển sang tab Đăng nhập.';
  }
  if (msg.includes('password should be at least') || msg.includes('weak password')) {
    return 'Mật khẩu quá ngắn — vui lòng nhập ít nhất 6 ký tự.';
  }
  if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
    return 'Địa chỉ email không đúng định dạng hợp lệ.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Bạn thao tác quá nhanh. Vui lòng đợi một phút rồi thử lại.';
  }
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
    return 'Đăng nhập Google chưa được bật trên Supabase Dashboard. Hãy bật Google Provider trong Authentication → Providers.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Không thể kết nối tới máy chủ Supabase. Vui lòng kiểm tra kết nối mạng.';
  }
  return rawMessage || 'Không thể hoàn tất yêu cầu xác thực. Vui lòng thử lại.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<CloudUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isSupabaseConfigured ? 'idle' : 'offline'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>('signin');

  const openAuthModal = useCallback((tab: AuthModalTab = 'signin') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const setSyncState = useCallback((status: SyncStatus, errorMsg?: string | null) => {
    setSyncStatus(status);
    setSyncError(errorMsg ?? null);
  }, []);

  const markSyncedNow = useCallback(() => {
    setSyncStatus('synced');
    setSyncError(null);
    setLastSyncedAt(Date.now());
  }, []);

  // Load user profile metadata when logged in
  const refreshUserProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setUserProfile(null);
      return;
    }
    const cloudProf = await fetchCloudProfile(u.id);
    if (cloudProf) {
      setUserProfile(cloudProf);
      return;
    }
    // Graceful fallback from auth user metadata if schema.sql hasn't been executed yet
    const meta = (u.user_metadata || {}) as Record<string, string | undefined>;
    setUserProfile({
      id: u.id,
      email: u.email ?? null,
      full_name: meta.full_name || meta.name || u.email?.split('@')[0] || 'Học viên TOEIC',
      avatar_url: meta.avatar_url || meta.picture || null,
      target_score: 750,
      daily_goal: 20,
    });
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setSyncStatus('offline');
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          refreshUserProfile(data.session.user);
        }
      })
      .catch(() => {
        // Stay gracefully in guest mode
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        refreshUserProfile(nextSession.user);
        setAuthModalOpen(false);
      } else {
        setUserProfile(null);
        setSyncStatus('idle');
        setSyncError(null);
        setLastSyncedAt(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshUserProfile]);

  const signInWithEmail = async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return { ok: false, message: 'Chưa cấu hình Supabase. Ứng dụng đang chạy ở chế độ Offline.' };
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) return { ok: false, message: 'Vui lòng nhập địa chỉ email.' };
    if (password.length < 6) return { ok: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' };

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      return { ok: false, message: translateSupabaseAuthError(error.message) };
    }
    return { ok: true, message: 'Đăng nhập thành công! Đang đồng bộ tiến độ...' };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<AuthActionResult> => {
    if (!supabase) {
      return { ok: false, message: 'Chưa cấu hình Supabase. Ứng dụng đang chạy ở chế độ Offline.' };
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) return { ok: false, message: 'Vui lòng nhập địa chỉ email.' };
    if (password.length < 6) return { ok: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' };

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: (fullName || '').trim() || cleanEmail.split('@')[0],
        },
      },
    });
    if (error) {
      return { ok: false, message: translateSupabaseAuthError(error.message) };
    }
    // Supabase returns an empty identities array if the email already exists (when email enumeration protection is on)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        message: 'Email này đã được đăng ký tài khoản. Vui lòng chuyển sang tab Đăng nhập.',
      };
    }

    if (!data.session) {
      return {
        ok: true,
        needsEmailConfirmation: true,
        message:
          'Đăng ký thành công! Vui lòng mở hộp thư email (kiểm tra cả mục Spam) và bấm liên kết xác nhận để hoàn tất kích hoạt tài khoản.',
      };
    }
    return { ok: true, message: 'Đăng ký và đăng nhập thành công!' };
  };

  const signInWithGoogle = async (): Promise<AuthActionResult> => {
    if (!supabase) {
      return { ok: false, message: 'Chưa cấu hình Supabase. Ứng dụng đang chạy ở chế độ Offline.' };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      return { ok: false, message: translateSupabaseAuthError(error.message) };
    }
    return { ok: true };
  };

  const resetPassword = async (email: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return { ok: false, message: 'Chưa cấu hình Supabase. Ứng dụng đang chạy ở chế độ Offline.' };
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) return { ok: false, message: 'Vui lòng nhập email đã đăng ký.' };

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });
    if (error) {
      return { ok: false, message: translateSupabaseAuthError(error.message) };
    }
    return {
      ok: true,
      message: 'Đã gửi liên kết đặt lại mật khẩu! Vui lòng kiểm tra hộp thư email của bạn.',
    };
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userProfile,
        authLoading,
        isConfigured: isSupabaseConfigured,
        syncStatus,
        lastSyncedAt,
        syncError,
        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        setSyncState,
        markSyncedNow,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
