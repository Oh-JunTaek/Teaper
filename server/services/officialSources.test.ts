import { describe, expect, it } from "vitest";
import { assertAllowedOfficialSourceUrl, fingerprint, normalizePage } from "./officialSources";

describe("official source safety", () => {
  it("normalizes changing script and whitespace content before fingerprinting", () => {
    const first = normalizePage("<html>  <title>교육과정</title><script>v=1</script><body> 과학과 </body></html>");
    const second = normalizePage("<html><title>교육과정</title><script>v=2</script><body>과학과</body></html>");

    expect(first).toBe(second);
    expect(fingerprint(first)).toBe(fingerprint(second));
  });

  it("allows official education domains over HTTPS and rejects unsafe endpoints", () => {
    expect(assertAllowedOfficialSourceUrl("https://ncic.re.kr/inv/org/list.do").hostname).toBe("ncic.re.kr");
    expect(() => assertAllowedOfficialSourceUrl("http://ncic.re.kr/inv/org/list.do")).toThrow("HTTPS");
    expect(() => assertAllowedOfficialSourceUrl("https://127.0.0.1/private")).toThrow("공식 도메인");
  });
});
