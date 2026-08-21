package com.eunmastudio.teacherworkspace.ai

/**
 * 모바일 파일럿에서 허용하는 모델은 Gemma 4 E2B·E4B 두 종류뿐이다.
 * URL·SHA-256은 LiteRT Community 공개 모델 메타데이터에서 검증한 값이다.
 */
enum class GemmaModel(
    val displayName: String,
    val fileName: String,
    val downloadUrl: String,
    val sha256: String,
    val byteSize: Long,
    val requiredFreeStorageBytes: Long,
    val requiredTotalMemoryBytes: Long,
    val isDefault: Boolean,
    val recommendation: String,
) {
    E2B(
        displayName = "Gemma 4 E2B",
        fileName = "gemma-4-E2B-it.litertlm",
        downloadUrl = "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/6b78abd019e61a1ca4cbe3b212d2c9ce8ff38a94/gemma-4-E2B-it.litertlm",
        sha256 = "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c",
        byteSize = 2_588_147_712L,
        requiredFreeStorageBytes = 5_000_000_000L,
        requiredTotalMemoryBytes = 0L,
        isDefault = true,
        recommendation = "기본 모델입니다. 충분한 저장 공간을 확인한 뒤 내려받아 오프라인 문항 보조에 사용합니다.",
    ),
    E4B(
        displayName = "Gemma 4 E4B",
        fileName = "gemma-4-E4B-it.litertlm",
        downloadUrl = "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/2eee7ac325f20eb8c9ac1d0e972f7c84663062da/gemma-4-E4B-it.litertlm",
        sha256 = "0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0",
        byteSize = 3_659_530_240L,
        requiredFreeStorageBytes = 7_000_000_000L,
        requiredTotalMemoryBytes = 8_000_000_000L,
        isDefault = false,
        recommendation = "고성능 기기용 선택지입니다. 저장 공간·메모리·발열 상태를 확인하고 필요할 때만 사용합니다.",
    ),
}

data class ModelEligibility(
    val canInstall: Boolean,
    val isRecommended: Boolean,
    val message: String,
)
