package com.eunmastudio.teacherworkspace

/** Android에서도 웹·데스크톱과 같은 링크 전용 공식 출처를 제공한다. 원문을 앱에 복제하지 않는다. */
data class OfficialSourceLink(
    val title: String,
    val provider: String,
    val scope: String,
    val url: String,
)

object OfficialSourceCatalog {
    val entries = listOf(
        OfficialSourceLink(
            title = "2022 개정 교육과정 고시",
            provider = "교육부",
            scope = "중·고등 과학·수학 등 교과 교육과정의 공식 기준",
            url = "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&lev=0&statusYN=W&s=moe&m=0404&opType=N&boardSeq=93458",
        ),
        OfficialSourceLink(
            title = "2022 개정 교육과정 원문·해설서",
            provider = "국가교육과정정보센터",
            scope = "학교급·과목별 원문과 해설서 탐색",
            url = "https://ncic.re.kr/inv/org/list.do?ck=main",
        ),
        OfficialSourceLink(
            title = "학생평가지원포털",
            provider = "한국교육과정평가원",
            scope = "성취기준·평가기준과 평가 자료 확인",
            url = "https://stas.moe.go.kr/",
        ),
    )
}
