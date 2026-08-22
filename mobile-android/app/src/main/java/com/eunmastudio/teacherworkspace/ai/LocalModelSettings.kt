package com.eunmastudio.teacherworkspace.ai

import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig

/** 교사가 조정할 수 있는 값만 보관하며, 범위를 벗어난 값은 실행 전에 안전한 권장값으로 보정한다. */
enum class AndroidAccelerationPreference(val label: String) {
    CPU("CPU 안정성"),
    GPU("GPU 가속"),
}

data class LocalModelSettings(
    val contextTokens: Int = 2_048,
    /** 0은 별도 출력 상한 없이 남은 맥락 예산 안에서 생성한다는 뜻이다. */
    val maxOutputTokens: Int = 0,
    val temperature: Double = 0.35,
    val topK: Int = 20,
    val topP: Double = 0.90,
    val acceleration: AndroidAccelerationPreference = AndroidAccelerationPreference.CPU,
    val thinkingEnabled: Boolean = false,
    /** LiteRT-LM Kotlin 0.16.1 실행 경로에는 MTP 고급 엔진 설정 전달 API가 없어 저장만 한다. */
    val speculativeDecodingEnabled: Boolean = false,
)

object LocalModelSettingsPolicy {
    val contextChoices = listOf(2_048, 4_096, 8_192)
    val outputChoices = listOf(0, 512, 768, 1_024, 1_536)

    fun normalize(value: LocalModelSettings): LocalModelSettings = value.copy(
        contextTokens = value.contextTokens.takeIf { it in contextChoices } ?: 2_048,
        maxOutputTokens = value.maxOutputTokens.takeIf { it in outputChoices } ?: 0,
        temperature = value.temperature.coerceIn(0.0, 1.2),
        topK = value.topK.coerceIn(1, 100),
        topP = value.topP.coerceIn(0.10, 1.00),
    )

    fun samplerConfig(value: LocalModelSettings): SamplerConfig {
        val safe = normalize(value)
        return SamplerConfig(temperature = safe.temperature, topK = safe.topK, topP = safe.topP)
    }

    /** 현재 앱이 허용하는 Gemma 4 E2B·E4B는 추론 설정을 수용하되, 원문 추론 과정은 화면·저장소에 남기지 않는다. */
    fun thinkingConfig(value: LocalModelSettings): ThinkingConfig = ThinkingConfig(enableThinking = normalize(value).thinkingEnabled)
}
