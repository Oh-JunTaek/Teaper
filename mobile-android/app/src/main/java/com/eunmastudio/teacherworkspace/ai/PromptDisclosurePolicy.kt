package com.eunmastudio.teacherworkspace.ai

/** 내부 시스템 지시문·모델 운용 규칙의 직접·간접 추출을 모델 호출 전에 막는다. */
object PromptDisclosurePolicy {
    const val SAFE_REPLY = "내부 설정·지시문은 공개하지 않습니다. 대신 이 채팅에서 지원하는 기능과 자료 처리·보안 원칙은 안내해 드릴 수 있습니다."

    fun safeResponseFor(input: String): String? = if (isDisclosureRequest(input)) SAFE_REPLY else null

    fun isPotentialDisclosure(output: String): Boolean {
        val normalized = normalize(output)
        return normalized.contains("시스템지시") || normalized.contains("내부지시") ||
            normalized.contains("핵심시스템") || normalized.contains("역할정의") && normalized.contains("제한사항")
    }

    private fun isDisclosureRequest(input: String): Boolean {
        val normalized = normalize(input)
        val disclosureTerms = listOf("프롬프트", "시스템메시지", "시스템지시", "내부지시", "내부규칙", "개발자지시", "systemprompt")
        val extractionTerms = listOf("보여", "출력", "공개", "나열", "번역", "요약", "재구성", "base64", "인코딩", "알려")
        return disclosureTerms.any(normalized::contains) && extractionTerms.any(normalized::contains) ||
            normalized.contains("이전규칙") || normalized.contains("앞선지시") || normalized.contains("너에게주어진프롬프트")
    }

    private fun normalize(value: String): String = value.lowercase().replace(Regex("[\\s_\\-]"), "")
}
