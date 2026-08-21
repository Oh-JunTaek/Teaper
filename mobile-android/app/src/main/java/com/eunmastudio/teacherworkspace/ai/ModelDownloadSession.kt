package com.eunmastudio.teacherworkspace.ai

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ModelDownloadUiStage {
    IDLE,
    CONNECTING,
    DOWNLOADING,
    VERIFYING,
    SAVING,
    FAILED,
    COMPLETED,
}

data class ModelDownloadUiState(
    val model: GemmaModel? = null,
    val stage: ModelDownloadUiStage = ModelDownloadUiStage.IDLE,
    val receivedBytes: Long = 0L,
    val totalBytes: Long = 0L,
    val bytesPerSecond: Long = 0L,
    val message: String? = null,
) {
    val isRunning: Boolean
        get() = stage in setOf(
            ModelDownloadUiStage.CONNECTING,
            ModelDownloadUiStage.DOWNLOADING,
            ModelDownloadUiStage.VERIFYING,
            ModelDownloadUiStage.SAVING,
        )
}

/**
 * 포그라운드 서비스와 화면이 같은 다운로드 상태를 사용한다.
 * 상태는 private SharedPreferences에도 기록해 활동 화면을 다시 열어도 마지막 결과를 표시한다.
 */
object ModelDownloadSession {
    private const val PREFS = "model_download_session_v1"
    private val mutableState = MutableStateFlow(ModelDownloadUiState())
    val state = mutableState.asStateFlow()

    fun restore(context: Context): ModelDownloadUiState {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val stage = runCatching { ModelDownloadUiStage.valueOf(prefs.getString("stage", "IDLE") ?: "IDLE") }
            .getOrDefault(ModelDownloadUiStage.IDLE)
        val model = prefs.getString("model", null)?.let { saved -> GemmaModel.entries.firstOrNull { it.name == saved } }
        val restored = ModelDownloadUiState(
            model = model,
            stage = stage,
            receivedBytes = prefs.getLong("received", 0L),
            totalBytes = prefs.getLong("total", 0L),
            bytesPerSecond = prefs.getLong("speed", 0L),
            message = prefs.getString("message", null),
        )
        mutableState.value = restored
        return restored
    }

    fun update(context: Context, value: ModelDownloadUiState) {
        mutableState.value = value
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("model", value.model?.name)
            .putString("stage", value.stage.name)
            .putLong("received", value.receivedBytes)
            .putLong("total", value.totalBytes)
            .putLong("speed", value.bytesPerSecond)
            .putString("message", value.message)
            .apply()
    }

    fun isRunning(context: Context): Boolean = restore(context).isRunning
}
