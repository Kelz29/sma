import { describe, it, expect } from "vitest";
import { decodeAccessToken } from "./LoginPage";

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

describe("decodeAccessToken", () => {
  it("returns null for invalid token", () => {
    expect(decodeAccessToken("")).toBeNull();
    expect(decodeAccessToken("a.b")).toBeNull();
    expect(decodeAccessToken("a.b.c.d")).toBeNull();
  });

  it("decodes valid JWT payload", () => {
    const payload = { sub: "1", tenant_id: 2, role: "admin" };
    const token = `header.${b64(JSON.stringify(payload))}.sig`;
    expect(decodeAccessToken(token)).toEqual({
      userId: "1",
      tenantId: 2,
      role: "admin",
    });
  });

  it("returns null when required fields missing", () => {
    const payload = { sub: "1" };
    const token = `header.${b64(JSON.stringify(payload))}.sig`;
    expect(decodeAccessToken(token)).toBeNull();
  });
});
