import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/store/authStore";
import * as axios from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: { get: vi.fn() },
}));

const defaultFeatureFlags = [
  { key: "dashboard", enabled: true },
  { key: "invoices", enabled: true },
  { key: "expenses", enabled: true },
  { key: "reports", enabled: true },
  { key: "banking", enabled: true },
  { key: "accounts", enabled: true },
  { key: "leads", enabled: true },
  { key: "proposals", enabled: true },
  { key: "contracts", enabled: true },
  { key: "pitch_decks", enabled: true },
  { key: "pipeline", enabled: true },
  { key: "hr", enabled: true },
  { key: "settings", enabled: true },
  { key: "team", enabled: true },
  { key: "profile", enabled: true },
  { key: "portal", enabled: true },
];

describe("Sidebar", () => {
  beforeEach(() => {
    vi.mocked(axios.api.get).mockImplementation((url: string) => {
      if (url === "/company") return Promise.resolve({ data: { name: "Test Co", logo_url: null } });
      if (url === "/feature-flags") return Promise.resolve({ data: defaultFeatureFlags });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders accounting nav and SmartSeen brand for viewer (no HR)", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: 1, email: "u@test.com", role: "viewer" },
    });
    render(<Sidebar />);
    expect((await screen.findAllByText(/SmartSeen/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /invoices/i }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("link", { name: /^hr$/i })).toHaveLength(0);
    useAuthStore.getState().clearAuth();
  });

  it("shows HR and Dashboard for hr role (no accounting links)", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: 1, email: "hr@test.com", role: "hr" },
    });
    render(<Sidebar />);
    expect((await screen.findAllByText(/SmartSeen/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^hr$/i }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("link", { name: /invoices/i })).toHaveLength(0);
    useAuthStore.getState().clearAuth();
  });

  it("shows Dashboard, accounting nav and HR for admin role", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: 1, email: "a@test.com", role: "admin" },
    });
    render(<Sidebar />);
    expect((await screen.findAllByText(/SmartSeen/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /invoices/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^hr$/i }).length).toBeGreaterThan(0);
    useAuthStore.getState().clearAuth();
  });

  it("shows My portal for employee role", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: 1, email: "e@test.com", role: "employee" },
    });
    render(<Sidebar />);
    expect(await screen.findByRole("link", { name: /my portal/i })).toBeInTheDocument();
    useAuthStore.getState().clearAuth();
  });

  it("shows Superadmin link for superadmin role", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: 1, email: "s@test.com", role: "superadmin" },
    });
    render(<Sidebar />);
    expect(await screen.findByRole("link", { name: /superadmin/i })).toBeInTheDocument();
    useAuthStore.getState().clearAuth();
  });
});
