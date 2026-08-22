import crypto from "node:crypto";
import http from "node:http";
import { inspectHardware } from "./hardware.mjs";
import { fallbackOptions } from "./fallback.mjs";
import { isAllowedRecommendedModel, ollamaInstallPlan, recommendLocalModels } from "./setupPlan.mjs";

const OLLAMA_URL = "http://127.0.0.1:11434";
const LLAMA_CPP_URL = process.env.LLAMA_CPP_BASE_URL || "http://127.0.0.1:8080";
function localAddress(address) { return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"; }
async function body(request) { const buffers = []; for await (const item of request) buffers.push(item); return buffers.length ? JSON.parse(Buffer.concat(buffers).toString("utf8")) : {}; }
function send(response, status, value) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(value)); }
async function ollama(path, options) { const response = await fetch(`${OLLAMA_URL}${path}`, options); if (!response.ok) throw new Error(`Ollama 응답 오류 (${response.status})`); return response.json(); }
function assertLoopbackUrl(value) { const url = new URL(value); if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) throw new Error("로컬 모델 URL은 loopback 주소여야 합니다."); return url.toString().replace(/\/$/, ""); }
async function llama(path, options) { const response = await fetch(`${assertLoopbackUrl(LLAMA_CPP_URL)}${path}`, options); if (!response.ok) throw new Error(`llama.cpp 응답 오류 (${response.status})`); return response.json(); }
async function runtimeStatus() {
  const result = { ollama: { installed: false, running: false, models: [] }, llamaCpp: { installed: false, running: false, models: [] } };
  try { const value = await ollama("/api/tags"); result.ollama = { installed: true, running: true, models: (value.models || []).map(model => model.name) }; } catch { /* local runtime absent */ }
  try { await llama("/health"); let models = []; try { const catalog = await llama("/v1/models"); models = (catalog.data || []).map(model => model.id); } catch { /* health is enough for runtime state */ } result.llamaCpp = { installed: true, running: true, models }; } catch { /* local runtime absent */ }
  return result;
}

async function setupPlan() {
  const hardware = await inspectHardware();
  const runtimes = await runtimeStatus();
  return { localOnly: true, install: ollamaInstallPlan(), hardware, recommendation: recommendLocalModels(hardware), runtimes };
}

export async function createLocalBridge() {
  const token = crypto.randomBytes(32).toString("base64url");
  const server = http.createServer(async (request, response) => {
    if (!localAddress(request.socket.remoteAddress)) return send(response, 403, { error: "loopback 연결만 허용됩니다." });
    if (request.headers.authorization !== `Bearer ${token}`) return send(response, 401, { error: "유효하지 않은 데스크톱 세션입니다." });
    try {
      if (request.method === "GET" && request.url === "/health") return send(response, 200, { localOnly: true, ollamaUrl: OLLAMA_URL, llamaCppUrl: assertLoopbackUrl(LLAMA_CPP_URL), status: "ready" });
      if (request.method === "GET" && request.url === "/hardware") return send(response, 200, await inspectHardware());
      if (request.method === "GET" && request.url === "/runtimes") return send(response, 200, await runtimeStatus());
      if (request.method === "GET" && request.url === "/models") return send(response, 200, await runtimeStatus());
      if (request.method === "GET" && request.url === "/setup-plan") return send(response, 200, await setupPlan());
      if (request.method === "POST" && request.url === "/models/pull") {
        const input = await body(request);
        if (typeof input.model !== "string" || !isAllowedRecommendedModel(input.model)) return send(response, 400, { error: "교사도우미 권장 모델만 준비할 수 있습니다." });
        if (input.confirmDownload !== true) return send(response, 400, { error: "모델 다운로드와 해당 모델의 라이선스 확인에 동의해 주세요." });
        const result = await ollama("/api/pull", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: input.model, stream: false }), signal: AbortSignal.timeout(30 * 60_000) });
        return send(response, 200, { success: true, model: input.model, result, localOnly: true });
      }
      if (request.method === "POST" && request.url === "/generate") {
        const input = await body(request);
        if (typeof input.model !== "string" || typeof input.prompt !== "string") return send(response, 400, { error: "model과 prompt가 필요합니다." });
        if (input.runtime === "llama_cpp") {
          const options = input.options || {};
          const result = await llama("/completion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: input.prompt, n_predict: options.num_predict || options.maxTokens || 1024, temperature: options.temperature ?? 0.2, top_k: options.top_k, top_p: options.top_p }) });
          return send(response, 200, { response: result.content, model: input.model, runtime: "llama_cpp", localOnly: true });
        }
        const result = await ollama("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: input.model, prompt: input.prompt, stream: false, options: input.options || {}, ...(input.think === true ? { think: true } : {}) }) });
        return send(response, 200, { response: result.response, model: result.model, runtime: "ollama", localOnly: true });
      }
      if (request.method === "POST" && request.url === "/fallback-options") { const failure = await body(request); const runtimes = await runtimeStatus(); return send(response, 200, fallbackOptions({ ...failure, localRuntimeAvailable: runtimes.ollama.running || runtimes.llamaCpp.running })); }
      return send(response, 404, { error: "지원하지 않는 경로입니다." });
    } catch (error) { return send(response, 503, { error: error instanceof Error ? error.message : "로컬 모델에 연결하지 못했습니다.", fallback: "자동 전환하지 않았습니다. 수동 검수 또는 다른 실행 방식을 선택하세요." }); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, token, port: typeof address === "object" && address ? address.port : 0 };
}
