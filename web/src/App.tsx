import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { getHealth, getMeta } from './api';
import { AppShell } from './components/AppShell';
import { UiContext } from './context';
import { useApiResource } from './hooks/useApi';
import { AgentsPage } from './pages/AgentsPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ChatPage } from './pages/ChatPage';
import { LearningPage } from './pages/LearningPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OverviewPage } from './pages/OverviewPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { RunsPage } from './pages/RunsPage';
import { SettingsPage } from './pages/SettingsPage';
import { VaultPage } from './pages/VaultPage';

export default function App() {
  const meta = useApiResource(getMeta);
  const health = useApiResource(getHealth);

  return (
    <UiContext.Provider
      value={{
        meta: meta.data,
        metaError: meta.error,
        health: health.data,
        healthError: health.error,
        reloadMeta: meta.reload,
        reloadHealth: health.reload,
      }}
    >
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:runId" element={<RunDetailPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/learning" element={<LearningPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </UiContext.Provider>
  );
}
