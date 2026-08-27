package com.eunmastudio.teacherworkspace

import android.content.Context
import com.eunmastudio.teacherworkspace.ai.AndroidAccelerationPreference
import com.eunmastudio.teacherworkspace.ai.ChatPromptMessage
import com.eunmastudio.teacherworkspace.ai.ChatTitlePolicy
import com.eunmastudio.teacherworkspace.ai.ChatTurnPolicy
import com.eunmastudio.teacherworkspace.ai.LocalModelSettings
import com.eunmastudio.teacherworkspace.ai.LocalModelSettingsPolicy
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
    val points: Double? = null,
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

/** 시험일·마감·회의·검수 계획은 문항 원문과 분리해 Android 기기 안에서만 관리한다. */
data class LocalScheduleItem(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val scheduleDate: String,
    val scheduleTime: String = "",
    val eventType: String = "시험일",
    val note: String = "",
    val status: String = "예정",
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
    val questionFormat: String = "multiple_choice",
    val questionCount: Int,
    val content: String,
    val model: String,
    val promptVersion: String,
    val reviewStatus: String = "검수 대기",
    val questionReviewStatuses: List<String> = emptyList(),
    val questionPoints: List<Double?> = emptyList(),
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

    /** 일정 알림은 교사가 허용한 경우에만 이 기기의 운영체제에 표시한다. */
    fun scheduleNotificationsEnabled(): Boolean = preferences.getBoolean("schedule_notifications_enabled", false)
    fun setScheduleNotificationsEnabled(enabled: Boolean) { preferences.edit().putBoolean("schedule_notifications_enabled", enabled).apply() }

    /** 이전 alpha 버전의 ‘검수 전·보류’ 표기를 세 플랫폼 공통 검수 상태로 읽어 들인다. */
    private fun normalizedQuickQuizReviewStatus(value: String): String = when (value.trim()) {
        "승인", "수정 필요", "반려", "검수 대기" -> value.trim()
        else -> "검수 대기"
    }

    /** 누락된 이전 세트도 승인으로 오인하지 않도록 문항별 상태를 모두 검수 대기로 읽는다. */
    private fun normalizedQuickQuizQuestionStatuses(values: List<String>, questionCount: Int): List<String> = List(questionCount.coerceAtLeast(1)) { index ->
        normalizedQuickQuizReviewStatus(values.getOrElse(index) { "검수 대기" })
    }

    /** 기존 쪽지시험의 배점 누락은 0점으로 추정하지 않고, 교사가 아직 정하지 않은 null로 보관한다. */
    private fun normalizedQuickQuizQuestionPoints(values: List<Double?>, questionCount: Int): List<Double?> = List(questionCount.coerceAtLeast(1)) { index ->
        values.getOrNull(index)?.takeIf { point -> point in 0.0..100.0 && kotlin.math.round(point * 10.0) == point * 10.0 }
    }

    /** 세트 상태는 문항별 결과 안내용 요약이다. 학생용 공유 권한은 각 문항의 승인 여부만 사용한다. */
    fun quickQuizReviewSummary(quiz: LocalQuickQuiz): String {
        val statuses = normalizedQuickQuizQuestionStatuses(quiz.questionReviewStatuses, quiz.questionCount)
        return when {
            statuses.any { it == "검수 대기" } -> "검수 대기"
            statuses.all { it == "승인" } -> "승인"
            statuses.all { it == "반려" } -> "반려"
            else -> "수정 필요"
        }
    }

    /** 이전 세트는 객관식 기본값으로 읽어 새 3가지 형식 도입 뒤에도 학생용 공유를 유지한다. */
    private fun normalizedQuickQuizFormat(value: String): String = when (value) {
        "short_answer", "ox", "multiple_choice" -> value
        else -> "multiple_choice"
    }

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
                points = item.takeIf { it.has("points") && !it.isNull("points") }?.optDouble("points")?.takeIf { it.isFinite() && it >= 0 && it <= 100 && kotlin.math.round(it * 10) == it * 10 },
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

    fun schedules(): List<LocalScheduleItem> = readArray("schedules").mapNotNull { item ->
        runCatching {
            LocalScheduleItem(
                id = item.getString("id"), title = item.getString("title"), scheduleDate = item.getString("scheduleDate"),
                scheduleTime = item.optString("scheduleTime"), eventType = item.optString("eventType", "시험일"), note = item.optString("note"),
                status = if (item.optString("status") == "완료") "완료" else "예정", createdAt = item.getLong("createdAt"), updatedAt = item.getLong("updatedAt"),
            )
        }.getOrNull()
    }.sortedWith(compareBy<LocalScheduleItem> { it.scheduleDate }.thenBy { it.scheduleTime }.thenByDescending { it.updatedAt })

    fun quickQuizzes(): List<LocalQuickQuiz> = readArray("quickQuizzes").mapNotNull { item ->
        runCatching {
            LocalQuickQuiz(
                id = item.getString("id"),
                subject = item.getString("subject"),
                unit = item.getString("unit"),
                topic = item.getString("topic"),
                difficulty = item.getString("difficulty"),
                questionFormat = normalizedQuickQuizFormat(item.optString("questionFormat", "multiple_choice")),
                questionCount = item.getInt("questionCount"),
                content = item.getString("content"),
                model = item.getString("model"),
                promptVersion = item.getString("promptVersion"),
                reviewStatus = normalizedQuickQuizReviewStatus(item.optString("reviewStatus", "검수 대기")),
                questionReviewStatuses = normalizedQuickQuizQuestionStatuses(item.optJSONArray("questionReviewStatuses")?.toStringList() ?: emptyList(), item.getInt("questionCount")),
                questionPoints = normalizedQuickQuizQuestionPoints(item.optJSONArray("questionPoints")?.let { points -> List(points.length()) { index -> if (points.isNull(index)) null else points.optDouble(index).takeIf { it in 0.0..100.0 && kotlin.math.round(it * 10.0) == it * 10.0 } } } ?: emptyList(), item.getInt("questionCount")),
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

    /** 일반 문항 배점은 교사가 정한 0~100점·소수 첫째 자리 값만 이 기기에 저장한다. */
    fun updateQuestionPoints(questionId: String, points: Double) {
        writeQuestions(questions().map { if (it.id == questionId) it.copy(points = points) else it })
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

    fun saveSchedule(item: LocalScheduleItem) {
        check(writeSchedules(schedules().filterNot { it.id == item.id } + item)) { "일정을 이 기기에 저장하지 못했습니다." }
    }

    fun deleteSchedule(scheduleId: String) {
        check(writeSchedules(schedules().filterNot { it.id == scheduleId })) { "일정을 이 기기에서 삭제하지 못했습니다." }
    }

    /** 생성 결과를 문항별 ‘검수 대기’부터 시작하도록 정리해 승인 전 사용을 막는다. */
    fun saveQuickQuiz(quiz: LocalQuickQuiz) {
        val normalized = quiz.copy(questionReviewStatuses = normalizedQuickQuizQuestionStatuses(quiz.questionReviewStatuses, quiz.questionCount), questionPoints = normalizedQuickQuizQuestionPoints(quiz.questionPoints, quiz.questionCount)).let { item -> item.copy(reviewStatus = quickQuizReviewSummary(item)) }
        check(writeQuickQuizzes(quickQuizzes().filterNot { it.id == normalized.id } + normalized)) { "쪽지시험을 이 기기에 저장하지 못했습니다." }
    }

    /** 이전 세트 단위 호출도 모든 문항에 상태를 명시적으로 적용해 데이터 형식을 유지한다. */
    fun updateQuickQuizReviewStatus(quizId: String, status: String) {
        val normalized = normalizedQuickQuizReviewStatus(status)
        check(writeQuickQuizzes(quickQuizzes().map { if (it.id == quizId) it.copy(questionReviewStatuses = List(it.questionCount.coerceAtLeast(1)) { normalized }, reviewStatus = normalized, updatedAt = System.currentTimeMillis()) else it })) { "쪽지시험 검수 상태를 저장하지 못했습니다." }
    }

    /** 선택한 한 문항만 검수한 뒤 세트 요약 상태를 다시 계산한다. */
    fun updateQuickQuizQuestionReviewStatus(quizId: String, questionIndex: Int, status: String) {
        check(writeQuickQuizzes(quickQuizzes().map { quiz ->
            if (quiz.id != quizId || questionIndex !in 0 until quiz.questionCount.coerceAtLeast(1)) quiz else {
                val states = normalizedQuickQuizQuestionStatuses(quiz.questionReviewStatuses, quiz.questionCount).toMutableList()
                states[questionIndex] = normalizedQuickQuizReviewStatus(status)
                quiz.copy(questionReviewStatuses = states, updatedAt = System.currentTimeMillis()).let { item -> item.copy(reviewStatus = quickQuizReviewSummary(item)) }
            }
        })) { "쪽지시험 문항 검수 상태를 저장하지 못했습니다." }
    }

    /** 교사만 문항별 배점을 바꾸며, 상태 배열과 다른 문항의 배점은 그대로 둔다. */
    fun updateQuickQuizQuestionPoints(quizId: String, questionIndex: Int, points: Double) {
        require(points in 0.0..100.0 && kotlin.math.round(points * 10.0) == points * 10.0) { "배점은 0~100점, 소수 첫째 자리까지 입력해 주세요." }
        check(writeQuickQuizzes(quickQuizzes().map { quiz ->
            if (quiz.id != quizId || questionIndex !in 0 until quiz.questionCount.coerceAtLeast(1)) quiz else {
                val values = normalizedQuickQuizQuestionPoints(quiz.questionPoints, quiz.questionCount).toMutableList()
                values[questionIndex] = points
                quiz.copy(questionPoints = values, updatedAt = System.currentTimeMillis())
            }
        })) { "쪽지시험 문항 배점을 저장하지 못했습니다." }
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
        preferences.edit().putString("teacherInstructions", value.trim().take(600)).apply()
    }

    fun modelSettings(): LocalModelSettings = LocalModelSettingsPolicy.normalize(
        LocalModelSettings(
            contextTokens = preferences.getInt("modelContextTokens", 2_048),
            maxOutputTokens = preferences.getInt("modelMaxOutputTokens", 0),
            temperature = preferences.getFloat("modelTemperature", 0.35f).toDouble(),
            topK = preferences.getInt("modelTopK", 20),
            topP = preferences.getFloat("modelTopP", 0.90f).toDouble(),
            acceleration = runCatching { AndroidAccelerationPreference.valueOf(preferences.getString("modelAcceleration", AndroidAccelerationPreference.CPU.name) ?: AndroidAccelerationPreference.CPU.name) }.getOrDefault(AndroidAccelerationPreference.CPU),
            thinkingEnabled = preferences.getBoolean("modelThinkingEnabled", false),
            speculativeDecodingEnabled = preferences.getBoolean("modelSpeculativeDecodingEnabled", false),
        ),
    )

    fun saveModelSettings(value: LocalModelSettings) {
        val safe = LocalModelSettingsPolicy.normalize(value)
        preferences.edit()
            .putInt("modelContextTokens", safe.contextTokens)
            .putInt("modelMaxOutputTokens", safe.maxOutputTokens)
            .putFloat("modelTemperature", safe.temperature.toFloat())
            .putInt("modelTopK", safe.topK)
            .putFloat("modelTopP", safe.topP.toFloat())
            .putString("modelAcceleration", safe.acceleration.name)
            .putBoolean("modelThinkingEnabled", safe.thinkingEnabled)
            .putBoolean("modelSpeculativeDecodingEnabled", safe.speculativeDecodingEnabled)
            .apply()
    }

    fun resetModelSettings() {
        preferences.edit()
            .remove("modelContextTokens").remove("modelMaxOutputTokens").remove("modelTemperature")
            .remove("modelTopK").remove("modelTopP").remove("modelAcceleration")
            .remove("modelThinkingEnabled").remove("modelSpeculativeDecodingEnabled")
            .apply()
    }

    fun homeCardLayout(): HomeCardLayout = HomeCardLayoutPolicy.fromStored(preferences.getString("homeCardLayout", null))

    fun saveHomeCardLayout(layout: HomeCardLayout) {
        preferences.edit().putString("homeCardLayout", layout.name).apply()
    }

    /** 쪽지시험의 최근 과목은 다음 진입 시 교사가 다시 고를 수 있는 기본값으로만 사용한다. */
    fun quickQuizLastSubject(): String = preferences.getString("quickQuizLastSubject", "화학 I") ?: "화학 I"

    fun saveQuickQuizLastSubject(subject: String) {
        preferences.edit().putString("quickQuizLastSubject", subject.trim()).apply()
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
                put("points", item.points)
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

    private fun writeSchedules(items: List<LocalScheduleItem>): Boolean {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().apply {
                put("id", item.id); put("title", item.title); put("scheduleDate", item.scheduleDate); put("scheduleTime", item.scheduleTime)
                put("eventType", item.eventType); put("note", item.note); put("status", item.status); put("createdAt", item.createdAt); put("updatedAt", item.updatedAt)
            })
        }
        return preferences.edit().putString("schedules", array.toString()).commit()
    }

    private fun writeQuickQuizzes(items: List<LocalQuickQuiz>): Boolean {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().apply {
                put("id", item.id); put("subject", item.subject); put("unit", item.unit); put("topic", item.topic)
                put("difficulty", item.difficulty); put("questionFormat", normalizedQuickQuizFormat(item.questionFormat)); put("questionCount", item.questionCount); put("content", item.content)
                put("model", item.model); put("promptVersion", item.promptVersion); put("reviewStatus", item.reviewStatus); put("questionReviewStatuses", JSONArray(normalizedQuickQuizQuestionStatuses(item.questionReviewStatuses, item.questionCount))); put("questionPoints", JSONArray(normalizedQuickQuizQuestionPoints(item.questionPoints, item.questionCount)))
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
