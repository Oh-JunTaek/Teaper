package com.eunmastudio.teacherworkspace.ai

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.withContext

/**
 * 문항 원문과 자료는 이 모듈에서 외부로 전송하지 않는다. LiteRT-LM은 앱 전용 모델 파일을 사용한다.
 */
class LiteRtLmRunner(private val context: Context) {
    private var engine: Engine? = null

    suspend fun initialize(modelFilePath: String): String = withContext(Dispatchers.Default) {
        close()
        val cacheDirectory = context.cacheDir.resolve("litertlm-cache").apply { mkdirs() }
        val gpuConfig = EngineConfig(
            modelPath = modelFilePath,
            backend = Backend.GPU(),
            visionBackend = Backend.GPU(),
            cacheDir = cacheDirectory.absolutePath,
        )
        return@withContext try {
            engine = Engine(gpuConfig).also { it.initialize() }
            "GPU 가속으로 준비했습니다."
        } catch (_: Throwable) {
            engine = Engine(
                EngineConfig(
                    modelPath = modelFilePath,
                    backend = Backend.CPU(),
                    visionBackend = Backend.CPU(),
                    cacheDir = cacheDirectory.absolutePath,
                ),
            ).also { it.initialize() }
            "GPU를 사용할 수 없어 CPU 모드로 준비했습니다."
        }
    }

    suspend fun generate(
        prompt: String,
        onPartialResponse: (String) -> Unit,
    ) = withContext(Dispatchers.Default) {
        val activeEngine = requireNotNull(engine) { "먼저 모델을 준비해 주세요." }
        activeEngine.createConversation().use { conversation ->
            // LiteRT-LM 공식 권장 코루틴 스트리밍 API를 사용해 긴 응답도 화면에 순차 표시한다.
            conversation.sendMessageAsync(prompt).collect { message ->
                onPartialResponse(message.toString())
            }
        }
    }

    suspend fun inspectImage(
        imagePath: String,
        prompt: String,
        onPartialResponse: (String) -> Unit,
    ) = withContext(Dispatchers.Default) {
        val activeEngine = requireNotNull(engine) { "먼저 모델을 준비해 주세요." }
        activeEngine.createConversation().use { conversation ->
            conversation.sendMessageAsync(
                Contents.of(
                    Content.ImageFile(imagePath),
                    Content.Text(prompt),
                ),
            ).collect { message -> onPartialResponse(message.toString()) }
        }
    }

    fun close() {
        engine?.close()
        engine = null
    }
}
