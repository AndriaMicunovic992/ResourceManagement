import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrgProvider } from './contexts/OrgContext';
import { DataProvider } from './contexts/DataContext';
import ProtectedRoute from './features/auth/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import AppLayout from './layouts/AppLayout';
import PlannerView from './features/planner/PlannerView';
import DashboardView from './features/dashboard/DashboardView';
import SettingsView from './features/settings/SettingsView';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={
            <ProtectedRoute>
              <OrgProvider>
                <DataProvider>
                  <AppLayout />
                </DataProvider>
              </OrgProvider>
            </ProtectedRoute>
          }>
            <Route path="/" element={<Navigate to="/planner" replace />} />
            <Route path="/planner" element={<PlannerView />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
