package com.eunmastudio.teacherworkspace.ai

/** 모델 호출 없이 기기에 저장된 사용자 질문만으로 대화 목록의 짧은 제목을 추천한다. */
object ChatTitlePolicy {
    const val DEFAULT_TITLE = "새 온디바이스 대화"
    private const val MAX_TITLE_LENGTH = 26

    fun suggest(messages: List<ChatPromptMessage>): String {
        val latestQuestion = messages.asReversed().firstOrNull { it.isUser && it.content.trim().length >= 3 }?.content.orEmpty()
        val cleaned = latestQuestion
            .replace(Regex("[\\n\\r\\t]+"), " ")
            .replace(Regex("^(안녕|안녕하세요|질문이 있어요|궁금한 게 있어요)[!,. ]*"), "")
            .trim()
            .trim('?', '!', '.', '·', ' ')
        if (cleaned.length < 2) return DEFAULT_TITLE
        return cleaned.take(MAX_TITLE_LENGTH).let { if (cleaned.length > MAX_TITLE_LENGTH) "$it…" else it }
    }

    fun normalizeManualTitle(value: String): String = value
        .replace(Regex("[\\n\\r\\t]+"), " ")
        .trim()
        .take(MAX_TITLE_LENGTH)
        .ifBlank { DEFAULT_TITLE }
}
