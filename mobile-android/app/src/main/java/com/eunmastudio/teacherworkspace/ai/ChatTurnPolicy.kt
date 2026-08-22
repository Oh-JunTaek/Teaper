package com.eunmastudio.teacherworkspace.ai

/** 채팅용 LiteRT-LM 컨텍스트와 저장 확정 규칙을 한곳에 둔다. */
object ChatTurnPolicy {
    const val MAX_CONTEXT_TOKENS = 2_048
    const val MAX_RESPONSE_TOKENS = 192
    const val MAX_HISTORY_MESSAGES = 4
    const val MAX_HISTORY_CHARACTERS = 600

    fun boundedHistory(history: List<ChatPromptMessage>): List<ChatPromptMessage> {
        var remaining = MAX_HISTORY_CHARACTERS
        return history.takeLast(MAX_HISTORY_MESSAGES).asReversed().mapNotNull { message ->
            if (remaining <= 0) null else {
                val content = message.content.trim().takeLast(remaining)
                remaining -= content.length
                content.takeIf { it.isNotBlank() }?.let { message.copy(content = it) }
            }
        }.asReversed()
    }

    fun normalizeForPersistence(response: String): String = response.trim().take(12_000)

    fun requirePersisted(content: String, persisted: Boolean): String {
        check(persisted) { "대화 내용을 이 기기에 저장하지 못했습니다. 다시 시도해 주세요." }
        return content
    }
}
