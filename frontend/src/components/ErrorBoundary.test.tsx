import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/utils";
import { ErrorBoundary } from "./ErrorBoundary";

const Throw = () => {
  throw new Error("Test error");
};

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <span data-testid="child">OK</span>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("OK");
  });

  it("renders default fallback when child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throw />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/the page encountered an error/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("renders custom fallback when provided", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div data-testid="custom">Custom fallback</div>}>
        <Throw />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("custom")).toHaveTextContent("Custom fallback");
    vi.restoreAllMocks();
  });

  it("Try again button resets error state (child may rethrow)", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throw />
      </ErrorBoundary>
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
