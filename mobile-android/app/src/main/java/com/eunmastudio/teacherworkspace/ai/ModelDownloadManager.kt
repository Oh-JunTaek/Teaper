package com.eunmastudio.teacherworkspace.ai

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

enum class DownloadStage {
    CONNECTING,
    DOWNLOADING,
    VERIFYING,
    SAVING,
}

data class DownloadProgress(
    val stage: DownloadStage,
    val receivedBytes: Long,
    val totalBytes: Long,
    val bytesPerSecond: Long = 0L,
)

/**
 * 모델은 앱 전용 저장소에만 저장한다. 부분 파일을 해시 검증한 후에만 활성 파일명으로 옮긴다.
 * 앱이 중간에 종료돼도 검증 전 부분 파일만 남기므로, 다음 시도에서 안전하게 이어받을 수 있다.
 */
class ModelDownloadManager(private val context: Context) {
    private val modelDirectory = File(context.filesDir, "models").apply { mkdirs() }

    fun installedFile(model: GemmaModel): File = File(modelDirectory, model.fileName)

    fun isInstalled(model: GemmaModel): Boolean = installedFile(model).isFile

    suspend fun download(
        model: GemmaModel,
        onProgress: (DownloadProgress) -> Unit,
    ): File = withContext(Dispatchers.IO) {
        val temporary = File(modelDirectory, "${model.fileName}.partial")
        val destination = installedFile(model)
        var existingBytes = temporary.length().takeIf { it in 1 until model.byteSize } ?: 0L
        if (existingBytes == 0L) temporary.delete()
        onProgress(DownloadProgress(DownloadStage.CONNECTING, existingBytes, model.byteSize))

        val connection = (URL(model.downloadUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 60_000
            requestMethod = "GET"
            instanceFollowRedirects = true
            if (existingBytes > 0L) setRequestProperty("Range", "bytes=$existingBytes-")
        }
        try {
            check(connection.responseCode in 200..299) { "모델 파일을 내려받지 못했습니다: HTTP ${connection.responseCode}" }
            // CDN이 Range 요청을 지원하지 않으면 부분 파일을 지우고 처음부터 다시 받는다.
            if (existingBytes > 0L && connection.responseCode != HttpURLConnection.HTTP_PARTIAL) {
                temporary.delete()
                existingBytes = 0L
            }
            val expectedLength = model.byteSize
            val digest = MessageDigest.getInstance("SHA-256")
            if (existingBytes > 0L) {
                temporary.inputStream().use { prior ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val read = prior.read(buffer)
                        if (read < 0) break
                        digest.update(buffer, 0, read)
                    }
                }
            }
            var lastProgressReportedAt = 0L
            var lastBytes = existingBytes
            var lastSpeedMeasuredAt = System.currentTimeMillis()
            connection.inputStream.use { input ->
                FileOutputStream(temporary, existingBytes > 0L).buffered().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var received = existingBytes
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        digest.update(buffer, 0, read)
                        received += read
                        val now = System.currentTimeMillis()
                        if (now - lastProgressReportedAt >= 250L || received == expectedLength) {
                            val elapsed = (now - lastSpeedMeasuredAt).coerceAtLeast(1L)
                            val speed = ((received - lastBytes) * 1_000L) / elapsed
                            onProgress(DownloadProgress(DownloadStage.DOWNLOADING, received, expectedLength, speed))
                            lastProgressReportedAt = now
                            lastSpeedMeasuredAt = now
                            lastBytes = received
                        }
                    }
                }
            }
            onProgress(DownloadProgress(DownloadStage.VERIFYING, temporary.length(), expectedLength))
            val actualHash = digest.digest().joinToString("") { "%02x".format(it) }
            check(actualHash.equals(model.sha256, ignoreCase = true)) {
                "모델 무결성 확인에 실패했습니다. 파일을 삭제한 뒤 다시 내려받아 주세요."
            }
            check(temporary.length() == model.byteSize) { "모델 파일 크기가 예상과 다릅니다." }
            onProgress(DownloadProgress(DownloadStage.SAVING, temporary.length(), expectedLength))
            if (destination.exists()) destination.delete()
            check(temporary.renameTo(destination)) { "검증한 모델 파일을 저장하지 못했습니다." }
            destination
        } catch (error: Throwable) {
            // 네트워크 오류에는 부분 파일을 보존해 다음 시도에서 이어받는다. 해시·크기 오류는 즉시 삭제한다.
            if (error.message?.contains("무결성") == true || error.message?.contains("크기가 예상") == true) {
                temporary.delete()
            }
            throw error
        } finally {
            connection.disconnect()
        }
    }

    fun remove(model: GemmaModel): Boolean = installedFile(model).delete()
}
