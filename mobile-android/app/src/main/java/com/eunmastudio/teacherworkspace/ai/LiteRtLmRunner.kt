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

/** 문항 원문과 자료는 이 모듈에서 외부로 전송하지 않고 앱 전용 LiteRT-LM만 사용한다. */
class LiteRtLmRunner(private val context: Context) {
    private var engine: Engine? = null

    suspend fun initialize(
        modelFilePath: String,
        preferGpu: Boolean = true,
        maxNumTokens: Int = ChatTurnPolicy.MAX_CONTEXT_TOKENS,
    ): String = withContext(Dispatchers.Default) {
        close()
        val cacheDirectory = context.cacheDir.resolve("litertlm-cache").apply { mkdirs() }
        if (!preferGpu) {
            engine = createCpuEngine(modelFilePath, cacheDirectory.absolutePath, maxNumTokens)
            return@withContext "CPU 안정성 모드로 준비했습니다."
        }
        val gpuConfig = EngineConfig(
            modelPath = modelFilePath,
            backend = Backend.GPU(),
            visionBackend = Backend.GPU(),
            cacheDir = cacheDirectory.absolutePath,
            maxNumTokens = maxNumTokens,
        )
        return@withContext try {
            engine = Engine(gpuConfig).also { it.initialize() }
            "GPU 가속으로 준비했습니다."
        } catch (_: Throwable) {
            engine = createCpuEngine(modelFilePath, cacheDirectory.absolutePath, maxNumTokens)
            "GPU를 사용할 수 없어 CPU 모드로 준비했습니다."
        }
    }

    private fun createCpuEngine(modelFilePath: String, cacheDirectory: String, maxNumTokens: Int): Engine = Engine(
        EngineConfig(
            modelPath = modelFilePath,
            backend = Backend.CPU(),
            visionBackend = Backend.CPU(),
            cacheDir = cacheDirectory,
            maxNumTokens = maxNumTokens,
        ),
    ).also { it.initialize() }

    suspend fun generate(prompt: String, onPartialResponse: (String) -> Unit) = withContext(Dispatchers.Default) {
        val activeEngine = requireNotNull(engine) { "먼저 모델을 준비해 주세요." }
        activeEngine.createConversation().use { conversation ->
            conversation.sendMessageAsync(prompt)
                .catch { throwable -> throw IllegalStateException("온디바이스 생성 중 오류가 발생했습니다: ${throwable.message}", throwable) }
                .collect { message -> message.textContent().takeIf { it.isNotBlank() }?.let(onPartialResponse) }
        }
    }

    /** 쪽지시험처럼 결과를 한 번에 확정해야 하는 작업은 스트리밍 Flow와 화면 갱신을 섞지 않는다. */
    suspend fun generateFinal(prompt: String, maxOutputTokens: Int = 900): String = withContext(Dispatchers.Default) {
        val activeEngine = requireNotNull(engine) { "먼저 모델을 준비해 주세요." }
        activeEngine.createConversation().use { conversation ->
            conversation.sendMessage(prompt, emptyMap(), null, null, null, maxOutputTokens).textContent()
        }
    }

    /**
     * 채팅은 스트리밍 네이티브 콜백을 화면·저장과 동시에 섞지 않는다.
     * 최근 저장 이력으로 매 요청마다 짧은 Conversation을 구성하고 동기 완료 뒤 즉시 닫는다.
     */
    suspend fun chat(systemInstruction: String, history: List<ChatPromptMessage>): String = withContext(Dispatchers.Default) {
        val activeEngine = requireNotNull(engine) { "먼저 모델을 준비해 주세요." }
        val lastUserIndex = history.indexOfLast { it.isUser }
        if (lastUserIndex < 0) throw IllegalArgumentException("보낼 질문이 없습니다.")
        val latestUserMessage = history[lastUserIndex].content
        val initialMessages = history.take(lastUserIndex).map { message ->
            if (message.isUser) Message.user(message.content) else Message.model(message.content)
        }
        activeEngine.createConversation(
            ConversationConfig(
                systemInstruction = Contents.of(systemInstruction),
                initialMessages = initialMessages,
                samplerConfig = SamplerConfig(temperature = 0.35, topK = 20, topP = 0.9),
            ),
        ).use { conversation ->
            conversation.sendMessage(
                latestUserMessage,
                emptyMap(),
                null,
                null,
                null,
                ChatTurnPolicy.MAX_RESPONSE_TOKENS,
            ).textContent()
        }
    }

    suspend fun inspectImage(imagePath: String, prompt: String, onPartialResponse: (String) -> Unit) = withContext(Dispatchers.Default) {
        val activeEngine = requireNotNull(engine) { "먼저 모델을 준비해 주세요." }
        activeEngine.createConversation().use { conversation ->
            conversation.sendMessageAsync(Contents.of(Content.ImageFile(imagePath), Content.Text(prompt)))
                .catch { throwable -> throw IllegalStateException("이미지 확인 중 오류가 발생했습니다: ${throwable.message}", throwable) }
                .collect { message -> message.textContent().takeIf { it.isNotBlank() }?.let(onPartialResponse) }
        }
    }

    private fun Message.textContent(): String = contents.contents
        .filterIsInstance<Content.Text>()
        .joinToString(separator = "") { it.text }

    /** 요청별 Conversation을 닫으므로 화면 전환 시 추가로 정리할 채팅 세션이 없다. */
    fun resetChatConversation() = Unit

    fun close() {
        engine?.close()
        engine = null
    }
}
