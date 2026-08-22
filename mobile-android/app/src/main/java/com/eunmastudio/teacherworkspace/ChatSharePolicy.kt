package com.eunmastudio.teacherworkspace

/** 교사가 명시적으로 선택한 대화만 앱 밖으로 복사·공유하는 텍스트 형식 정책이다. */
object ChatSharePolicy {
    fun transcript(title: String, messages: List<LocalChatMessage>): String = buildString {
        appendLine(title.trim().ifBlank { "온디바이스 AI 대화" })
        appendLine("EunmaStudio 문제 출제 워크스페이스 · 교사 선택 공유")
        appendLine()
        messages.forEach { message ->
            appendLine(if (message.isUser) "[교사]" else "[온디바이스 AI]")
            appendLine(message.content.trim())
            appendLine()
        }
        append("이 대화는 교사가 선택하여 공유한 기기 내 기록입니다. 공유 전 시험 보안과 개인정보를 다시 확인하세요.")
    }

    fun safeFileStem(title: String): String = title.trim()
        .replace(Regex("[\\\\/:*?\"<>|]"), "-")
        .replace(Regex("\\s+"), "-")
        .take(48)
        .ifBlank { "on-device-chat" }
}
