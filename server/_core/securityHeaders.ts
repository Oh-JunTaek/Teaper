import type { Express, RequestHandler } from "express";

/**
 * 교사 작업공간 공개 배포에 적용할 최소 응답 보안 정책입니다.
 * 외부 자료 미리보기·첨부 흐름을 막지 않는 범위에서 브라우저의 기본 보호를 강화합니다.
 */
export function applyProductionSecurityHeaders(app: Express) {
  app.disable("x-powered-by");

  const securityHeaders: RequestHandler = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // 교사별 자료·문항 응답이 브라우저나 중간 저장소에 남지 않게 API 응답을 저장하지 않습니다.
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }

    next();
  };

  app.use(securityHeaders);
}

/**
 * SameSite=None 세션 쿠키와 함께 쓰는 최소 CSRF 방어입니다.
 * API의 상태 변경 요청은 현재 서비스 출처 또는 플랫폼 예약 작업처럼 Origin이 없는 요청만 허용합니다.
 */
export function applyProductionRequestGuards(app: Express) {
  const requestGuard: RequestHandler = (req, res, next) => {
    const isWriteRequest = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    if (!isWriteRequest || !req.path.startsWith("/api/")) {
      next();
      return;
    }

    const origin = req.get("origin");
    // 플랫폼 예약 작업·서버 간 요청은 별도 인증을 거치므로 Origin이 없을 때 이 미들웨어에서 차단하지 않습니다.
    if (!origin) {
      next();
      return;
    }

    const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedProtocol = forwardedProtocol || req.protocol;
    const expectedHost = forwardedHost || req.get("host");

    try {
      const originUrl = new URL(origin);
      const isSameOrigin =
        originUrl.protocol === `${expectedProtocol}:` &&
        originUrl.host.toLowerCase() === expectedHost?.toLowerCase();
      if (isSameOrigin) {
        next();
        return;
      }
    } catch {
      // 유효하지 않은 Origin은 아래 공통 거절 응답으로 처리합니다.
    }

    res.status(403).json({ error: "이 요청은 현재 서비스 화면에서만 실행할 수 있습니다." });
  };

  app.use(requestGuard);
}
