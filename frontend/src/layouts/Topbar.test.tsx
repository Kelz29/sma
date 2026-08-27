import { describe, it, expect, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/utils";
import { Topbar } from "./Topbar";
import { useAuthStore } from "@/store/authStore";

describe("Topbar", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("renders header with theme toggle and logout", () => {
    render(<Topbar />);
    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("logs out and clears auth state when Logout is clicked", async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: "1", email: "user@example.com", role: "admin" },
    });

    render(<Topbar />);
    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
