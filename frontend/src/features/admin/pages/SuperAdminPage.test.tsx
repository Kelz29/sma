import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@/test/utils";
import { SuperAdminPage } from "./SuperAdminPage";
import * as axios from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: { get: vi.fn() },
}));

describe("SuperAdminPage", () => {
  beforeEach(() => vi.mocked(axios.api.get).mockReset());

  it("renders Superadmin heading and tabs", () => {
    vi.mocked(axios.api.get).mockImplementation((url: string) => {
      if (url === "/admin/feature-flags") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    render(<SuperAdminPage />);
    expect(screen.getByRole("heading", { name: /superadmin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /feature unlock/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tenants/i })).toBeInTheDocument();
  });

  it("shows loading state when Tenants tab is selected", async () => {
    vi.mocked(axios.api.get).mockImplementation((url: string) => {
      if (url === "/admin/feature-flags") return Promise.resolve({ data: [] });
      return new Promise(() => {}); // tenants never resolve
    });
    render(<SuperAdminPage />);
    await act(async () => {
      screen.getByRole("button", { name: /tenants/i }).click();
    });
    expect(screen.getByText(/loading tenants/i)).toBeInTheDocument();
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
    await act(async () => {
      screen.getByRole("button", { name: /tenants/i }).click();
    });
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText(/total tenants/i)).toBeInTheDocument();
  });
});
