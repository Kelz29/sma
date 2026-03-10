import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/utils";
import { LoginPage } from "./LoginPage";
import { api } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it("renders login form with email, password, tenant slug", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tenant slug/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error when login fails", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "pass");
    await user.type(screen.getByLabelText(/tenant slug/i), "demo");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/Login failed/i)).toBeInTheDocument();
  });
});
