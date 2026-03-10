import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/utils";
import { AppProviders } from "./AppProviders";

describe("AppProviders", () => {
  it("renders children", () => {
    render(
      <AppProviders>
        <span data-testid="child">Child content</span>
      </AppProviders>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Child content");
  });
});
