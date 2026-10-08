import { describe, expect, it } from "vitest";
import { hashLocalSecret, verifyLocalSecret } from "./localSecret";

describe("local password hash", () => {
  it("verifies the same secret and rejects a different one", () => {
    const stored = hashLocalSecret("gizli123");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyLocalSecret("gizli123", stored)).toBe(true);
    expect(verifyLocalSecret("yanlis", stored)).toBe(false);
    expect(verifyLocalSecret("gizli123", "bcrypt$not-local")).toBe(false);
  });
});
