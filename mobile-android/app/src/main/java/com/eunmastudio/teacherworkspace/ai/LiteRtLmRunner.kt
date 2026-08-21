package com.eunmastudio.teacherworkspace.ai

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Conversation
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
    private var chatConversation: Conversation? = null
    private var chatSystemInstruction: String? = null

    suspend fun initialize(
        modelFilePath: String,
        preferGpu: Boolean = true,
        maxNumTokens: Int = 4_096,
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
            maxNumTokens = maxNumTokens,
            cacheDir = cacheDirectory.absolutePath,
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
            maxNumTokens = maxNumTokens,
            cacheDir = cacheDirectory,
        ),
    ).also { it.initialize() }

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
        // 동기 sendMessage의 네이티브 세션 이력 보존 여부에 의존하지 않는다.
        // 매 질문마다 앱 전용 저장소에 성공 확정된 최근 역할 이력을 다시 주입해,
        // 화면 재구성·엔진 복구 뒤에도 같은 길이의 연속 대화 문맥을 유지한다.
        resetChatConversation()
        val initialMessages = history.take(lastUserIndex).map { message ->
            if (message.isUser) Message.user(message.content) else Message.model(message.content)
        }
        val conversation = activeEngine.createConversation(
            ConversationConfig(
                systemInstruction = Contents.of(systemInstruction),
                initialMessages = initialMessages,
                samplerConfig = SamplerConfig(temperature = 0.35, topK = 20, topP = 0.9),
            ),
        ).also {
            chatConversation = it
            chatSystemInstruction = systemInstruction
        }
        // S25+에서 부분 토큰은 보인 뒤 프로세스가 종료되는 현상을 분리하기 위해,
        // 채팅은 스트리밍 콜백 대신 짧은 완성 응답을 한 번만 받아 UI·저장소에 전달한다.
        // 이는 응답 표시와 SharedPreferences 기록이 경쟁하지 않게 하는 안정성 우선 경로다.
        val completedMessage = conversation.sendMessage(
            latestUserMessage,
            emptyMap(),
            null,
            null,
            null,
            ChatTurnPolicy.MAX_RESPONSE_TOKENS,
        )
        completedMessage.textContent().takeIf { it.isNotBlank() }?.let(onPartialResponse)
            ?: throw IllegalStateException("모델이 텍스트 응답을 반환하지 않았습니다.")
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

    /** 대화 전환·화면 종료·모델 교체 때에만 Conversation을 닫아 네이티브 자원 해제를 일관되게 처리한다. */
    fun resetChatConversation() {
        chatConversation?.close()
        chatConversation = null
        chatSystemInstruction = null
    }

    fun close() {
        resetChatConversation()
        engine?.close()
        engine = null
    }
}
