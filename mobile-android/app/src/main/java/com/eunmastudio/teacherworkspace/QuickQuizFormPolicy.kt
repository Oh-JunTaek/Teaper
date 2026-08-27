package com.eunmastudio.teacherworkspace

/** 현재 서비스에서 제공하는 과목 범위와 쪽지시험용 교사 선택 값을 한곳에 둔다. */
object QuickQuizFormPolicy {
    val subjects = listOf(
        "중등 과학", "중등 수학", "통합과학 1", "통합과학 2", "물리학 I", "화학 I", "생명과학 I", "지구과학 I", "대수", "미적분Ⅰ", "확률과 통계",
    )
    val questionCounts = (1..5).toList()
    val targetCorrectRates = (10..90 step 10).toList()
    /** 세 플랫폼과 같은 저장값을 사용해 쪽지시험 형식별 생성·검수·공유를 맞춘다. */
    val questionFormats = listOf("multiple_choice", "short_answer", "ox")

    fun subjectIndex(value: String?): Int = subjects.indexOf(value).takeIf { it >= 0 } ?: subjects.indexOf("화학 I")
    fun difficultyLabel(rate: Int): String = "목표 정답률 $rate% · ${when { rate <= 30 -> "어려움"; rate <= 60 -> "보통"; else -> "쉬움" }}"
    fun questionFormatLabel(value: String): String = when (value) { "short_answer" -> "주관식"; "ox" -> "O/X"; else -> "객관식 (4지선다)" }
}
