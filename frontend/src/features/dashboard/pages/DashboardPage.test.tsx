import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { DashboardPage } from "./DashboardPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
  },
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/invoices/")) return Promise.resolve({ data: [] });
      if (url.includes("/expenses/")) return Promise.resolve({ data: [] });
      if (url.includes("/banking/accounts")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders dashboard heading and quick actions", async () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Overview/i)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Create a new invoice/i })).toBeInTheDocument();
  });
});
