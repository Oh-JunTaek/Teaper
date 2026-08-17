import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTeacherContext(): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 7,
      openId: "teacher-user",
      email: "teacher@example.com",
      name: "Teacher",
      loginMethod: "manus",
      role: "teacher",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("assessment admin access", () => {
  it("rejects a teacher attempting to view user roles", async () => {
    const caller = appRouter.createCaller(createTeacherContext());

    await expect(caller.assessment.admin.users()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
