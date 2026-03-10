import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { BankingPage } from "./BankingPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("BankingPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/banking/accounts") return Promise.resolve({ data: [] });
      if (url === "/banking/transactions") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders page title and SA/LSO context", () => {
    render(<BankingPage />);
    expect(screen.getByText(/Banking/i)).toBeInTheDocument();
    expect(screen.getByText(/Manage bank accounts and transactions in South Africa \(ZAR\) or Lesotho \(LSL\)/)).toBeInTheDocument();
  });

  it("renders bank accounts section and new account form", () => {
    render(<BankingPage />);
    expect(screen.getByRole("heading", { name: /Bank accounts/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /New bank account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Main operating account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save account/i })).toBeInTheDocument();
  });

  it("renders transactions section", () => {
    render(<BankingPage />);
    expect(screen.getByRole("heading", { name: /Transactions/i })).toBeInTheDocument();
    expect(screen.getByText(/Amounts in account currency \(ZAR\/LSL\)/)).toBeInTheDocument();
  });

  it("shows empty state when no accounts", () => {
    render(<BankingPage />);
    expect(screen.getByText(/No bank accounts yet\./)).toBeInTheDocument();
  });
});
