package com.eunmastudio.teacherworkspace

import android.content.Context
import com.eunmastudio.teacherworkspace.ai.ChatPromptMessage
import com.eunmastudio.teacherworkspace.ai.ChatTitlePolicy
import com.eunmastudio.teacherworkspace.ai.ChatTurnPolicy
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

enum class LocalSourceKind(val label: String) {
    REFERENCE("참고 자료"),
    PAST_EXAM("기출 유형"),
    OFFICIAL("공식 자료"),
}

enum class HomeCardLayout(val label: String) {
    ALBUM("2열 앨범형"),
    LIST("일자형"),
}

object HomeCardLayoutPolicy {
    val defaultLayout = HomeCardLayout.ALBUM

    fun fromStored(value: String?): HomeCardLayout = runCatching {
        HomeCardLayout.valueOf(value ?: defaultLayout.name)
    }.getOrDefault(defaultLayout)
}

data class LocalSource(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val kind: LocalSourceKind,
    val excerpt: String,
    val sourceUri: String? = null,
    val pageReferences: String? = null,
    val extractionNotice: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

data class LocalQuestion(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val content: String,
    val sourceIds: List<String>,
    val reviewStatus: String = "검수 전",
    val createdAt: Long = System.currentTimeMillis(),
)

/** 교사 개인 메모는 AI 프롬프트와 분리되어 이 기기 안에서만 보관한다. */
data class LocalNote(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val content: String,
    val isPinned: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = createdAt,
)

/** 쪽지시험은 일반 문항과 분리해 단일 개념·간결한 형식의 생성 결과와 검수 상태를 보관한다. */
data class LocalQuickQuiz(
    val id: String = UUID.randomUUID().toString(),
    val subject: String,
    val unit: String,
    val topic: String,
    val difficulty: String,
    val questionCount: Int,
    val content: String,
    val model: String,
    val promptVersion: String,
    val reviewStatus: String = "검수 전",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = createdAt,
)

data class LocalChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val content: String,
    val isUser: Boolean,
    val createdAt: Long = System.currentTimeMillis(),
)

data class LocalChatThread(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val isTitleEdited: Boolean = false,
    val isFavorite: Boolean = false,
    val favoriteAt: Long? = null,
    val messages: List<LocalChatMessage> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = createdAt,
)

/**
 * 자료 원문·문항·검수 상태는 Android 앱의 private SharedPreferences에만 보관한다.
 * 자동 백업을 끄고, 사용자 명시 삭제 외에는 서버에 전송하지 않는다.
 */
class LocalWorkspaceStore(context: Context) {
    private val preferences = context.getSharedPreferences("teacher_workspace_local_v1", Context.MODE_PRIVATE)

    fun sources(): List<LocalSource> = readArray("sources").mapNotNull { item ->
        runCatching {
            LocalSource(
                id = item.getString("id"),
                title = item.getString("title"),
                kind = LocalSourceKind.valueOf(item.getString("kind")),
                excerpt = item.getString("excerpt"),
                sourceUri = item.optString("sourceUri").ifBlank { null },
                pageReferences = item.optString("pageReferences").ifBlank { null },
                extractionNotice = item.optString("extractionNotice").ifBlank { null },
                createdAt = item.getLong("createdAt"),
            )
        }.getOrNull()
    }

    fun questions(): List<LocalQuestion> = readArray("questions").mapNotNull { item ->
        runCatching {
            LocalQuestion(
                id = item.getString("id"),
                title = item.getString("title"),
                content = item.getString("content"),
                sourceIds = item.getJSONArray("sourceIds").toStringList(),
                reviewStatus = item.getString("reviewStatus"),
                createdAt = item.getLong("createdAt"),
            )
        }.getOrNull()
    }

    fun notes(): List<LocalNote> = readArray("notes").mapNotNull { item ->
        runCatching {
            LocalNote(
                id = item.getString("id"),
                title = item.getString("title"),
                content = item.getString("content"),
                isPinned = item.optBoolean("isPinned", false),
                createdAt = item.getLong("createdAt"),
                updatedAt = item.getLong("updatedAt"),
            )
        }.getOrNull()
    }.sortedWith(compareByDescending<LocalNote> { it.isPinned }.thenByDescending { it.updatedAt })

    fun quickQuizzes(): List<LocalQuickQuiz> = readArray("quickQuizzes").mapNotNull { item ->
        runCatching {
            LocalQuickQuiz(
                id = item.getString("id"),
                subject = item.getString("subject"),
                unit = item.getString("unit"),
                topic = item.getString("topic"),
                difficulty = item.getString("difficulty"),
                questionCount = item.getInt("questionCount"),
                content = item.getString("content"),
                model = item.getString("model"),
                promptVersion = item.getString("promptVersion"),
                reviewStatus = item.optString("reviewStatus", "검수 전"),
                createdAt = item.getLong("createdAt"),
                updatedAt = item.getLong("updatedAt"),
            )
        }.getOrNull()
    }.sortedByDescending { it.updatedAt }

