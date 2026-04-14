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
import SkillsView from './features/skills/SkillsView';
import PeopleListView from './features/people/PeopleListView';
import PersonPage from './features/people/PersonPage';
import PersonOverview from './features/people/tabs/PersonOverview';
import PersonAllocation from './features/people/tabs/PersonAllocation';
import PersonSkills from './features/people/tabs/PersonSkills';
import PersonOneOnOnes from './features/people/tabs/oneonones/PersonOneOnOnes';
import PersonActivity from './features/people/tabs/activity/PersonActivity';
import PersonPerformance from './features/people/tabs/performance/PersonPerformance';
import MyJournalView from './features/journal/MyJournalView';

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
            <Route path="/people" element={<PeopleListView />} />
            <Route path="/people/:id" element={<PersonPage />}>
              <Route index element={<PersonOverview />} />
              <Route path="allocation" element={<PersonAllocation />} />
              <Route path="skills" element={<PersonSkills />} />
              <Route path="oneonones" element={<PersonOneOnOnes />} />
              <Route path="activity" element={<PersonActivity />} />
              <Route path="performance" element={<PersonPerformance />} />
            </Route>
            <Route path="/journal" element={<MyJournalView />} />
            <Route path="/skills" element={<SkillsView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
