import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { ReportsPage } from "./ReportsPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/reports/")) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders Reports page", () => {
    render(<ReportsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Reports/i })).toBeInTheDocument();
  });
});
