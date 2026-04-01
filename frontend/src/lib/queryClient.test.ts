import { describe, it, expect } from "vitest";
import axios from "axios";
import { queryClient, shouldRetryQuery } from "./queryClient";

describe("queryClient", () => {
  it("has default options for queries", () => {
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
    expect(queryClient.getDefaultOptions().queries?.refetchOnReconnect).toBe(false);
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });

  it("does not retry on 4xx axios errors", () => {
    const err = new axios.AxiosError("bad", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      data: {},
      statusText: "Bad Request",
      headers: {},
      config: {} as never,
    });
    expect(shouldRetryQuery(0, err)).toBe(false);
  });

  it("allows one retry for network-style failures", () => {
    const err = new axios.AxiosError("Network Error", "ERR_NETWORK");
    expect(shouldRetryQuery(0, err)).toBe(true);
    expect(shouldRetryQuery(1, err)).toBe(false);
  });
});
