export function fallbackOptions(input) {
  const status = Number(input.status || 0);
  const message = String(input.message || "").toLowerCase();
  const kind = status === 401 || status === 403 || /api.?key|unauthori[sz]ed|authentication/.test(message) ? "api_key_error"
    : status === 429 || /quota|rate.?limit|limit exceeded/.test(message) ? "quota_exceeded"
      : status >= 500 || /network|timeout|unavailable|fetch failed/.test(message) ? "provider_unavailable" : "provider_error";
  const label = kind === "api_key_error" ? "개인 API 키를 확인하세요." : kind === "quota_exceeded" ? "개인 API의 무료 한도 또는 호출 제한에 도달했습니다." : kind === "provider_unavailable" ? "개인 AI 제공자에 연결할 수 없습니다." : "개인 AI 제공자 요청을 처리하지 못했습니다.";
  return { kind, message: label, automaticSwitch: false, choices: [{ id: "retry_external", label: "설정 확인 후 다시 시도" }, ...(input.localRuntimeAvailable ? [{ id: "use_local_model", label: "로컬 모델로 새 요청 시작" }] : []), { id: "manual_review", label: "AI 없이 수동으로 문항 작성·검수" }] };
}
