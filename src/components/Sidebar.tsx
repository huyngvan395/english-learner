import React from 'react';
import {
  BarChart3,
  BookOpen,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Headphones,
  NotebookPen,
  PenTool,
  Trophy,
  X,
} from 'lucide-react';
import { NavTab } from '../types';
import { useApp } from '../context/AppContext';

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
  const { vocabProgress, notes, wrongQuestions } = useApp();

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
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
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

        {/* Bottom Pro-Tip Card */}
        {!isCollapsed && (
          <div className="p-3">
            <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-900 p-3.5">
              <p className="text-xs font-bold text-indigo-300">Lộ trình 990 TOEIC</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Ôn 20 từ SRS mỗi ngày + 1 bài Reading/Listening có phân tích Paraphrase giúp tăng 150+ điểm sau 6 tuần.
              </p>
            </div>
          </div>
        )}
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
        <div className="sticky top-0 h-screen">{renderContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-72 max-w-[82vw] h-full shadow-2xl">
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
