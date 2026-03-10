import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("starts with null auth", () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().tenantId).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("setAuth updates state", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: "1", email: "a@b.com", role: "admin" },
    });
    expect(useAuthStore.getState().accessToken).toBe("token");
    expect(useAuthStore.getState().tenantId).toBe("1");
    expect(useAuthStore.getState().user?.email).toBe("a@b.com");
  });

  it("clearAuth resets state", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      tenantId: "1",
      user: { id: "1", email: "a@b.com", role: "admin" },
    });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
