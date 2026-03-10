import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/utils";
import { InvoicesPage } from "./InvoicesPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("InvoicesPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
  });

  it("renders page title and empty list message when no invoices", async () => {
    render(<InvoicesPage />);
    expect(await screen.findByText(/No invoices yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ New invoice/i })).toBeInTheDocument();
  });

  it("opens new invoice form when clicking New invoice button", async () => {
    const user = userEvent.setup();
    render(<InvoicesPage />);
    await screen.findByText(/No invoices yet/i);
    await user.click(screen.getByRole("button", { name: /\+ New invoice/i }));
    expect(await screen.findByPlaceholderText(/Acme Inc/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create invoice/i })).toBeInTheDocument();
  });

  it("renders invoice list when API returns data", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 1,
          invoice_number: 1,
          customer_name: "Acme",
          issue_date: "2025-03-01",
          total: 100,
          currency: "USD",
          status: "draft",
        },
      ],
    });
    render(<InvoicesPage />);
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/00001/)).toBeInTheDocument();
  });
});