    fun chatThreads(): List<LocalChatThread> = readArray("chatThreads").mapNotNull { item ->
        runCatching {
            LocalChatThread(
                id = item.getString("id"),
                title = item.getString("title"),
                isTitleEdited = item.optBoolean("isTitleEdited", false),
                isFavorite = item.optBoolean("isFavorite", false),
                favoriteAt = item.optLong("favoriteAt", 0L).takeIf { it > 0L },
                messages = item.getJSONArray("messages").toChatMessages(),
                createdAt = item.getLong("createdAt"),
                updatedAt = item.getLong("updatedAt"),
            )
        }.getOrNull()
    }.let(ChatThreadPresentationPolicy::sort)

    fun saveSource(source: LocalSource) {
        val next = sources().filterNot { it.id == source.id } + source
        writeSources(next)
    }

    fun saveQuestion(question: LocalQuestion) {
        val next = questions().filterNot { it.id == question.id } + question
        writeQuestions(next)
    }

    fun updateReviewStatus(questionId: String, status: String) {
        writeQuestions(questions().map { if (it.id == questionId) it.copy(reviewStatus = status) else it })
    }

    fun deleteSource(sourceId: String) {
        writeSources(sources().filterNot { it.id == sourceId })
    }

    fun deleteQuestion(questionId: String) {
        writeQuestions(questions().filterNot { it.id == questionId })
    }

    fun saveNote(note: LocalNote) {
        check(writeNotes(notes().filterNot { it.id == note.id } + note)) { "메모를 이 기기에 저장하지 못했습니다." }
    }

    fun deleteNote(noteId: String) {
        check(writeNotes(notes().filterNot { it.id == noteId })) { "메모를 이 기기에서 삭제하지 못했습니다." }
    }

    fun saveQuickQuiz(quiz: LocalQuickQuiz) {
        check(writeQuickQuizzes(quickQuizzes().filterNot { it.id == quiz.id } + quiz)) { "쪽지시험을 이 기기에 저장하지 못했습니다." }
    }

    fun updateQuickQuizReviewStatus(quizId: String, status: String) {
        check(writeQuickQuizzes(quickQuizzes().map { if (it.id == quizId) it.copy(reviewStatus = status, updatedAt = System.currentTimeMillis()) else it })) { "쪽지시험 검수 상태를 저장하지 못했습니다." }
    }

    fun deleteQuickQuiz(quizId: String) {
        check(writeQuickQuizzes(quickQuizzes().filterNot { it.id == quizId })) { "쪽지시험을 이 기기에서 삭제하지 못했습니다." }
    }

    fun createChatThread(title: String = "새 온디바이스 대화"): LocalChatThread {
        val thread = LocalChatThread(title = title)
        check(writeChatThreads(chatThreads() + thread)) { "새 대화를 이 기기에 저장하지 못했습니다." }
        return thread
    }

    fun appendChatMessage(threadId: String, content: String, isUser: Boolean): LocalChatThread? {
        val cleanContent = content.trim()
        if (cleanContent.isBlank()) return null
        val message = LocalChatMessage(content = cleanContent, isUser = isUser)
        var updated: LocalChatThread? = null
        val next = chatThreads().map { thread ->
            if (thread.id != threadId) thread else {
                val messages = thread.messages + message
                thread.copy(
                    title = if (!thread.isTitleEdited && isUser) {
                        ChatTitlePolicy.suggest(messages.map { ChatPromptMessage(it.isUser, it.content) })
                    } else thread.title,
                    messages = messages,
                    updatedAt = message.createdAt,
                ).also { updated = it }
            }
        }
        return updated?.takeIf { writeChatThreads(next) }
    }

    /** 기존 대화도 최신 사용자 질문을 반영해 한 번 정리하되, 교사가 편집한 제목은 절대 덮어쓰지 않는다. */
    fun refreshSuggestedChatTitles(): List<LocalChatThread> {
        val current = chatThreads()
        val next = current.map { thread ->
            if (thread.isTitleEdited || thread.messages.none { it.isUser }) thread else thread.copy(
                title = ChatTitlePolicy.suggest(thread.messages.map { ChatPromptMessage(it.isUser, it.content) }),
            )
        }
        if (next != current) writeChatThreads(next)
        return ChatThreadPresentationPolicy.sort(next)
    }

