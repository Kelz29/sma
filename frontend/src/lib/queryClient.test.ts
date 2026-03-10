import { describe, it, expect } from "vitest";
import { queryClient } from "./queryClient";

describe("queryClient", () => {
  it("has default options for queries", () => {
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(1);
  });
});
