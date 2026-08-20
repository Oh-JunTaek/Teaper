export type CalculationKind = "numeric_expression" | "linear_equation" | "proportion" | "basic_statistics";
export type CalculationSpec = { kind: CalculationKind; expression: string; expectedAnswer: string };
export type CalculationCheck = {
  status: "checked_match" | "mismatch" | "needs_teacher_review" | "not_applicable";
  label: string;
  detail: string;
  computedAnswer?: string;
};

const numericPattern = /^[0-9xX+\-*/().\s]+$/;

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
}

function tokenize(expression: string) {
  const input = expression.replace(/\s+/g, "").replace(/X/g, "x");
  if (!numericPattern.test(input)) throw new Error("허용되지 않는 계산식입니다.");
  const tokens = input.match(/\d+(?:\.\d+)?|[x()+\-*/]/g) || [];
  if (tokens.join("") !== input) throw new Error("계산식을 읽을 수 없습니다.");
  return tokens;
}

function evaluateExpression(expression: string, xValue?: number) {
  const tokens = tokenize(expression);
  let index = 0;
  const parsePrimary = (): number => {
    const token = tokens[index++];
    if (token === "(") { const value = parseAdditive(); if (tokens[index++] !== ")") throw new Error("괄호가 닫히지 않았습니다."); return value; }
    if (token === "-") return -parsePrimary();
    if (token === "x") { if (xValue === undefined) throw new Error("미지수 값을 확인할 수 없습니다."); return xValue; }
    if (token && /^\d/.test(token)) return Number(token);
    throw new Error("계산식을 읽을 수 없습니다.");
  };
  const parseMultiplicative = (): number => {
    let value = parsePrimary();
    while (["*", "/"].includes(tokens[index])) { const operator = tokens[index++]; const right = parsePrimary(); if (operator === "/" && right === 0) throw new Error("0으로 나눌 수 없습니다."); value = operator === "*" ? value * right : value / right; }
    return value;
  };
  const parseAdditive = (): number => {
    let value = parseMultiplicative();
    while (["+", "-"].includes(tokens[index])) { const operator = tokens[index++]; const right = parseMultiplicative(); value = operator === "+" ? value + right : value - right; }
    return value;
  };
  const value = parseAdditive();
  if (index !== tokens.length || !Number.isFinite(value)) throw new Error("계산식을 읽을 수 없습니다.");
  return value;
}

function parseExpected(value: string) {
  const normalized = value.trim();
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) throw new Error("정답이 단일 수치가 아닙니다.");
  return Number(normalized);
}

function evaluateStatistics(expression: string) {
  const match = expression.replace(/\s+/g, "").match(/^(mean|median)\(([-+]?\d+(?:\.\d+)?(?:,[-+]?\d+(?:\.\d+)?)+)\)$/i);
  if (!match) throw new Error("평균 또는 중앙값 형식이 아닙니다.");
  const values = match[2].split(",").map(Number).sort((a, b) => a - b);
  if (match[1].toLowerCase() === "mean") return values.reduce((sum, value) => sum + value, 0) / values.length;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

export function verifyMiddleSchoolCalculation(spec?: CalculationSpec | null): CalculationCheck {
  if (!spec) return { status: "not_applicable", label: "대상 아님", detail: "계산 대조 대상이 아닌 문항입니다." };
  try {
    const expected = parseExpected(spec.expectedAnswer);
    let computed: number;
    if (spec.kind === "numeric_expression") computed = evaluateExpression(spec.expression);
    else if (spec.kind === "basic_statistics") computed = evaluateStatistics(spec.expression);
    else {
      const [left, right, ...rest] = spec.expression.split("=");
      if (!left || !right || rest.length) throw new Error("등식 형식이 아닙니다.");
      const constant = evaluateExpression(`${left}-(${right})`, 0);
      const coefficient = evaluateExpression(`${left}-(${right})`, 1) - constant;
      if (Math.abs(coefficient) < 1e-10) throw new Error("일차식의 해를 하나로 정할 수 없습니다.");
      computed = -constant / coefficient;
    }
    const computedAnswer = formatNumber(computed);
    if (Math.abs(computed - expected) < 1e-8) return { status: "checked_match", label: "일치", detail: "계산 확인 결과가 문항 정답과 일치합니다.", computedAnswer };
    return { status: "mismatch", label: "불일치", detail: "계산 확인 결과와 문항 정답이 다릅니다. 교사가 식·조건·정답을 수정해야 합니다.", computedAnswer };
  } catch (error) {
    return { status: "needs_teacher_review", label: "교사 확인 필요", detail: error instanceof Error ? error.message : "계산식을 확인할 수 없습니다." };
  }
}
