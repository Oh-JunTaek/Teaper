package com.eunmastudio.teacherworkspace.ai

import android.os.PowerManager
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
    fun `teacher chat prompt preserves on-device source and review boundaries`() {
        val prompt = TeacherChatPromptContract.conversationPrompt(
            history = listOf(
                ChatPromptMessage(isUser = true, content = "화학 결합을 설명해 주세요"),
                ChatPromptMessage(isUser = false, content = "자료를 확인해 보겠습니다"),
            ),
            sourceSummaries = "[공식 자료] 성취기준 A · 2쪽\n원자 간 결합",
            teacherInstructions = "표로 정리",
        )

        assertTrue(prompt.contains("기기 안에서만"))
        assertTrue(prompt.contains("웹 검색"))
        assertTrue(prompt.contains("복제"))
        assertTrue(prompt.contains("교사 최종 검수"))
        assertTrue(prompt.contains("성취기준 A"))
        assertTrue(prompt.contains("교사: 화학 결합을 설명해 주세요"))
        assertTrue(prompt.contains("AI 보조자: 자료를 확인해 보겠습니다"))
    }

    @Test
    fun `home card layout defaults to album and safely restores list selection`() {
        assertTrue(HomeCardLayoutPolicy.defaultLayout == HomeCardLayout.ALBUM)
        assertTrue(HomeCardLayoutPolicy.fromStored("LIST") == HomeCardLayout.LIST)
        assertTrue(HomeCardLayoutPolicy.fromStored("unexpected") == HomeCardLayout.ALBUM)
    }
}
