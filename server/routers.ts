import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { assessmentRouter } from "./routers/assessment";
import { createPilotAccessToken, GUEST_OPEN_ID, GUEST_SESSION_DURATION_MS, hasPilotAccess, hasValidGuestCredentials, hasValidPilotInvite, PILOT_ACCESS_COOKIE, PILOT_ACCESS_DURATION_MS } from "./services/pilotAccess";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    pilotStatus: publicProcedure.query(async ({ ctx }) => ({ granted: await hasPilotAccess(ctx.req) })),
    pilotAccess: publicProcedure.input(z.object({ inviteCode: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      if (!hasValidPilotInvite(input.inviteCode)) throw new TRPCError({ code: "FORBIDDEN", message: "파일럿 접근 코드가 올바르지 않습니다." });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const accessToken = await createPilotAccessToken();
      ctx.res.cookie(PILOT_ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: PILOT_ACCESS_DURATION_MS });
      return { success: true } as const;
    }),
    guestLogin: publicProcedure.input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      if (!(await hasPilotAccess(ctx.req))) throw new TRPCError({ code: "FORBIDDEN", message: "공유 링크의 파일럿 접근 코드부터 확인해 주세요." });
      if (!hasValidGuestCredentials(input.username, input.password)) throw new TRPCError({ code: "UNAUTHORIZED", message: "게스트 ID 또는 비밀번호가 올바르지 않습니다." });
      await db.upsertUser({ openId: GUEST_OPEN_ID, name: "파일럿 게스트", email: null, loginMethod: "guest", lastSignedIn: new Date() });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const sessionToken = await sdk.createSessionToken(GUEST_OPEN_ID, { name: "파일럿 게스트", expiresInMs: GUEST_SESSION_DURATION_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: GUEST_SESSION_DURATION_MS });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  assessment: assessmentRouter,
});

export type AppRouter = typeof appRouter;
