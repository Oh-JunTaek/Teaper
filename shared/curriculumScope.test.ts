import { describe, expect, it } from "vitest";
import { courseReadiness, defaultCourse, filterCoursesByReadiness, listCourses, scopeLabel } from "./curriculumScope";

describe("curriculum scope catalog", () => {
  it("keeps middle school science and mathematics as distinct, concise entry paths", () => {
    expect(listCourses("middle", "science")).toEqual([{ value: "중등 과학", label: "중등 과학" }]);
    expect(defaultCourse("middle", "mathematics")).toBe("중등 수학");
  });

  it("offers high school common and science elective paths without exposing humanities subjects", () => {
    expect(listCourses("high", "science").map(course => course.value)).toEqual(expect.arrayContaining(["통합과학1", "물리학", "화학", "생명과학", "지구과학"]));
    expect(scopeLabel("high", "mathematics", "공통수학1")).toBe("고등학교 · 수학 · 공통수학1");
    expect(listCourses("high", "mathematics").map(course => course.value)).toEqual(expect.arrayContaining(["대수", "미적분Ⅰ", "확률과 통계"]));
  });

  it("keeps the verified chemistry pilot distinct from limited pilots and preparing courses", () => {
    expect(courseReadiness("화학 I").status).toBe("ready");
    expect(courseReadiness("중등 수학").status).toBe("pilot");
    expect(courseReadiness("대수").status).toBe("preparing");
    expect(courseReadiness("미적분Ⅰ").status).toBe("preparing");
    expect(courseReadiness("확률과 통계").status).toBe("preparing");
  });

  it("filters a teacher's course list by readiness without changing the course catalog", () => {
    expect(filterCoursesByReadiness("high", "mathematics", "pilot").map(course => course.value)).toEqual(["공통수학1", "공통수학2"]);
    expect(filterCoursesByReadiness("high", "mathematics", "preparing").map(course => course.value)).toEqual(["대수", "미적분Ⅰ", "확률과 통계"]);
    expect(filterCoursesByReadiness("high", "science", "ready").map(course => course.value)).toEqual(["화학 I"]);
  });
});
