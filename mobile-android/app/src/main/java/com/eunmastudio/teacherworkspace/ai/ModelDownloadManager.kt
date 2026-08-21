package com.eunmastudio.teacherworkspace.ai

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

data class DownloadProgress(val receivedBytes: Long, val totalBytes: Long)

/**
 * 모델은 앱 전용 저장소에만 저장한다. 부분 파일을 해시 검증한 후에만 활성 파일명으로 옮긴다.
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
        temporary.delete()

        val connection = (URL(model.downloadUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 30_000
            requestMethod = "GET"
            instanceFollowRedirects = true
        }
        try {
            check(connection.responseCode in 200..299) { "모델 파일을 내려받지 못했습니다: HTTP ${connection.responseCode}" }
            val expectedLength = connection.contentLengthLong.takeIf { it > 0L } ?: model.byteSize
            val digest = MessageDigest.getInstance("SHA-256")
            var lastProgressReportedAt = 0L
            connection.inputStream.use { input ->
                temporary.outputStream().buffered().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var received = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        digest.update(buffer, 0, read)
                        received += read
                        val now = System.currentTimeMillis()
                        if (now - lastProgressReportedAt >= 250L || received == expectedLength) {
                            onProgress(DownloadProgress(received, expectedLength))
                            lastProgressReportedAt = now
                        }
                    }
                }
            }
            onProgress(DownloadProgress(temporary.length(), expectedLength))
            val actualHash = digest.digest().joinToString("") { "%02x".format(it) }
            check(actualHash.equals(model.sha256, ignoreCase = true)) {
                "모델 무결성 확인에 실패했습니다. 파일을 삭제한 뒤 다시 내려받아 주세요."
            }
            check(temporary.length() == model.byteSize) { "모델 파일 크기가 예상과 다릅니다." }
            if (destination.exists()) destination.delete()
            check(temporary.renameTo(destination)) { "검증한 모델 파일을 저장하지 못했습니다." }
            destination
        } catch (error: Throwable) {
            temporary.delete()
            throw error
        } finally {
            connection.disconnect()
        }
    }

    fun remove(model: GemmaModel): Boolean = installedFile(model).delete()
}
