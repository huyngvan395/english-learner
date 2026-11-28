import React, { useEffect } from 'react';
import {
  BarChart3,
  BookOpen,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudAlert,
  FileText,
  GraduationCap,
  Headphones,
  LogIn,
  LogOut,
  Moon,
  NotebookPen,
  PenTool,
  RefreshCw,
  Sun,
  Trophy,
  X,
} from 'lucide-react';
import { NavTab } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { vocabProgress, notes, wrongQuestions, syncNow, signOutAndClear } = useApp();
  const { user, userProfile, syncStatus, syncError, openAuthModal } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Lock background page scroll while mobile slide-over drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const displayName =
    userProfile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Học viên TOEIC';
  const avatarUrl =
    userProfile?.avatar_url ||
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;
  const initials = displayName.trim().slice(0, 1).toUpperCase() || 'U';

  const savedCount = Object.values(vocabProgress).filter(
    (p) => p.saved || p.status === 'forgotten' || p.status === 'vague'
  ).length;

  const navItems: {
    id: NavTab;
    label: string;
    sublabel: string;
    icon: React.FC<{ className?: string }>;
    badge?: number | string;
  }[] = [
    { id: 'vocab', label: 'Từ vựng', sublabel: '16 Bộ thẻ • 10.996 từ', icon: BookOpen },
    {
      id: 'toeic-exam',
      label: 'Luyện thi TOEIC',
      sublabel: 'Đề ETS 24–26, 7 Part & Câu sai',
      icon: Trophy,
      badge: wrongQuestions.length > 0 ? wrongQuestions.length : 'ETS',
    },
    { id: 'reading', label: 'TOEIC Reading', sublabel: 'Part 5, 6, 7 chuyên sâu', icon: FileText },
    { id: 'listening', label: 'TOEIC Listening', sublabel: 'Part 1, 2, 3, 4 chuẩn ETS', icon: Headphones },
    {
      id: 'writing',
      label: 'Writing & AI Chấm bài',
      sublabel: 'Dịch Việt–Anh & TOEIC Email',
      icon: PenTool,
      badge: 'AI',
    },
    { id: 'my-vocab', label: 'Từ vựng của tôi', sublabel: 'SRS & Từ đã lưu', icon: BookmarkCheck, badge: savedCount || undefined },
    { id: 'notes', label: 'Ghi chú của tôi', sublabel: 'Từ vựng & Câu hỏi', icon: NotebookPen, badge: notes.length || undefined },
    { id: 'analytics', label: 'Thống kê học tập', sublabel: 'Phân tích điểm yếu', icon: BarChart3 },
  ];

  const handleClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const renderContent = (isMobile: boolean) => {
    const isCollapsed = !isMobile && collapsed;
    return (
      <div className="flex h-full flex-col bg-[#0F172A] border-r border-slate-800/80">
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white shadow-glow">
              <GraduationCap className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-extrabold tracking-tight text-white">
                  TOEIC Mastery Hub
                </h1>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                  Target 990 • Free All
                </p>
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Đóng menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 transition"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  active
                    ? 'bg-gradient-to-r from-blue-600/25 via-indigo-600/20 to-violet-600/15 text-white border border-indigo-500/40 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 border border-transparent'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition ${
                    active ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="rounded-full bg-indigo-500/25 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-slate-500 group-hover:text-slate-400">
                      {item.sublabel}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Theme Switcher + Account & Cloud Sync Area (Parroto-inspired) */}
        <div className="p-3 pb-safe border-t border-slate-800/80 bg-[#0B1120]/60 shrink-0 space-y-2.5">
          {/* Quick Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            className={`flex w-full items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
            } h-9 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-indigo-500/50 text-xs font-bold text-slate-300 hover:text-white transition`}
          >
            <span className="inline-flex items-center gap-2">
              {isDark ? (
                <Moon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              {!isCollapsed && <span>{isDark ? 'Giao diện Tối' : 'Giao diện Sáng'}</span>}
            </span>
            {!isCollapsed && (
              <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                {isDark ? '☀️ Sáng' : '🌙 Tối'}
              </span>
            )}
          </button>

          {!user ? (
            isCollapsed ? (
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                title="Đăng nhập / Đồng bộ Cloud"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm hover:brightness-110 transition"
              >
                <LogIn className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  openAuthModal('signin');
                }}
                className="group w-full rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-blue-600/25 via-indigo-600/20 to-violet-600/25 hover:from-blue-600/35 hover:to-violet-600/35 p-3.5 text-left transition shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white shadow-sm">
                    <Cloud className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-white">
                      Đăng nhập / Đồng bộ Cloud
                    </p>
                    <p className="truncate text-[11px] text-indigo-200/80">
                      Lưu tiến độ nhiều thiết bị
                    </p>
                  </div>
                </div>
              </button>
            )
          ) : isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => syncNow()}
                title={`${displayName} — Bấm để đồng bộ ngay`}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-indigo-400/50 bg-indigo-600/30 text-sm font-extrabold text-white overflow-hidden"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
                <span
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#0F172A] ${
                    syncStatus === 'error'
                      ? 'bg-amber-400'
                      : syncStatus === 'syncing'
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-emerald-400'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => signOutAndClear()}
                title="Đăng xuất"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-400/40 bg-gradient-to-br from-blue-600 to-violet-600 text-xs font-extrabold text-white overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-white">{displayName}</p>
                  <p className="truncate text-[10px] text-slate-400">{user.email}</p>
                </div>
              </div>

              {/* Sync Status Badge */}
              <div
                title={syncError || undefined}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold ${
                  syncStatus === 'syncing'
                    ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300'
                    : syncStatus === 'error'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span className="truncate">Đang lưu lên Cloud...</span>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <CloudAlert className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Lỗi mạng / Chưa đồng bộ</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">☁ Đã đồng bộ Cloud</span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={syncStatus === 'syncing'}
                  onClick={() => syncNow()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-1.5 text-[11px] font-bold text-slate-200 transition"
                >
                  <RefreshCw className={`h-3 w-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  Đồng bộ ngay
                </button>
                <button
                  type="button"
                  onClick={() => signOutAndClear()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-rose-500/40 hover:text-rose-300 py-1.5 text-[11px] font-bold text-slate-400 transition"
                >
                  <LogOut className="h-3 w-3" />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-[100dvh]">{renderContent(false)}</div>
      </aside>

      {/* Mobile Slide-over Drawer (100dvh prevents address-bar clipping) */}
      <div
        className={`fixed inset-0 z-50 flex lg:hidden transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
          onClick={onCloseMobile}
        />
        <div
          className={`relative z-10 w-72 max-w-[85vw] h-[100dvh] shadow-2xl transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderContent(true)}
        </div>
      </div>
    </>
  );
};
