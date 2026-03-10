import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/utils";
import { App } from "./App";

describe("App", () => {
  it("renders app routes inside router", () => {
    render(<App />, { initialEntries: ["/"] });
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
  });
});
