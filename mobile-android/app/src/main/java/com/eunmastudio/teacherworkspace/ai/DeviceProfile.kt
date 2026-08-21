package com.eunmastudio.teacherworkspace.ai

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.os.StatFs

data class DeviceProfile(
    val totalMemoryBytes: Long,
    val freeStorageBytes: Long,
    val thermalStatus: Int,
    val isPowerSaveMode: Boolean,
) {
    companion object {
        fun read(context: Context): DeviceProfile {
            val memoryInfo = ActivityManager.MemoryInfo()
            val activityManager = context.getSystemService(ActivityManager::class.java)
            activityManager.getMemoryInfo(memoryInfo)
            val storage = StatFs(context.filesDir.absolutePath)
            val powerManager = context.getSystemService(PowerManager::class.java)
            val thermal = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                powerManager.currentThermalStatus
            } else {
                PowerManager.THERMAL_STATUS_NONE
            }
            return DeviceProfile(
                totalMemoryBytes = memoryInfo.totalMem,
                freeStorageBytes = storage.availableBytes,
                thermalStatus = thermal,
                isPowerSaveMode = powerManager.isPowerSaveMode,
            )
        }
    }
}

/** 기기 기준은 파일럿 안전장치이며, 벤치마크를 거쳐 조정한다. */
fun GemmaModel.eligibility(profile: DeviceProfile): ModelEligibility {
    if (profile.freeStorageBytes < requiredFreeStorageBytes) {
        return ModelEligibility(false, false, "저장 공간이 부족합니다. 설치 전 여유 공간을 확보해 주세요.")
    }
    if (this == GemmaModel.E4B && profile.totalMemoryBytes < requiredTotalMemoryBytes) {
        return ModelEligibility(false, false, "E4B는 현재 기기에서 권장하지 않습니다. 기본 E2B를 사용해 주세요.")
    }
    if (profile.thermalStatus >= PowerManager.THERMAL_STATUS_SEVERE || profile.isPowerSaveMode) {
        return ModelEligibility(
            canInstall = this == GemmaModel.E2B,
            isRecommended = false,
            message = "기기가 절전 또는 높은 발열 상태입니다. 식힌 뒤 다시 시도해 주세요.",
        )
    }
    return if (this == GemmaModel.E4B) {
        ModelEligibility(true, true, "고성능 기기용 E4B를 설치할 수 있습니다. 사용 중 발열·배터리 안내를 확인해 주세요.")
    } else {
        ModelEligibility(true, true, recommendation)
    }
}
