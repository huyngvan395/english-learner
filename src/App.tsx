import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { NavTab } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { VocabHub } from './modules/vocab/VocabHub';
import { ToeicExamHub } from './modules/toeic/ToeicExamHub';
import { ReadingHub } from './modules/reading/ReadingHub';
import { ListeningHub } from './modules/listening/ListeningHub';
import { WritingHub } from './modules/writing/WritingHub';
import { MyVocabView } from './modules/personal/MyVocabView';
import { MyNotesView } from './modules/personal/MyNotesView';
import { AnalyticsView } from './modules/analytics/AnalyticsView';

const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('vocab');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex bg-[#0B1120] text-slate-100 overflow-x-clip">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-8 max-w-[1440px] w-full mx-auto min-w-0">
          {activeTab === 'vocab' && <VocabHub />}
          {activeTab === 'toeic-exam' && <ToeicExamHub />}
          {activeTab === 'reading' && <ReadingHub />}
          {activeTab === 'listening' && <ListeningHub />}
          {activeTab === 'writing' && <WritingHub />}
          {activeTab === 'my-vocab' && <MyVocabView />}
          {activeTab === 'notes' && <MyNotesView />}
          {activeTab === 'analytics' && <AnalyticsView />}
        </main>
      </div>
      <AuthModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
