import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { TextSelectionLookup } from './components/TextSelectionLookup';
import { VocabHub } from './modules/vocab/VocabHub';
import { ToeicExamHub } from './modules/toeic/ToeicExamHub';
import { ReadingHub } from './modules/reading/ReadingHub';
import { ListeningHub } from './modules/listening/ListeningHub';
import { WritingHub } from './modules/writing/WritingHub';
import { MyVocabView } from './modules/personal/MyVocabView';
import { MyNotesView } from './modules/personal/MyNotesView';
import { AnalyticsView } from './modules/analytics/AnalyticsView';

/**
 * Safe root redirect: preserves Supabase OAuth callback tokens (#access_token=... or ?code=...)
 * until AuthContext finishes processing the session before navigating to /vocabulary.
 */
const RootRedirect: React.FC = () => {
  const { authLoading } = useAuth();
  const navigate = useNavigate();

  const hasAuthCallback =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('access_token=') ||
      window.location.hash.includes('refresh_token=') ||
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('code=') ||
      window.location.search.includes('token_hash='));

  const [readyToRedirect, setReadyToRedirect] = useState(!hasAuthCallback);

  useEffect(() => {
    if (!hasAuthCallback) {
      setReadyToRedirect(true);
      return;
    }
    if (!authLoading) {
      const t = window.setTimeout(() => setReadyToRedirect(true), 250);
      return () => window.clearTimeout(t);
    }
    // Hard safety fallback in case auth callback takes longer
    const safety = window.setTimeout(() => setReadyToRedirect(true), 2200);
    return () => window.clearTimeout(safety);
  }, [hasAuthCallback, authLoading]);

  useEffect(() => {
    if (readyToRedirect) {
      navigate('/vocabulary', { replace: true });
    }
  }, [readyToRedirect, navigate]);

  if (!hasAuthCallback) {
    return <Navigate to="/vocabulary" replace />;
  }

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-slate-300">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      <p className="text-sm font-semibold">Đang hoàn tất xác thực tài khoản Supabase...</p>
    </div>
  );
};

const AppShell: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex bg-[#0B1120] text-slate-100 overflow-x-clip">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-8 max-w-[1440px] w-full mx-auto min-w-0">
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            <Route path="/vocabulary" element={<VocabHub />} />
            <Route path="/vocabulary/:deckId" element={<VocabHub />} />
            <Route path="/vocabulary/:deckId/:topicId" element={<VocabHub />} />

            <Route path="/tests" element={<ToeicExamHub />} />
            <Route path="/tests/:testId" element={<ToeicExamHub />} />

            <Route path="/reading" element={<Navigate to="/reading/part-5" replace />} />
            <Route path="/reading/:part" element={<ReadingHub />} />

            <Route path="/listening" element={<Navigate to="/listening/part-1" replace />} />
            <Route path="/listening/:part" element={<ListeningHub />} />

            <Route path="/writing" element={<Navigate to="/writing/translation" replace />} />
            <Route path="/writing/:mode" element={<WritingHub />} />

            <Route path="/my-vocabulary" element={<MyVocabView />} />
            <Route path="/notes" element={<MyNotesView />} />
            <Route path="/stats" element={<AnalyticsView />} />

            <Route path="*" element={<Navigate to="/vocabulary" replace />} />
          </Routes>
        </main>
      </div>
      <AuthModal />
      <TextSelectionLookup />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <AppShell />
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
