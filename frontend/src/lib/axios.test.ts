import { describe, it, expect, beforeEach } from "vitest";
import { api } from "./axios";
import { useAuthStore } from "@/store/authStore";

describe("api", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("has default baseURL and withCredentials", () => {
    expect(api.defaults.baseURL).toBeDefined();
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("request interceptor adds Authorization and X-Tenant-Id when auth is set", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      tenantId: "42",
      user: { id: 1, email: "u@test.com", role: "admin" },
    });
    const res = await api.get("/dummy", {
      adapter: (config) => {
        expect(config.headers?.Authorization).toBe("Bearer test-token");
        expect(config.headers?.["X-Tenant-Id"]).toBe("42");
        return Promise.resolve({
          data: {},
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
      },
    });
    expect(res.status).toBe(200);
  });

  it("response interceptor clears auth on 401", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: 1, email: "u@test.com", role: "admin" },
    });
    try {
      await api.get("/any", {
        adapter: () =>
          Promise.reject(
            Object.assign(new Error("Unauthorized"), { response: { status: 401 } })
          ),
      });
    } catch {
      // expected
    }
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
