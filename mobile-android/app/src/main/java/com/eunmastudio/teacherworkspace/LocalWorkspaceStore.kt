package com.eunmastudio.teacherworkspace

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

enum class LocalSourceKind(val label: String) {
    REFERENCE("참고 자료"),
    PAST_EXAM("기출 유형"),
    OFFICIAL("공식 자료"),
}

data class LocalSource(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val kind: LocalSourceKind,
    val excerpt: String,
    val sourceUri: String? = null,
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

    fun teacherInstructions(): String = preferences.getString("teacherInstructions", "") ?: ""

    fun saveTeacherInstructions(value: String) {
        preferences.edit().putString("teacherInstructions", value.trim()).apply()
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

    private fun readArray(key: String): List<JSONObject> = runCatching {
        val array = JSONArray(preferences.getString(key, "[]"))
        List(array.length()) { array.getJSONObject(it) }
    }.getOrDefault(emptyList())
}

private fun JSONArray.toStringList(): List<String> = List(length()) { getString(it) }
