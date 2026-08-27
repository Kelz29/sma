import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/utils";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("renders heading and sign-in links", () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/SmartSeen/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/register");
  });

  it("renders Create an account and Sign in CTA links", () => {
    render(<LandingPage />);
    expect(screen.getByRole("link", { name: /claim your free spot/i })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});
