package com.eunmastudio.teacherworkspace.ai

/**
 * 모델 응답은 저장이 성공한 뒤에만 화면에 확정한다.
 * 네이티브 생성과 UI·SharedPreferences 실패를 분리해, 저장 실패가 프로세스 종료처럼 보이지 않게 한다.
 */
object ChatTurnPolicy {
    const val MAX_RESPONSE_TOKENS = 128
    const val MAX_HISTORY_CHARACTERS = 700

    /**
     * E2B의 짧은 채팅 컨텍스트에서 이전 이력이 KV 캐시를 과점유하지 않게 한다.
     * 가장 최근 질문부터 역순으로 예산을 배분하므로, 현재 질문은 항상 남는다.
     */
    fun compactHistoryForContext(history: List<ChatPromptMessage>): List<ChatPromptMessage> {
        var remaining = MAX_HISTORY_CHARACTERS
        val kept = mutableListOf<ChatPromptMessage>()
        history.asReversed().forEach { message ->
            if (remaining <= 0) return@forEach
            val content = message.content.take(remaining)
            if (content.isNotBlank()) {
                kept += message.copy(content = content)
                remaining -= content.length
            }
        }
        return kept.asReversed()
    }

    fun normalizeForPersistence(value: String): String = value.trim().also {
        require(it.isNotBlank()) { "모델이 빈 응답을 반환했습니다. 다시 시도해 주세요." }
    }

    fun requirePersisted(value: String, persisted: Boolean): String {
        check(persisted) { "대화 기록을 이 기기에 저장하지 못했습니다. 응답을 다시 시도해 주세요." }
        return value
    }
}
