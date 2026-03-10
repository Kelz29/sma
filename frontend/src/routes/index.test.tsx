import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { AppRoutes } from "./index";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/features/dashboard/pages/DashboardPage", () => ({ DashboardPage: () => <div>Dashboard</div> }));
vi.mock("@/features/invoices/pages/InvoicesPage", () => ({ InvoicesPage: () => <div>Invoices</div> }));
vi.mock("@/features/expenses/pages/ExpensesPage", () => ({ ExpensesPage: () => <div>Expenses</div> }));
vi.mock("@/features/banking/pages/BankingPage", () => ({ BankingPage: () => <div>Banking</div> }));
vi.mock("@/features/accounts/pages/AccountsPage", () => ({ AccountsPage: () => <div>Accounts</div> }));
vi.mock("@/features/admin/pages/SuperAdminPage", () => ({ SuperAdminPage: () => <div>SuperAdmin</div> }));
vi.mock("@/features/auth/pages/LandingPage", () => ({ LandingPage: () => <div>Landing</div> }));
vi.mock("@/features/auth/pages/LoginPage", () => ({ LoginPage: () => <div>Login</div> }));
vi.mock("@/features/auth/pages/RegisterPage", () => ({ RegisterPage: () => <div>Register</div> }));

describe("AppRoutes", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("renders landing at /", () => {
    render(<AppRoutes />);
    expect(screen.getByText("Landing")).toBeInTheDocument();
  });

  it("renders login at /login", () => {
    render(<AppRoutes />, { initialEntries: ["/login"] });
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("redirects unauthenticated user from /dashboard to login", () => {
    render(<AppRoutes />, { initialEntries: ["/dashboard"] });
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renders dashboard when authenticated", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: 1, email: "u@test.com", role: "admin" },
    });
    render(<AppRoutes />, { initialEntries: ["/dashboard"] });
    expect(screen.getByRole("main")).toHaveTextContent("Dashboard");
  });

  it("renders register at /register", () => {
    render(<AppRoutes />, { initialEntries: ["/register"] });
    expect(screen.getByText("Register")).toBeInTheDocument();
  });
});
