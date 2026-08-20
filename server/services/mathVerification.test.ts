import { describe, expect, it } from "vitest";
import { verifyMiddleSchoolCalculation } from "./mathVerification";

describe("middle school math calculation verification", () => {
  it("verifies numeric expressions without using dynamic code execution", () => {
    expect(verifyMiddleSchoolCalculation({ kind: "numeric_expression", expression: "12*(3+2)/5", expectedAnswer: "12" })).toMatchObject({ status: "checked_match", computedAnswer: "12" });
  });

  it("solves a linear equation and a proportion from the provided expression", () => {
    expect(verifyMiddleSchoolCalculation({ kind: "linear_equation", expression: "2*x+3=11", expectedAnswer: "4" }).status).toBe("checked_match");
    expect(verifyMiddleSchoolCalculation({ kind: "proportion", expression: "2/3=x/9", expectedAnswer: "6" }).status).toBe("checked_match");
  });

  it("verifies mean and detects an inconsistent answer", () => {
    expect(verifyMiddleSchoolCalculation({ kind: "basic_statistics", expression: "mean(2,4,6)", expectedAnswer: "4" }).status).toBe("checked_match");
    expect(verifyMiddleSchoolCalculation({ kind: "numeric_expression", expression: "7+8", expectedAnswer: "16" })).toMatchObject({ status: "mismatch", computedAnswer: "15" });
  });

  it("keeps unsupported expressions for teacher review instead of guessing", () => {
    expect(verifyMiddleSchoolCalculation({ kind: "numeric_expression", expression: "sqrt(4)", expectedAnswer: "2" }).status).toBe("needs_teacher_review");
  });
});
