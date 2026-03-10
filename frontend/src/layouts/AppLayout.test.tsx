import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/utils";
import { AppLayout } from "./AppLayout";
import { Route, Routes } from "react-router-dom";

describe("AppLayout", () => {
  it("renders sidebar, topbar and outlet content", () => {
    render(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<span data-testid="outlet">Dashboard content</span>} />
        </Route>
      </Routes>,
      { initialEntries: ["/"] }
    );
    expect(screen.getAllByText("SmartSeen")[0]).toBeInTheDocument();
    expect(screen.getByTestId("outlet")).toHaveTextContent("Dashboard content");
    expect(screen.getByRole("button", { name: /user menu/i })).toBeInTheDocument();
  });
});
