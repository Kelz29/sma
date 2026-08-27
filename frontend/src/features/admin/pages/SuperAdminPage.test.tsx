import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test/utils";
import { SuperAdminPage } from "./SuperAdminPage";
import * as axios from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: { get: vi.fn() },
}));

describe("SuperAdminPage", () => {
  beforeEach(() => vi.mocked(axios.api.get).mockReset());

  it("renders Superadmin heading and tabs", async () => {
    vi.mocked(axios.api.get).mockImplementation((url: string) => {
      if (url === "/admin/feature-flags") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    render(<SuperAdminPage />);
    expect(screen.getByRole("heading", { name: /superadmin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /feature unlock/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tenants/i })).toBeInTheDocument();
    await waitFor(() => expect(axios.api.get).toHaveBeenCalled());
  });

  it("shows loading state when Tenants tab is selected", async () => {
    let resolveTenants: (value: { data: unknown[] }) => void = () => {};
    const tenantsPromise = new Promise<{ data: unknown[] }>((resolve) => {
      resolveTenants = resolve;
    });
    vi.mocked(axios.api.get).mockImplementation((url: string) => {
      if (url === "/admin/feature-flags") return Promise.resolve({ data: [] });
      if (url === "/admin/tenants") return tenantsPromise;
      return Promise.resolve({ data: [] });
    });
    render(<SuperAdminPage />);
    fireEvent.click(screen.getByRole("button", { name: /tenants/i }));
    expect(await screen.findByText(/loading tenants/i)).toBeInTheDocument();
    resolveTenants({ data: [] });
  });

  it("shows tenant table when Tenants tab selected and data loaded", async () => {
    vi.mocked(axios.api.get).mockImplementation((url: string) => {
      if (url === "/admin/feature-flags") return Promise.resolve({ data: [] });
      if (url === "/admin/tenants")
        return Promise.resolve({
          data: [{ id: 1, name: "Acme", slug: "acme", status: "active" }],
        });
      return Promise.resolve({ data: [] });
    });
    render(<SuperAdminPage />);
    fireEvent.click(screen.getByRole("button", { name: /tenants/i }));
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText(/total tenants/i)).toBeInTheDocument();
  });
});