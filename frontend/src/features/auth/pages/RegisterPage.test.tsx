import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/utils";
import { RegisterPage } from "./RegisterPage";
import * as axios from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  api: { post: vi.fn() },
}));

describe("RegisterPage", () => {
  beforeEach(() => vi.mocked(axios.api.post).mockReset());

  it("renders create account form", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business slug/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});
