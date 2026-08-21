package com.eunmastudio.teacherworkspace.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * 사용자가 명시적으로 시작한 대용량 모델 다운로드를 포그라운드 서비스에서 처리한다.
 * 고정 알림은 진행 중임을 고지하며, 화면을 닫거나 다른 앱으로 이동해도 다운로드가 계속되게 한다.
 */
class ModelDownloadService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var downloadJob: Job? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val model = intent?.getStringExtra(EXTRA_MODEL)
            ?.let { stored -> GemmaModel.entries.firstOrNull { it.name == stored } }
            ?: run {
                stopSelf(startId)
                return START_NOT_STICKY
            }
        if (downloadJob?.isActive == true) {
            // 동일 서비스 안에서 다시 시작 요청이 오면 기존 다운로드를 단 하나만 유지한다.
            return START_NOT_STICKY
        }

        createChannel()
        val connecting = ModelDownloadUiState(
            model = model,
            stage = ModelDownloadUiStage.CONNECTING,
            totalBytes = model.byteSize,
            message = "다운로드 서버에 연결하고 있습니다.",
        )
        ModelDownloadSession.update(this, connecting)
        startAsForeground(connecting)

        downloadJob = serviceScope.launch {
            val manager = ModelDownloadManager(this@ModelDownloadService)
            runCatching {
                manager.download(model) { progress ->
                    val state = progress.toUiState(model)
                    ModelDownloadSession.update(this@ModelDownloadService, state)
                    updateNotification(state)
                }
            }.onSuccess {
                // E2B는 서비스의 기본 모델이므로, 첫 다운로드가 끝나면 자동으로 현재 작업 모델로 선택한다.
                if (model == GemmaModel.E2B) ModelSelection.select(this@ModelDownloadService, model)
                val finished = ModelDownloadUiState(
                    model = model,
                    stage = ModelDownloadUiStage.COMPLETED,
                    receivedBytes = model.byteSize,
                    totalBytes = model.byteSize,
                    message = "다운로드와 무결성 확인이 완료되었습니다. 앱에서 모델을 준비해 주세요.",
                )
                ModelDownloadSession.update(this@ModelDownloadService, finished)
                finishForeground(finished)
            }.onFailure { error ->
                val failed = ModelDownloadUiState(
                    model = model,
                    stage = ModelDownloadUiStage.FAILED,
                    totalBytes = model.byteSize,
                    message = error.message ?: "다운로드가 중단되었습니다. 다시 시도하면 부분 파일부터 이어받습니다.",
                )
                ModelDownloadSession.update(this@ModelDownloadService, failed)
                finishForeground(failed)
            }
            stopSelf(startId)
        }
        // 시스템이 서비스를 재생성하는 경우에도 전달받은 모델 요청으로 부분 파일부터 다시 이어받을 수 있다.
        return START_REDELIVER_INTENT
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun startAsForeground(state: ModelDownloadUiState) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, buildNotification(state), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIFICATION_ID, buildNotification(state))
        }
    }

    private fun updateNotification(state: ModelDownloadUiState) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(state))
    }

    private fun finishForeground(state: ModelDownloadUiState) {
        updateNotification(state)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_DETACH) else @Suppress("DEPRECATION") stopForeground(false)
    }

    private fun buildNotification(state: ModelDownloadUiState): Notification {
        val modelName = state.model?.displayName ?: "모델"
        val progress = if (state.totalBytes > 0L) ((state.receivedBytes * 100L) / state.totalBytes).toInt().coerceIn(0, 100) else 0
        val detail = when (state.stage) {
            ModelDownloadUiStage.CONNECTING -> "서버에 연결하고 있습니다"
            ModelDownloadUiStage.DOWNLOADING -> "$progress% · ${formatGb(state.receivedBytes)} / ${formatGb(state.totalBytes)}"
            ModelDownloadUiStage.VERIFYING -> "파일 무결성을 확인하고 있습니다"
            ModelDownloadUiStage.SAVING -> "이 기기에 저장하고 있습니다"
            ModelDownloadUiStage.COMPLETED -> "다운로드 완료"
            ModelDownloadUiStage.FAILED -> "중단됨 · 앱에서 다시 시도할 수 있습니다"
            ModelDownloadUiStage.IDLE -> ""
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("$modelName 준비 중")
            .setContentText(detail)
            .setOnlyAlertOnce(true)
            .setOngoing(state.isRunning)
            .setProgress(100, progress, state.stage in setOf(ModelDownloadUiStage.CONNECTING, ModelDownloadUiStage.VERIFYING, ModelDownloadUiStage.SAVING))
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(CHANNEL_ID, "모델 다운로드", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Gemma 모델을 기기에 내려받고 확인하는 진행 상태"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun DownloadProgress.toUiState(model: GemmaModel): ModelDownloadUiState = when (stage) {
        DownloadStage.CONNECTING -> ModelDownloadUiState(model, ModelDownloadUiStage.CONNECTING, receivedBytes, totalBytes, message = "다운로드 서버에 연결하고 있습니다.")
        DownloadStage.DOWNLOADING -> ModelDownloadUiState(model, ModelDownloadUiStage.DOWNLOADING, receivedBytes, totalBytes, bytesPerSecond, "다운로드 중")
        DownloadStage.VERIFYING -> ModelDownloadUiState(model, ModelDownloadUiStage.VERIFYING, receivedBytes, totalBytes, message = "SHA-256 무결성을 확인하고 있습니다.")
        DownloadStage.SAVING -> ModelDownloadUiState(model, ModelDownloadUiStage.SAVING, receivedBytes, totalBytes, message = "앱 전용 저장소에 저장하고 있습니다.")
    }

    private fun formatGb(bytes: Long): String = "%.2fGB".format(bytes / 1_000_000_000.0)

    companion object {
        private const val EXTRA_MODEL = "model"
        private const val CHANNEL_ID = "model_download"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context, model: GemmaModel) {
            val intent = Intent(context, ModelDownloadService::class.java).putExtra(EXTRA_MODEL, model.name)
            ContextCompat.startForegroundService(context, intent)
        }
    }
}
