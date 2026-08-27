import type { Express } from "express";
import { describe, expect, it, vi } from "vitest";
import { applyProductionRequestGuards, applyProductionSecurityHeaders } from "./securityHeaders";

describe("applyProductionSecurityHeaders", () => {
  it("기본 응답 보호 헤더와 API 캐시 금지를 적용한다", () => {
    const disable = vi.fn();
    const use = vi.fn();
    const app = { disable, use } as unknown as Express;
    const setHeader = vi.fn();
    const next = vi.fn();

    applyProductionSecurityHeaders(app);
    const middleware = use.mock.calls[0]?.[0];
    middleware({ path: "/api/trpc/assessment.list" }, { setHeader }, next);

    expect(disable).toHaveBeenCalledWith("x-powered-by");
    expect(setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(next).toHaveBeenCalledOnce();
  });

  it("정적 화면 응답에는 API 전용 캐시 금지를 붙이지 않는다", () => {
    const use = vi.fn();
    const app = { disable: vi.fn(), use } as unknown as Express;
    const setHeader = vi.fn();

    applyProductionSecurityHeaders(app);
    const middleware = use.mock.calls[0]?.[0];
    middleware({ path: "/" }, { setHeader }, vi.fn());

    expect(setHeader).not.toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});

describe("applyProductionRequestGuards", () => {
  it("다른 출처에서 보낸 API 상태 변경 요청을 거절한다", () => {
    const use = vi.fn();
    const app = { disable: vi.fn(), use } as unknown as Express;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    applyProductionRequestGuards(app);
    const middleware = use.mock.calls[0]?.[0];
    middleware(
      {
        method: "POST",
        path: "/api/trpc/auth.guestLogin",
        protocol: "https",
        get: (name: string) =>
          ({ origin: "https://other.example", host: "teachassist.example" })[name],
      },
      { status },
      vi.fn()
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "이 요청은 현재 서비스 화면에서만 실행할 수 있습니다." });
  });

  it("현재 출처와 Origin 없는 예약 작업 요청은 통과시킨다", () => {
    const use = vi.fn();
    const app = { disable: vi.fn(), use } as unknown as Express;
    applyProductionRequestGuards(app);
    const middleware = use.mock.calls[0]?.[0];
    const next = vi.fn();

    middleware(
      {
        method: "POST",
        path: "/api/trpc/assessment.create",
        protocol: "https",
        get: (name: string) =>
          ({ origin: "https://teachassist.example", host: "teachassist.example" })[name],
      },
      {},
      next
    );
    middleware({ method: "POST", path: "/api/scheduled/official-source-check", get: () => undefined }, {}, next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});
