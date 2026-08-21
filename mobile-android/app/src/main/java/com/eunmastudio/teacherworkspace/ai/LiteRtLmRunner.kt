package com.eunmastudio.teacherworkspace.ai

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.SamplerConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.catch
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
            conversation.sendMessageAsync(prompt)
                .catch { throwable -> throw IllegalStateException("온디바이스 생성 중 오류가 발생했습니다: ${throwable.message}", throwable) }
                .collect { message -> message.textContent().takeIf { it.isNotBlank() }?.let(onPartialResponse) }
        }
    }

    /**
     * 시스템 지시문·이전 사용자/모델 발화를 LiteRT-LM의 역할 기반 ConversationConfig로 전달한다.
     * 마지막 사용자 발화만 sendMessageAsync로 보내므로 모델이 서비스 규칙을 사용자 질문으로 오인하지 않는다.
     */
    suspend fun chat(
        systemInstruction: String,
        history: List<ChatPromptMessage>,
        onPartialResponse: (String) -> Unit,
    ) = withContext(Dispatchers.Default) {
        val activeEngine = requireNotNull(engine) { "먼저 모델을 준비해 주세요." }
        val lastUserIndex = history.indexOfLast { it.isUser }
        if (lastUserIndex < 0) throw IllegalArgumentException("보낼 질문이 없습니다.")
        val latestUserMessage = history[lastUserIndex].content
        val initialMessages = history.take(lastUserIndex).map { message ->
            if (message.isUser) Message.user(message.content) else Message.model(message.content)
        }
        val config = ConversationConfig(
            systemInstruction = Contents.of(systemInstruction),
            initialMessages = initialMessages,
            samplerConfig = SamplerConfig(temperature = 0.35, topK = 20, topP = 0.9),
        )
        activeEngine.createConversation(config).use { conversation ->
            conversation.sendMessageAsync(latestUserMessage)
                .catch { throwable -> throw IllegalStateException("온디바이스 생성 중 오류가 발생했습니다: ${throwable.message}", throwable) }
                .collect { message ->
                    // Message.toString()은 디버그 표현일 수 있으므로 Contents.Text의 실제 모델 출력만 화면에 전달한다.
                    message.textContent().takeIf { it.isNotBlank() }?.let(onPartialResponse)
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
            )
                .catch { throwable -> throw IllegalStateException("이미지 확인 중 오류가 발생했습니다: ${throwable.message}", throwable) }
                .collect { message -> message.textContent().takeIf { it.isNotBlank() }?.let(onPartialResponse) }
        }
    }

    /** LiteRT-LM 0.16.1은 Message.text가 아니라 Message.contents.contents에 Text 조각을 담는다. */
    private fun Message.textContent(): String = contents.contents
        .filterIsInstance<Content.Text>()
        .joinToString(separator = "") { it.text }

    fun close() {
        engine?.close()
        engine = null
    }
}
