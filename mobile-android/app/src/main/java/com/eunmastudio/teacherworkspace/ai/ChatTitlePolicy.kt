package com.eunmastudio.teacherworkspace.ai

/**
 * 별도 모델 호출 없이 첫 질문의 핵심을 짧게 정리해 대화 목록에서 찾기 쉬운 제목을 만든다.
 * 제목 원문도 화면에 남으므로 시스템 지시문 추출 요청은 일반화된 보안 제목으로 바꾼다.
 */
object ChatTitlePolicy {
    const val DEFAULT_TITLE = "새 온디바이스 대화"
    private const val MAX_TITLE_LENGTH = 28

    fun suggest(messages: List<ChatPromptMessage>): String {
        val firstUserMessage = messages.firstOrNull { it.isUser }?.content?.trim().orEmpty()
        if (firstUserMessage.isBlank()) return DEFAULT_TITLE
        if (PromptDisclosurePolicy.safeResponseFor(firstUserMessage) != null) return "보안 설정 확인"
        val normalized = firstUserMessage
            .replace(Regex("""\s+"""), " ")
            .replace(Regex("""^(안녕|안녕하세요|혹시|저기)[,! ]*"""), "")
            .replace(Regex("""(알려\s*줘|설명해\s*줘|정리해\s*줘|부탁해|요청)$"""), "")
            .trim()
        return normalized.take(MAX_TITLE_LENGTH).ifBlank { DEFAULT_TITLE }
    }
}
