import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createPilotAccessToken, hasPilotAccess, hasValidGuestCredentials, hasValidPilotInvite, PILOT_ACCESS_COOKIE } from "./services/pilotAccess";
import type { TrpcContext } from "./_core/context";

function createPublicContext() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.pilotAccess", () => {
  it("accepts the configured server-only pilot access code and writes a protected access cookie", async () => {
    const configuredCode = process.env.PILOT_ACCESS_CODE;
    expect(configuredCode).toBeTruthy();
    const { ctx, cookies } = createPublicContext();
    const result = await appRouter.createCaller(ctx).auth.pilotAccess({ inviteCode: configuredCode! });
    expect(result).toEqual({ success: true });
    expect(cookies[0]).toMatchObject({ name: PILOT_ACCESS_COOKIE, options: { httpOnly: true, secure: true, sameSite: "none", path: "/" } });
  });

  it("accepts the configured guest credential only and rejects incorrect access values", () => {
    expect(hasValidGuestCredentials("guest", process.env.GUEST_LOGIN_PASSWORD || "")).toBe(true);
    expect(hasValidGuestCredentials("guest", "wrong-password")).toBe(false);
    expect(hasValidPilotInvite("wrong-invite-code")).toBe(false);
  });

  it("recognizes only a signed pilot access cookie as an invited browser session", async () => {
    const pilotToken = await createPilotAccessToken();
    const { ctx } = createPublicContext();
    ctx.req.headers.cookie = `${PILOT_ACCESS_COOKIE}=${pilotToken}`;
    expect(await hasPilotAccess(ctx.req)).toBe(true);
    ctx.req.headers.cookie = `${PILOT_ACCESS_COOKIE}=not-a-valid-session`;
    expect(await hasPilotAccess(ctx.req)).toBe(false);
  });
});
