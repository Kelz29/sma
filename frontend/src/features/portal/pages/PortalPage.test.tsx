import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { PortalPage } from "./PortalPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("PortalPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/portal/me") return Promise.resolve({ data: { id: 1, first_name: "Jane", last_name: "Doe", employee_number: "E001", email: "j@test.com", department: "IT", job_title: "Dev", bank_name: "FNB", currency: "ZAR" } });
      if (url.includes("/portal/leave")) return Promise.resolve({ data: [] });
      if (url.includes("/leave/types")) return Promise.resolve({ data: [] });
      if (url === "/portal/attendance") return Promise.resolve({ data: [] });
      if (url === "/portal/payslips") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders My portal heading and tabs when profile loaded", async () => {
    render(<PortalPage />);
    expect(screen.getByText(/My portal/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My details/i })).toBeInTheDocument();
    await screen.findByRole("button", { name: /^Leave$/ });
    expect(screen.getByRole("button", { name: /^Attendance$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Payslips$/ })).toBeInTheDocument();
  });

  it("shows My details with name and employee number when profile loaded", async () => {
    render(<PortalPage />);
    expect(await screen.findByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/E001/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit details/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profile/i })).toBeInTheDocument();
  });
});
