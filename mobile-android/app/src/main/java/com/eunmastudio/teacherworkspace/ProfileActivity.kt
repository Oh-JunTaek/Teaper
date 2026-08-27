package com.eunmastudio.teacherworkspace

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/** Android local-only 앱의 내 정보·플랜 안내 화면이다. 웹 계정과의 자동 플랜 연결을 주장하지 않는다. */
class ProfileActivity : AppCompatActivity() {
    private lateinit var appLockGate: AppLockGate

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val store = LocalWorkspaceStore(this)
        val screen = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(10, 20, 18))
            addView(LinearLayout(this@ProfileActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(22), dp(18), dp(22), dp(32))
                addView(Button(this@ProfileActivity).apply {
                    text = "←  내 정보"; isAllCaps = false; textSize = 18f; setTextColor(Color.WHITE)
                    background = chalk(Color.rgb(29, 50, 43), dp(16)); gravity = Gravity.CENTER_VERTICAL
                    setOnClickListener { finish() }
                }, LinearLayout.LayoutParams(dp(132), dp(46)).apply { bottomMargin = dp(16) })
                addView(TextView(this@ProfileActivity).apply { text = "나의 작업 현황"; textSize = 27f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) })
                addView(TextView(this@ProfileActivity).apply { text = "이 기기에 저장된 작업을 간단히 확인합니다."; textSize = 14f; setTextColor(Color.rgb(190, 207, 190)); setPadding(0, dp(8), 0, dp(16)) })
                val questions = store.questions()
                val quickQuizzes = store.quickQuizzes()
                // 개인 작업 현황도 쪽지시험 세트가 아닌 개별 승인 문항을 포함한 같은 기준으로 계산한다.
                val approvedCount = questions.count { it.reviewStatus == "승인" } + quickQuizzes.sumOf { quiz -> quiz.questionReviewStatuses.count { it == "승인" } }
                val summary = listOf("등록 자료" to store.sources().size, "문항" to questions.size, "승인 문항" to approvedCount, "메모" to store.notes().size, "쪽지시험" to quickQuizzes.size, "대화" to store.chatThreads().size)
                summary.chunked(2).forEach { row ->
                    addView(LinearLayout(this@ProfileActivity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        row.forEachIndexed { index, item -> addView(statCard(item.first, item.second), LinearLayout.LayoutParams(0, dp(92), 1f).apply { if (index == 0 && row.size == 2) rightMargin = dp(10) }) }
                        if (row.size == 1) addView(TextView(this@ProfileActivity), LinearLayout.LayoutParams(0, dp(92), 1f))
                    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(92)).apply { bottomMargin = dp(10) })
                }
                addView(infoCard("교사 플러스 파일럿", "문제집형 출력과 이미지 대화 같은 생산성 기능을 파일럿으로 제공합니다. Android의 이 안내는 웹 플랜과 아직 자동 연결되지 않으며, 결제·자동 변경도 연결되어 있지 않습니다."), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12) })
                addView(infoCard("내 정보 보호", "이 화면의 작업 수는 이 기기 안에서 계산합니다. 자료 내용·문항 원문·대화 내용은 운영 통계로 전송하지 않습니다."), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) })
            })
        }
        appLockGate = AppLockGate(this)
        setContentView(appLockGate.attach(screen))
        ViewCompat.setOnApplyWindowInsetsListener(screen) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
    }

    override fun onResume() {
        super.onResume()
        if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired()
    }

    private fun statCard(label: String, value: Int) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(14), dp(13), dp(14), dp(10)); background = chalk(Color.rgb(22, 38, 33), dp(18))
        addView(TextView(this@ProfileActivity).apply { text = value.toString(); textSize = 25f; setTextColor(Color.rgb(216, 191, 140)); setTypeface(typeface, android.graphics.Typeface.BOLD) })
        addView(TextView(this@ProfileActivity).apply { text = label; textSize = 13f; setTextColor(Color.rgb(192, 208, 194)); setPadding(0, dp(4), 0, 0) })
    }

    private fun infoCard(title: String, description: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(16), dp(18), dp(16)); background = chalk(Color.rgb(20, 47, 41), dp(20))
        addView(TextView(this@ProfileActivity).apply { text = title; textSize = 17f; setTextColor(Color.rgb(244, 240, 224)); setTypeface(typeface, android.graphics.Typeface.BOLD) })
        addView(TextView(this@ProfileActivity).apply { text = description; textSize = 13.5f; setLineSpacing(0f, 1.12f); setTextColor(Color.rgb(191, 211, 193)); setPadding(0, dp(7), 0, 0) })
    }

    private fun chalk(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat(); setStroke(dp(1), Color.rgb(53, 77, 68)) }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
