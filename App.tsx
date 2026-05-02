import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import ProjectsListPage from './pages/projects/ProjectsListPage';
import ProjectDashboardPage from './pages/projects/ProjectDashboardPage';
import ProjectSchemaPage from './pages/projects/ProjectSchemaPage';
import ProjectFilesPage from './pages/projects/ProjectFilesPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import ProjectLayout from './components/layout/ProjectLayout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/:id" element={<ProjectLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ProjectDashboardPage />} />
          <Route path="schema" element={<ProjectSchemaPage />} />
          <Route path="files" element={<ProjectFilesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
