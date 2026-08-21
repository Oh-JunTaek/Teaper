package com.eunmastudio.teacherworkspace.ai

/**
 * 시스템 지시문은 서비스 내부 구성 정보이므로 대화 화면·저장 이력·모델 응답으로 공개하지 않는다.
 * 작은 온디바이스 모델의 지시 따르기 편차를 고려해 모델 지시와 별도로 입력·출력 양쪽에서 방어한다.
 */
object PromptDisclosurePolicy {
    const val SAFE_REPLY = "내부 설정·지시문은 공개하지 않습니다. 대신 이 채팅에서 지원하는 기능과 자료 처리·보안 원칙은 안내할 수 있습니다."

    private val directDisclosureTerms = listOf(
        "시스템메시지", "시스템지시", "시스템프롬프트", "내부지시", "내부규칙",
        "내부프롬프트", "운영프롬프트", "숨겨진지시", "초기지시",
    )

    private val requestVerbs = listOf("보여", "알려", "공개", "출력", "말해", "나열", "반복", "실토")
    private val outputMarkers = listOf(
        "핵심적인 시스템 지시", "시스템 지시사항", "내부 실행 지시",
        "역할 정의", "제한 사항", "다음과 같습니다",
    )

    fun safeResponseFor(userMessage: String): String? {
        val compact = userMessage.lowercase().replace(Regex("\\s+"), "")
        val directlyRequested = directDisclosureTerms.any(compact::contains)
        val asksForAssignedRules = compact.contains("너에게주어진") &&
            listOf("프롬프트", "지시", "규칙", "메시지").any(compact::contains)
        val asksToReveal = requestVerbs.any { compact.contains(it) }
        // “시스템메시지가 있어?”처럼 존재 여부만 묻고 다음 차례에 공개를 요구하는 우회도 차단한다.
        return if (directlyRequested || asksForAssignedRules || asksToReveal && compact.contains("프롬프트")) SAFE_REPLY else null
    }

    /** 모델이 입력 방어를 우회해 내부 지시문 형식의 답을 만들었을 때도 저장 전에 대체한다. */
    fun isPotentialDisclosure(modelResponse: String): Boolean {
        val normalized = modelResponse.lowercase()
        val mentionsInstruction = normalized.contains("시스템 지시") || normalized.contains("시스템 프롬프트") ||
            normalized.contains("내부 지시") || normalized.contains("내부 규칙")
        val includesStructuredReveal = outputMarkers.count { normalized.contains(it) } >= 2 ||
            normalized.contains("eunmastudio 문제 출제 워크스페이스의 교사용 온디바이스 ai")
        return mentionsInstruction && includesStructuredReveal
    }
}
