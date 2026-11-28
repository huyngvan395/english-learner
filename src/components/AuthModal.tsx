import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AuthModalTab, useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalTab,
    closeAuthModal,
    isConfigured,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPassword,
  } = useAuth();

  const [tab, setTab] = useState<AuthModalTab>(authModalTab);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authModalOpen) {
      setTab(authModalTab);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [authModalOpen, authModalTab]);

  if (!authModalOpen) return null;

  const switchTab = (next: AuthModalTab) => {
    setTab(next);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    if (tab === 'forgot') {
      setSubmitting(true);
      try {
        const res = await resetPassword(cleanEmail);
        if (res.ok) setSuccessMsg(res.message || 'Đã gửi email đặt lại mật khẩu.');
        else setErrorMsg(res.message || 'Không thể gửi email đặt lại mật khẩu.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }

    if (tab === 'signup' && password !== confirmPassword) {
      setErrorMsg('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'signin') {
        const res = await signInWithEmail(cleanEmail, password);
        if (res.ok) {
          setSuccessMsg(res.message || 'Đăng nhập thành công!');
          window.setTimeout(() => closeAuthModal(), 500);
        } else {
          setErrorMsg(res.message || 'Đăng nhập thất bại.');
        }
      } else {
        const res = await signUpWithEmail(cleanEmail, password, fullName);
        if (res.ok) {
          setSuccessMsg(res.message || 'Đăng ký thành công!');
          if (!res.needsEmailConfirmation) {
            window.setTimeout(() => closeAuthModal(), 600);
          }
        } else {
          setErrorMsg(res.message || 'Đăng ký thất bại.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res.ok) {
        setErrorMsg(res.message || 'Không thể khởi động đăng nhập Google.');
        setGoogleLoading(false);
      }
    } catch {
      setErrorMsg('Không thể kết nối tới Google OAuth.');
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-md max-h-[90dvh] flex flex-col rounded-3xl border border-slate-700/80 bg-[#0F172A] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative shrink-0 border-b border-slate-800 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-900 px-5 sm:px-6 py-4 sm:py-5">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 shadow-glow rounded-[13px]" />
            <div>
              <h3 className="text-lg font-extrabold text-white">TOEIC Mastery Hub</h3>
              <p className="text-xs text-slate-400">
                Đồng bộ tiến độ SRS, Video, điểm thi ETS &amp; lịch sử viết trên mọi thiết bị
              </p>
            </div>
          </div>

          {/* 3 Mode Tabs */}
          <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-950/80 p-1 border border-slate-800">
            {(
              [
                { id: 'signin', label: 'Đăng nhập' },
                { id: 'signup', label: 'Đăng ký' },
                { id: 'forgot', label: 'Quên mật khẩu' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                className={`rounded-xl py-2 text-xs font-bold transition ${
                  tab === t.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {!isConfigured && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Chưa phát hiện cấu hình Supabase trong biến môi trường. Bạn vẫn có thể học bình thường ở chế độ Offline (lưu cục bộ trên trình duyệt).
              </span>
            </div>
          )}

          {/* Google OAuth Button (shown on Sign In & Sign Up) */}
          {tab !== 'forgot' && (
            <>
              <button
                type="button"
                disabled={!isConfigured || googleLoading || submitting}
                onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 px-4 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition active:scale-[0.99]"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-700" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                <span>Tiếp tục với Google</span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-slate-800" />
                <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  hoặc dùng Email
                </span>
                <div className="flex-1 border-t border-slate-800" />
              </div>
            </>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Họ và tên (tùy chọn)</label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn Huy"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Địa chỉ Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                />
              </div>
            </div>

            {tab !== 'forgot' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Mật khẩu</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-10 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-white"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {tab === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nhập lại mật khẩu</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-3 text-xs text-rose-200 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/35 p-3 text-xs text-emerald-200 flex items-start gap-2 leading-relaxed">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!isConfigured || submitting || googleLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 disabled:opacity-45 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/50 transition"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {tab === 'signin'
                  ? 'Đăng nhập & Đồng bộ'
                  : tab === 'signup'
                  ? 'Tạo tài khoản miễn phí'
                  : 'Gửi liên kết đặt lại mật khẩu'}
              </span>
            </button>
          </form>

          {/* Privacy Guarantee Footer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3.5 py-2.5 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>
              Tiến độ hiện có trên máy sẽ được tự động gộp an toàn khi đăng nhập. Khóa{' '}
              <strong className="text-slate-300">Gemini API Key</strong> cá nhân luôn giữ cục bộ trên trình duyệt, không đồng bộ lên Cloud.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
