import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { ExpensesPage } from "./ExpensesPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("ExpensesPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/expenses/") return Promise.resolve({ data: [] });
      if (url.includes("/expenses/receipts")) return Promise.resolve({ data: [] });
      if (url.includes("/expenses/vendors")) return Promise.resolve({ data: [] });
      if (url.includes("/expenses/categories")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders Expenses page", () => {
    render(<ExpensesPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Expenses/i })).toBeInTheDocument();
    expect(screen.getByText(/Track spend/)).toBeInTheDocument();
  });
});
