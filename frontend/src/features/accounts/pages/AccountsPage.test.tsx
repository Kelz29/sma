import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { AccountsPage } from "./AccountsPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("AccountsPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
  });

  it("renders Chart of Accounts heading", async () => {
    render(<AccountsPage />);
    expect(screen.getByText(/Chart of Accounts/i)).toBeInTheDocument();
  });
});
