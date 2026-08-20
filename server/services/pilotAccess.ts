import { createHash, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";

export const PILOT_ACCESS_COOKIE = "teacher_pilot_access";
export const GUEST_OPEN_ID = "guest:teacher-assessment-pilot";
export const GUEST_USERNAME = "guest";
export const PILOT_ACCESS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

// 길이·내용 비교 시간을 일정하게 유지해 초대 코드·게스트 비밀번호 추측을 어렵게 합니다.
export function secretsMatch(candidate: string, expected: string) {
  if (!candidate || !expected) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function hasValidPilotInvite(inviteCode: string) {
  return secretsMatch(inviteCode, ENV.pilotAccessCode);
}

export function hasValidGuestCredentials(username: string, password: string) {
  return username.trim().toLowerCase() === GUEST_USERNAME && secretsMatch(password, ENV.guestLoginPassword);
}

export async function createPilotAccessToken() {
  return sdk.signSession({ openId: "pilot_access", appId: ENV.appId, name: "shared-link" }, { expiresInMs: PILOT_ACCESS_DURATION_MS });
}

export async function hasPilotAccess(req: Request) {
  const cookieValue = parseCookieHeader(req.headers.cookie ?? "")[PILOT_ACCESS_COOKIE];
  const session = await sdk.verifySession(cookieValue);
  return Boolean(session && session.openId === "pilot_access" && session.appId === ENV.appId && session.name === "shared-link");
}
