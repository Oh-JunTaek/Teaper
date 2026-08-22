package com.eunmastudio.teacherworkspace

/** 현재 서비스에서 제공하는 과목 범위와 쪽지시험용 교사 선택 값을 한곳에 둔다. */
object QuickQuizFormPolicy {
    val subjects = listOf(
        "중등 과학", "중등 수학", "통합과학 1", "통합과학 2", "물리학 I", "화학 I", "생명과학 I", "지구과학 I", "대수", "미적분Ⅰ", "확률과 통계",
    )
    val questionCounts = (1..5).toList()
    val targetCorrectRates = (10..90 step 10).toList()

    fun subjectIndex(value: String?): Int = subjects.indexOf(value).takeIf { it >= 0 } ?: subjects.indexOf("화학 I")
    fun difficultyLabel(rate: Int): String = "목표 정답률 $rate% · ${when { rate <= 30 -> "어려움"; rate <= 60 -> "보통"; else -> "쉬움" }}"
}
