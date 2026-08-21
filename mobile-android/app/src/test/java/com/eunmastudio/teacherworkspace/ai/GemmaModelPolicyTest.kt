package com.eunmastudio.teacherworkspace.ai

import android.os.PowerManager
import com.eunmastudio.teacherworkspace.AppLockPolicy
import com.eunmastudio.teacherworkspace.HomeCardLayout
import com.eunmastudio.teacherworkspace.HomeCardLayoutPolicy
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GemmaModelPolicyTest {
    @Test
    fun `E2B is the default and allows a normal eligible device`() {
        val profile = DeviceProfile(
            totalMemoryBytes = 4_000_000_000L,
            freeStorageBytes = 6_000_000_000L,
            thermalStatus = PowerManager.THERMAL_STATUS_NONE,
            isPowerSaveMode = false,
        )

        assertTrue(GemmaModel.E2B.isDefault)
        assertTrue(GemmaModel.E2B.eligibility(profile).canInstall)
    }

    @Test
    fun `E4B is not offered on a low memory device`() {
        val profile = DeviceProfile(
            totalMemoryBytes = 6_000_000_000L,
            freeStorageBytes = 8_000_000_000L,
            thermalStatus = PowerManager.THERMAL_STATUS_NONE,
            isPowerSaveMode = false,
        )

        assertFalse(GemmaModel.E4B.isDefault)
        assertFalse(GemmaModel.E4B.eligibility(profile).canInstall)
    }

    @Test
    fun `E4B is offered only with sufficient memory storage and normal thermals`() {
        val profile = DeviceProfile(
            totalMemoryBytes = 8_000_000_000L,
            freeStorageBytes = 7_000_000_000L,
            thermalStatus = PowerManager.THERMAL_STATUS_LIGHT,
            isPowerSaveMode = false,
        )

        val result = GemmaModel.E4B.eligibility(profile)
        assertTrue(result.canInstall)
        assertTrue(result.isRecommended)
    }

    @Test
    fun `severe thermal state blocks E4B and does not recommend E2B`() {
        val profile = DeviceProfile(
            totalMemoryBytes = 12_000_000_000L,
            freeStorageBytes = 12_000_000_000L,
            thermalStatus = PowerManager.THERMAL_STATUS_SEVERE,
            isPowerSaveMode = false,
        )

        assertFalse(GemmaModel.E4B.eligibility(profile).canInstall)
        assertFalse(GemmaModel.E2B.eligibility(profile).isRecommended)
    }

    @Test
    fun `generation prompt preserves source scope non copying and teacher review rules`() {
        val prompt = QuestionPromptContract.generationPrompt(
            request = "화학 I 문항 1개",
            sourceSummaries = "[공식 자료] 성취기준 A",
            teacherInstructions = "표를 선호함",
        )

        assertTrue(prompt.contains("근거 안에서만"))
        assertTrue(prompt.contains("복제"))
        assertTrue(prompt.contains("교사가 검수"))
        assertTrue(prompt.contains("성취기준 A"))
        assertTrue(prompt.contains("표를 선호함"))
    }

    @Test
    fun `only active foreground download stages block another model download`() {
        val activeStages = listOf(
            ModelDownloadUiStage.CONNECTING,
            ModelDownloadUiStage.DOWNLOADING,
            ModelDownloadUiStage.VERIFYING,
            ModelDownloadUiStage.SAVING,
        )

        activeStages.forEach { stage ->
            assertTrue(ModelDownloadUiState(model = GemmaModel.E2B, stage = stage).isRunning)
        }
        assertFalse(ModelDownloadUiState(model = GemmaModel.E2B, stage = ModelDownloadUiStage.COMPLETED).isRunning)
        assertFalse(ModelDownloadUiState(model = GemmaModel.E2B, stage = ModelDownloadUiStage.FAILED).isRunning)
    }

    @Test
    fun `teacher chat request separates system rules from role based history`() {
        val request = TeacherChatPromptContract.conversationRequest(
            history = listOf(
                ChatPromptMessage(isUser = true, content = "화학 결합을 설명해 주세요"),
                ChatPromptMessage(isUser = false, content = "자료를 확인해 보겠습니다"),
                ChatPromptMessage(isUser = true, content = "세 줄로 다시 설명해 주세요"),
            ),
            sourceSummaries = "[공식 자료] 성취기준 A · 2쪽\n원자 간 결합",
            teacherInstructions = "표로 정리",
        )

        assertTrue(request.systemInstruction.contains("기기 안에서만"))
        assertTrue(request.systemInstruction.contains("웹 검색"))
        assertTrue(request.systemInstruction.contains("복제"))
        assertTrue(request.systemInstruction.contains("교사 최종 검수"))
        assertTrue(request.systemInstruction.contains("성취기준 A"))
        assertFalse(request.systemInstruction.contains("화학 결합을 설명해 주세요"))
        assertTrue(request.history.size == 3)
        assertTrue(request.history.last().isUser)
        assertTrue(request.history.last().content.contains("세 줄로"))
    }

    @Test
    fun `home card layout defaults to album and safely restores list selection`() {
        assertTrue(HomeCardLayoutPolicy.defaultLayout == HomeCardLayout.ALBUM)
        assertTrue(HomeCardLayoutPolicy.fromStored("LIST") == HomeCardLayout.LIST)
        assertTrue(HomeCardLayoutPolicy.fromStored("unexpected") == HomeCardLayout.ALBUM)
    }

    @Test
    fun `app lock requires authentication only for enabled locked sessions`() {
        assertTrue(AppLockPolicy.shouldRequireAuthentication(enabled = true, sessionLocked = true))
        assertFalse(AppLockPolicy.shouldRequireAuthentication(enabled = false, sessionLocked = true))
        assertFalse(AppLockPolicy.shouldRequireAuthentication(enabled = true, sessionLocked = false))
    }

    @Test
    fun `chat response is normalized and never rendered before persistence succeeds`() {
        val normalized = ChatTurnPolicy.normalizeForPersistence("  준비된 답변  ")

        assertTrue(normalized == "준비된 답변")
        assertTrue(ChatTurnPolicy.requirePersisted(normalized, persisted = true) == "준비된 답변")
        assertTrue(ChatTurnPolicy.MAX_RESPONSE_TOKENS == 128)
        val rejected = runCatching { ChatTurnPolicy.requirePersisted(normalized, persisted = false) }
        assertTrue(rejected.isFailure)
        assertTrue(runCatching { ChatTurnPolicy.normalizeForPersistence("   ") }.isFailure)
    }

    @Test
    fun `chat context keeps the newest question within a bounded history budget`() {
        val newestQuestion = "가장 최근 질문은 반드시 남아야 합니다."
        val request = TeacherChatPromptContract.conversationRequest(
            history = (1..8).map { index ->
                ChatPromptMessage(
                    isUser = index % 2 == 1,
                    content = if (index == 8) newestQuestion else "이전 대화 $index ".repeat(180),
                )
            },
            sourceSummaries = "등록 자료 ".repeat(300),
            teacherInstructions = "교사 선호 ".repeat(100),
        )

        assertTrue(request.history.sumOf { it.content.length } <= ChatTurnPolicy.MAX_HISTORY_CHARACTERS)
        assertTrue(request.history.last().content.contains(newestQuestion))
        assertTrue(request.systemInstruction.length < 2_000)
    }
}
