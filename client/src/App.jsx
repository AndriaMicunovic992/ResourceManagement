import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { useVisibility } from './contexts/VisibilityContext';
import { OrgProvider } from './contexts/OrgContext';
import { VisibilityProvider } from './contexts/VisibilityContext';
import { DataProvider } from './contexts/DataContext';
import ProtectedRoute from './features/auth/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import AppLayout from './layouts/AppLayout';
import PlannerView from './features/planner/PlannerView';
import DashboardView from './features/dashboard/DashboardView';
import SettingsView from './features/settings/SettingsView';
import PeopleListView from './features/people/PeopleListView';
import PersonPage from './features/people/PersonPage';
import PersonOverview from './features/people/tabs/PersonOverview';
import PersonAllocation from './features/people/tabs/PersonAllocation';
import PersonSkills from './features/people/tabs/PersonSkills';
import PersonOneOnOnes from './features/people/tabs/oneonones/PersonOneOnOnes';
import PersonActivity from './features/people/tabs/activity/PersonActivity';
import PersonPerformance from './features/people/tabs/performance/PersonPerformance';
import MyJournalView from './features/journal/MyJournalView';
import CustomerPage from './features/customers/CustomerPage';
import CustomerOverview from './features/customers/tabs/CustomerOverview';
import CustomerProjects from './features/customers/tabs/CustomerProjects';
import CustomerPeople from './features/customers/tabs/CustomerPeople';
import CustomerActivity from './features/customers/tabs/CustomerActivity';
import CustomerPerformance from './features/customers/tabs/CustomerPerformance';

/**
 * Landing redirect: role-aware.
 *   - admin/owner  → /planner
 *   - member       → /people
 *   - viewer       → their own person page (or /people if no resource yet)
 */
function LandingRedirect() {
  const { loading, isAdmin, role, selfResourceId } = useVisibility();
  if (loading) return null;
  if (isAdmin) return <Navigate to="/planner" replace />;
  if (role === 'viewer') {
    if (selfResourceId) return <Navigate to={`/people/${selfResourceId}`} replace />;
    return <Navigate to="/people" replace />;
  }
  return <Navigate to="/people" replace />;
}

/**
 * Wraps the /people list view so viewers are bounced straight to their own
 * profile instead of a list they aren't allowed to browse.
 */
function PeopleListRoute() {
  const { loading, role, selfResourceId } = useVisibility();
  if (loading) return null;
  if (role === 'viewer' && selfResourceId) {
    return <Navigate to={`/people/${selfResourceId}`} replace />;
  }
  return <PeopleListView />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={
              <ProtectedRoute>
                <OrgProvider>
                  <VisibilityProvider>
                    <DataProvider>
                      <AppLayout />
                    </DataProvider>
                  </VisibilityProvider>
                </OrgProvider>
              </ProtectedRoute>
            }>
              <Route path="/" element={<LandingRedirect />} />
              <Route path="/planner" element={<PlannerView />} />
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/people" element={<PeopleListRoute />} />
              <Route path="/people/:id" element={<PersonPage />}>
                <Route index element={<PersonOverview />} />
                <Route path="allocation" element={<PersonAllocation />} />
                <Route path="skills" element={<PersonSkills />} />
                <Route path="oneonones" element={<PersonOneOnOnes />} />
                <Route path="activity" element={<PersonActivity />} />
                <Route path="performance" element={<PersonPerformance />} />
              </Route>
              <Route path="/customers/:id" element={<CustomerPage />}>
                <Route index element={<CustomerOverview />} />
                <Route path="projects" element={<CustomerProjects />} />
                <Route path="people" element={<CustomerPeople />} />
                <Route path="activity" element={<CustomerActivity />} />
                <Route path="performance" element={<CustomerPerformance />} />
              </Route>
              <Route path="/journal" element={<MyJournalView />} />
              <Route path="/skills" element={<Navigate to="/dashboard" replace />} />
              <Route path="/settings" element={<SettingsView />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
