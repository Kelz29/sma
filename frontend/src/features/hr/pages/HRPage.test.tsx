import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { HRPage } from "./HRPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("HRPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/employees/") return Promise.resolve({ data: [] });
      if (url.includes("/leave/types")) return Promise.resolve({ data: [] });
      if (url.includes("/leave/requests")) return Promise.resolve({ data: [] });
      if (url.includes("/attendance")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders HR & Payroll heading and tabs", async () => {
    render(<HRPage />);
    expect(screen.getByText(/HR & Payroll/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Employees/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Leave/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Attendance/i })).toBeInTheDocument();
  });

  it("renders employees tab by default with Add employee button", () => {
    render(<HRPage />);
    expect(screen.getByRole("button", { name: /\+ Add employee/i })).toBeInTheDocument();
    expect(screen.getByText(/No employees yet/i)).toBeInTheDocument();
  });
});
