import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-load pages for smaller initial bundle
const LandingPage       = lazy(() => import('./pages/LandingPage'));
const LoginPage         = lazy(() => import('./pages/LoginPage'));
const RegisterPage      = lazy(() => import('./pages/RegisterPage'));
const OnboardingPage    = lazy(() => import('./pages/OnboardingPage'));
const ProjectLayout     = lazy(() => import('./pages/ProjectLayout'));
const ProjectsPage      = lazy(() => import('./pages/ProjectsPage'));
const NewProjectWizard  = lazy(() => import('./pages/NewProjectWizard'));
const OverviewPage      = lazy(() => import('./pages/OverviewPage'));
const DataPage          = lazy(() => import('./pages/DataPage'));
const AnalysisPage      = lazy(() => import('./pages/AnalysisPage'));
// ProgressPage removed
const ChatPage          = lazy(() => import('./pages/ChatPage'));
const WeeklyEntryPage   = lazy(() => import('./pages/WeeklyEntryPage'));

// Minimal loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-vizme-bg">
    <div className="flex flex-col items-center gap-3">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center animate-pulse"
        style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)' }}
      >
        <span className="text-sm font-black text-white">V</span>
      </div>
      <div className="h-1 w-20 rounded-full bg-vizme-navy/10 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-vizme-red animate-[slide_1s_ease-in-out_infinite]" />
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Onboarding */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute requireOnboarding={false}>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* Dashboard shell */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <ProjectProvider>
                    <ProjectLayout />
                  </ProjectProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="projects" replace />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/new" element={<NewProjectWizard />} />
              <Route path="projects/:projectId" element={<Navigate to="overview" replace />} />
              <Route path="projects/:projectId/overview"  element={<OverviewPage />} />
              <Route path="projects/:projectId/data"      element={<DataPage />} />
              <Route path="projects/:projectId/analysis"  element={<AnalysisPage />} />
              <Route path="projects/:projectId/weekly"    element={<WeeklyEntryPage />} />
              <Route path="projects/:projectId/chat"      element={<ChatPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
