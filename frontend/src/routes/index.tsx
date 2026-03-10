import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AccountsPage } from "@/features/accounts/pages/AccountsPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ReportsPage } from "@/features/reports/pages/ReportsPage";
import { InvoicesPage } from "@/features/invoices/pages/InvoicesPage";
import { CustomersPage } from "@/features/customers/pages/CustomersPage";
import { StatementsPage } from "@/features/statements/pages/StatementsPage";
import { ExpensesPage } from "@/features/expenses/pages/ExpensesPage";
import { BankingPage } from "@/features/banking/pages/BankingPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { LandingPage } from "@/features/auth/pages/LandingPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { VerifyEmailPage } from "@/features/auth/pages/VerifyEmailPage";
import { PrivacyPolicyPage } from "@/features/legal/pages/PrivacyPolicyPage";
import { SuperAdminPage } from "@/features/admin/pages/SuperAdminPage";
import { TeamPage } from "@/features/company/pages/TeamPage";
import { HRPage } from "@/features/hr/pages/HRPage";
import { PayslipsPage } from "@/features/payslips/pages/PayslipsPage";
import { LeadsPage } from "@/features/sales/pages/LeadsPage";
import { ProposalsPage } from "@/features/sales/pages/ProposalsPage";
import { ContractsPage } from "@/features/sales/pages/ContractsPage";
import { PitchDecksPage } from "@/features/sales/pages/PitchDecksPage";
import { PipelinePage } from "@/features/sales/pages/PipelinePage";
import { PortalPage } from "@/features/portal/pages/PortalPage";
import { ProfilePage } from "@/features/profile/pages/ProfilePage";
import { RequireFeature } from "@/features/feature-flags/RequireFeature";
import { useAuthStore } from "@/store/authStore";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        This is a placeholder page for {title}. Build your feature here.
      </p>
    </div>
  );
}

function RequireAuth() {
  const { accessToken } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RequireRole({ roles }: { roles: string[] }) {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !roles.includes(user.role)) {
    const defaultPath =
      user?.role === "employee"
        ? "/portal"
        : user?.role === "superadmin"
          ? "/superadmin"
          : "/dashboard";
    return <Navigate to={defaultPath} replace />;
  }

  return <Outlet />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing/auth routes (no app chrome) */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />

      {/* Main app: dashboard + accounting (admin, accountant, viewer, superadmin) and/or HR (admin, hr, superadmin). Employee uses separate routes below. */}
      <Route element={<RequireAuth />}>
        <Route element={<RequireRole roles={["admin", "accountant", "viewer", "hr", "sales", "superadmin"]} />}>
          <Route element={<RequireFeature />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<RequireRole roles={["admin", "accountant", "viewer", "superadmin"]} />}>
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/statements" element={<StatementsPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/banking" element={<BankingPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
            </Route>
            <Route element={<RequireRole roles={["admin", "accountant", "superadmin"]} />}>
              <Route path="/payslips" element={<PayslipsPage />} />
            </Route>
            <Route element={<RequireRole roles={["admin", "superadmin"]} />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route element={<RequireRole roles={["admin", "hr", "superadmin"]} />}>
              <Route path="/employees" element={<HRPage />} />
            </Route>
            <Route element={<RequireRole roles={["admin", "superadmin"]} />}>
              <Route path="/team" element={<TeamPage />} />
            </Route>
            <Route element={<RequireRole roles={["admin", "sales", "superadmin"]} />}>
              <Route path="/sales/leads" element={<LeadsPage />} />
              <Route path="/sales/proposals" element={<ProposalsPage />} />
              <Route path="/sales/contracts" element={<ContractsPage />} />
              <Route path="/sales/pitch-decks" element={<PitchDecksPage />} />
              <Route path="/sales/pipeline" element={<PipelinePage />} />
            </Route>
          </Route>
          </Route>
        </Route>
      </Route>

      {/* Employee portal: role employee only */}
      <Route element={<RequireRole roles={["employee"]} />}>
        <Route element={<RequireFeature />}>
        <Route element={<AppLayout />}>
          <Route path="/portal" element={<PortalPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        </Route>
      </Route>

      {/* Superadmin-only routes */}
      <Route element={<RequireRole roles={["superadmin"]} />}>
        <Route element={<RequireFeature />}>
        <Route element={<AppLayout />}>
          <Route path="/superadmin" element={<SuperAdminPage />} />
        </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

