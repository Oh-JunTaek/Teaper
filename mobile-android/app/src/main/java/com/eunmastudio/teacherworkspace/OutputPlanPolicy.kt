package com.eunmastudio.teacherworkspace

import android.content.Context

/**
 * 학생용 출력의 플랜 표시는 앱 패키지에 서명되어 들어가는 설정만 신뢰한다.
 * 교사가 앱에서 임의로 바꿀 수 없으며, 결제 연결 전에는 배포용 기본·플러스 빌드 구분에만 사용한다.
 */
object OutputPlanPolicy {
    private const val PLAN_METADATA_KEY = "com.eunmastudio.teacherworkspace.OUTPUT_PLAN"

    fun isPlus(context: Context): Boolean = context.applicationInfo.metaData
        ?.getString(PLAN_METADATA_KEY)
        ?.equals("plus", ignoreCase = true) == true

    fun shouldShowStudentWatermark(context: Context): Boolean = !isPlus(context)
}
