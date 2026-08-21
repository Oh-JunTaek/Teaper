package com.eunmastudio.teacherworkspace.ai

/**
 * 웹·Windows 로컬 앱의 출제 보조 원칙을 Android 로컬 모델에도 적용한다.
 * 모델이 달라져도 근거 사용·비복제·교사 검수 원칙은 바뀌지 않는다.
 */
object QuestionPromptContract {
    const val VERSION = "chem-rag-v1.1-mobile"

    private val generationRules = listOf(
        "당신은 학교 평가 문항을 설계하는 출제 보조자입니다. 결과는 교사가 검수하는 문항이며, 최종 시험지로 단정하지 마십시오.",
        "제공된 교육과정·출제 지침·기출 유형 근거 안에서만 문항을 작성하십시오. 근거에 없는 사실·수치·실험 조건을 추정해 넣지 마십시오.",
        "기출문제의 문장, 수치, 선지 순서, 자료 구성, 정답 논리를 복제하거나 가깝게 바꾸지 마십시오. 유형과 평가 요소만 참고하십시오.",
        "질문·보기·정답·해설·출제 의도는 서로 모순되지 않아야 합니다. 보기에는 하나의 가장 적절한 정답만 있어야 합니다.",
        "그래프 해석형은 그래프 모양을 괄호 설명으로 대체하지 말고 ‘다음 그래프’를 전제로 질문을 작성하십시오.",
        "다음 JSON 키만 사용하십시오: stem, choices, answer, explanation, intent, sourceNotes, reviewWarnings.",
    ).joinToString("\n")

    fun generationPrompt(
        request: String,
        sourceSummaries: String,
        teacherInstructions: String,
    ): String = buildString {
        appendLine(generationRules)
        appendLine()
        appendLine("[자료 근거]")
        appendLine(sourceSummaries.ifBlank { "교사가 아직 자료 요약을 입력하지 않았습니다. 자료 없는 사실을 만들지 말고, 필요한 근거를 요청하십시오." })
        appendLine()
        appendLine("[교사의 추가 작성 선호]")
        appendLine(teacherInstructions.ifBlank { "없음" })
        appendLine()
        appendLine("[문항 생성 요청]")
        appendLine(request)
    }

    fun reviewPrompt(draft: String, sourceSummaries: String): String = buildString {
        appendLine("당신은 학교 평가 문항의 독립 검증자입니다. 생성 모델의 판단을 신뢰하지 말고 근거와 문항을 다시 대조하십시오.")
        appendLine("근거 밖의 사실, 정답·해설 불일치, 단원 이탈, 난이도 부적합, 출제 지침 위반, 기출 실질 복제가 하나라도 있으면 통과로 판단하지 마십시오.")
        appendLine("모호한 경우에는 교사 확인이 필요하도록 보수적으로 판단하십시오.")
        appendLine("다음 JSON 키만 사용하십시오: passed, reasons, citationsToCheck, correctionSuggestions.")
        appendLine()
        appendLine("[자료 근거]")
        appendLine(sourceSummaries)
        appendLine()
        appendLine("[검수할 문항]")
        appendLine(draft)
    }
}