    fun renameChatThread(threadId: String, title: String): LocalChatThread? {
        var updated: LocalChatThread? = null
        val next = chatThreads().map { thread ->
            if (thread.id != threadId) thread else thread.copy(
                title = ChatTitlePolicy.normalizeManualTitle(title),
                isTitleEdited = true,
                updatedAt = System.currentTimeMillis(),
            ).also { updated = it }
        }
        return updated?.takeIf { writeChatThreads(next) }
    }

    /** 즐겨찾기는 지정 시각을 보존해 최근에 지정한 대화부터 목록 상단에 고정한다. */
    fun toggleChatFavorite(threadId: String): LocalChatThread? {
        var updated: LocalChatThread? = null
        val now = System.currentTimeMillis()
        val next = chatThreads().map { thread ->
            if (thread.id != threadId) thread else thread.copy(
                isFavorite = !thread.isFavorite,
                favoriteAt = if (thread.isFavorite) null else now,
            ).also { updated = it }
        }
        return updated?.takeIf { writeChatThreads(next) }
    }

    fun deleteChatThread(threadId: String) {
        writeChatThreads(chatThreads().filterNot { it.id == threadId })
    }

    fun teacherInstructions(): String = preferences.getString("teacherInstructions", "") ?: ""

    fun saveTeacherInstructions(value: String) {
        preferences.edit().putString("teacherInstructions", value.trim()).apply()
    }

    fun homeCardLayout(): HomeCardLayout = HomeCardLayoutPolicy.fromStored(preferences.getString("homeCardLayout", null))

    fun saveHomeCardLayout(layout: HomeCardLayout) {
        preferences.edit().putString("homeCardLayout", layout.name).apply()
    }

    private fun writeSources(items: List<LocalSource>) {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().apply {
                put("id", item.id)
                put("title", item.title)
                put("kind", item.kind.name)
                put("excerpt", item.excerpt)
                put("sourceUri", item.sourceUri)
                put("pageReferences", item.pageReferences)
                put("extractionNotice", item.extractionNotice)
                put("createdAt", item.createdAt)
            })
        }
        preferences.edit().putString("sources", array.toString()).apply()
    }

    private fun writeQuestions(items: List<LocalQuestion>) {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().apply {
                put("id", item.id)
                put("title", item.title)
                put("content", item.content)
                put("sourceIds", JSONArray(item.sourceIds))
                put("reviewStatus", item.reviewStatus)
                put("createdAt", item.createdAt)
            })
        }
        preferences.edit().putString("questions", array.toString()).apply()
    }

    private fun writeNotes(items: List<LocalNote>): Boolean {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().apply {
                put("id", item.id); put("title", item.title); put("content", item.content); put("isPinned", item.isPinned)
                put("createdAt", item.createdAt); put("updatedAt", item.updatedAt)
            })
        }
        return preferences.edit().putString("notes", array.toString()).commit()
    }

    private fun writeQuickQuizzes(items: List<LocalQuickQuiz>): Boolean {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().apply {
                put("id", item.id); put("subject", item.subject); put("unit", item.unit); put("topic", item.topic)
                put("difficulty", item.difficulty); put("questionCount", item.questionCount); put("content", item.content)
                put("model", item.model); put("promptVersion", item.promptVersion); put("reviewStatus", item.reviewStatus)
                put("createdAt", item.createdAt); put("updatedAt", item.updatedAt)
            })
        }
        return preferences.edit().putString("quickQuizzes", array.toString()).commit()
    }

    private fun writeChatThreads(items: List<LocalChatThread>): Boolean {
        val array = JSONArray()
        items.forEach { thread ->
            array.put(JSONObject().apply {
                put("id", thread.id)
                put("title", thread.title)
                put("isTitleEdited", thread.isTitleEdited)
                put("isFavorite", thread.isFavorite)
                put("favoriteAt", thread.favoriteAt)
                put("messages", JSONArray().apply {
                    thread.messages.forEach { message ->
                        put(JSONObject().apply {
                            put("id", message.id)
                            put("content", message.content)
                            put("isUser", message.isUser)
                            put("createdAt", message.createdAt)
                        })
                    }
                })
                put("createdAt", thread.createdAt)
                put("updatedAt", thread.updatedAt)
            })
        }
        return preferences.edit().putString("chatThreads", array.toString()).commit()
    }

    private fun readArray(key: String): List<JSONObject> = runCatching {
        val array = JSONArray(preferences.getString(key, "[]"))
        List(array.length()) { array.getJSONObject(it) }
    }.getOrDefault(emptyList())
}

private fun JSONArray.toStringList(): List<String> = List(length()) { getString(it) }

private fun JSONArray.toChatMessages(): List<LocalChatMessage> = List(length()) { index ->
    getJSONObject(index).let { item ->
        LocalChatMessage(
            id = item.getString("id"),
            content = item.getString("content"),
            isUser = item.getBoolean("isUser"),
            createdAt = item.getLong("createdAt"),
        )
    }
}
