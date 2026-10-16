import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/utils";
import { InvoicesPage } from "./InvoicesPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
    expect(screen.getByText(/Invoice number \(optional\)/i)).toBeInTheDocument();
  });

  it("opens saved line items as a list instead of a cramped select", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/line-item-templates/") {
        return { data: [{ id: 4, description: "Telematics Dashboard Update", default_quantity: 1, unit_price: 22000, vat_rate: null }] };
      }
      return { data: [] };
    });
    render(<InvoicesPage />);
    await screen.findByText(/No invoices yet/i);
    await user.click(screen.getByRole("button", { name: /\+ New invoice/i }));
    await user.click(await screen.findByRole("button", { name: "Add from saved" }));
    expect(await screen.findByRole("option", { name: /Telematics Dashboard Update/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /add from saved/i })).not.toBeInTheDocument();
  });

  it("lets an existing invoice number be edited", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/invoices/1") {
        return {
          data: {
            id: 1,
            invoice_number: 17,
            customer_name: "Acme",
            customer_email: "billing@acme.com",
            description: "Website",
            issue_date: "2025-03-01",
            due_date: null,
            currency: "ZAR",
            vat_rate: null,
            vat_country: null,
            notes: null,
            is_recurring: false,
            recurring_interval_days: null,
            discount_type: null,
            discount_percent: null,
            discount_amount: null,
            lines: [{ description: "Work", quantity: 1, unit_price: 100, vat_rate: null }],
          },
        };
      }
      if (url === "/invoices/") {
        return {
          data: [
            {
              id: 1,
              invoice_number: 17,
              customer_name: "Acme",
              issue_date: "2025-03-01",
              total: 100,
              currency: "ZAR",
              status: "draft",
            },
          ],
        };
      }
      return { data: [] };
    });
    vi.mocked(api.put).mockResolvedValue({ data: { id: 1, invoice_number: 42 } });
    render(<InvoicesPage />);
    await user.click(await screen.findByRole("button", { name: /^edit$/i }));
    const numberInput = await screen.findByLabelText(/Invoice \/ quotation number/i);
    expect(numberInput).toHaveValue(17);
    await user.clear(numberInput);
    await user.type(numberInput, "42");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(api.put).toHaveBeenCalledWith(
      "/invoices/1",
      expect.objectContaining({ invoice_number: 42 }),
    );
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
