import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth';
import { AppShell } from './shell';
import { LoginPage } from '../pages/Login';
import { SetupPage } from '../pages/Setup';
import { DashboardPage } from '../pages/Dashboard';
import { LeadsPage } from '../pages/Leads';
import { LeadDetailPage } from '../pages/LeadDetail';
import { CustomersPage } from '../pages/Customers';
import { CustomerDetailPage } from '../pages/CustomerDetail';
import { VehiclesPage } from '../pages/Vehicles';
import { VehicleDetailPage } from '../pages/VehicleDetail';
import { SettingsPage } from '../pages/Settings';
import { PlatformPage } from '../pages/Platform';
import { CalendarPage } from '../pages/Calendar';
import { OrdersPage, OrderFormPage, OrderDetailPage } from '../pages/Orders';
import { ProtocolPage } from '../pages/Protocol';

function FullscreenLoader() {
  return (
    <div className="auth"><div className="row"><span className="spinner" /><span className="muted">Lade …</span></div></div>
  );
}

export function AppRoutes() {
  const { me, loading, needsSetup } = useAuth();
  const loc = useLocation();
  if (loading) return <FullscreenLoader />;
  if (needsSetup) return <Routes><Route path="*" element={<SetupPage />} /></Routes>;
  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: loc.pathname }} />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/kunden" element={<CustomersPage />} />
        <Route path="/kunden/:id" element={<CustomerDetailPage />} />
        <Route path="/fahrzeuge" element={<VehiclesPage />} />
        <Route path="/fahrzeuge/:id" element={<VehicleDetailPage />} />
        <Route path="/kalender" element={<CalendarPage />} />
        <Route path="/auftraege" element={<OrdersPage />} />
        <Route path="/auftraege/neu" element={<OrderFormPage />} />
        <Route path="/auftraege/:id" element={<OrderDetailPage />} />
        <Route path="/auftraege/:id/bearbeiten" element={<OrderFormPage />} />
        <Route path="/protokolle/neu" element={<ProtocolPage />} />
        <Route path="/protokolle/:id" element={<ProtocolPage />} />
        <Route path="/einstellungen/*" element={<SettingsPage />} />
        <Route path="/betreiber" element={<PlatformPage />} />
        <Route path="*" element={<div className="empty"><h3>Seite nicht gefunden</h3></div>} />
      </Route>
    </Routes>
  );
}
