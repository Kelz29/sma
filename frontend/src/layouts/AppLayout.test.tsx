import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/utils";
import { AppLayout } from "./AppLayout";
import { Route, Routes } from "react-router-dom";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: { name: "Test Co", logo_url: null, primary_color: null, secondary_color: null },
    }),
  },
}));

describe("AppLayout", () => {
  it("renders sidebar, topbar and outlet content", async () => {
    render(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<span data-testid="outlet">Dashboard content</span>} />
        </Route>
      </Routes>,
      { initialEntries: ["/"] }
    );
    expect((await screen.findAllByText(/SmartSeen/i)).length).toBeGreaterThan(0);
    expect(screen.getByTestId("outlet")).toHaveTextContent("Dashboard content");
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });
});
