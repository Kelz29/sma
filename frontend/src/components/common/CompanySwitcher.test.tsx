import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { CompanySwitcher } from "./CompanySwitcher";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

describe("CompanySwitcher", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "1", email: "sa@example.com", role: "superadmin" },
      tenantId: "1",
      accessToken: "mock-token",
    });
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, name: "Demo Company", slug: "demo", status: "active" },
        { id: 2, name: "Smart Mac Mane", slug: "smartmacmane", status: "active" },
      ],
    });
  });

  it("returns null when user is not superadmin", () => {
    useAuthStore.setState({ user: { id: "1", email: "u@example.com", role: "admin" } });
    const { container } = render(<CompanySwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it("renders current company name for superadmin", async () => {
    render(<CompanySwitcher />);
    expect(await screen.findByText(/Demo Company/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch company/i })).toBeInTheDocument();
  });
});
