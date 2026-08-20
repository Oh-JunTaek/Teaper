import { describe, expect, it } from "vitest";
import { courseReadiness, defaultCourse, listCourses, scopeLabel } from "./curriculumScope";

describe("curriculum scope catalog", () => {
  it("keeps middle school science and mathematics as distinct, concise entry paths", () => {
    expect(listCourses("middle", "science")).toEqual([{ value: "중등 과학", label: "중등 과학" }]);
    expect(defaultCourse("middle", "mathematics")).toBe("중등 수학");
  });

  it("offers high school common and science elective paths without exposing humanities subjects", () => {
    expect(listCourses("high", "science").map(course => course.value)).toEqual(expect.arrayContaining(["통합과학1", "물리학", "화학", "생명과학", "지구과학"]));
    expect(scopeLabel("high", "mathematics", "공통수학1")).toBe("고등학교 · 수학 · 공통수학1");
  });

  it("keeps the verified chemistry pilot distinct from limited pilots and preparing courses", () => {
    expect(courseReadiness("화학 I").status).toBe("ready");
    expect(courseReadiness("중등 수학").status).toBe("pilot");
    expect(courseReadiness("미적분Ⅰ").status).toBe("preparing");
  });
});
