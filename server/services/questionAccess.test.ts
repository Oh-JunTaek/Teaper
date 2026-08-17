import { describe, expect, it } from "vitest";
import { canAccessGeneratedQuestion } from "./questionAccess";

describe("generated question access", () => {
  it("allows a teacher to access only their own question", () => {
    expect(canAccessGeneratedQuestion({ viewerId: 3, viewerRole: "teacher", creatorId: 3 })).toBe(true);
    expect(canAccessGeneratedQuestion({ viewerId: 3, viewerRole: "teacher", creatorId: 4 })).toBe(false);
  });

  it("allows an administrator to access any teacher question", () => {
    expect(canAccessGeneratedQuestion({ viewerId: 1, viewerRole: "admin", creatorId: 4 })).toBe(true);
  });
});
