package com.eunmastudio.teacherworkspace

/** 대화 목록의 정렬·상대 시간 표기를 Android·웹·데스크톱에서 공유할 수 있는 순수 표시 계약이다. */
object ChatThreadPresentationPolicy {
    fun relativeTime(updatedAt: Long, now: Long = System.currentTimeMillis()): String {
        val elapsed = (now - updatedAt).coerceAtLeast(0L)
        return when {
            elapsed < 60_000L -> "방금 전"
            elapsed < 60 * 60_000L -> "${elapsed / 60_000L}분 전"
            elapsed < 24 * 60 * 60_000L -> "${elapsed / (60 * 60_000L)}시간 전"
            else -> "${elapsed / (24 * 60 * 60_000L)}일 전"
        }
    }

    fun sort(threads: List<LocalChatThread>): List<LocalChatThread> = threads.sortedWith(
        compareByDescending<LocalChatThread> { it.isFavorite }
            .thenByDescending { it.favoriteAt ?: Long.MIN_VALUE }
            .thenByDescending { it.updatedAt },
    )
}
