package com.eunmastudio.teacherworkspace

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.eunmastudio.teacherworkspace.ai.GemmaModel
import com.eunmastudio.teacherworkspace.ai.LiteRtLmRunner
import com.eunmastudio.teacherworkspace.ai.ModelDownloadManager
import com.eunmastudio.teacherworkspace.ai.ModelSelection
import com.eunmastudio.teacherworkspace.ai.PromptDisclosurePolicy
import com.eunmastudio.teacherworkspace.ai.QuickQuizPromptContract
import kotlinx.coroutines.launch

/** Gemma E2B/E4B로 한 개념을 빠르게 확인하는 짧은 쪽지시험을 생성·검수한다. */
class QuickQuizActivity : AppCompatActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var downloads: ModelDownloadManager
    private lateinit var runner: LiteRtLmRunner
    private lateinit var list: LinearLayout
    private lateinit var status: TextView
    private lateinit var generate: Button
    private lateinit var appLockGate: AppLockGate
    private var activeModel: GemmaModel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(10, 20, 18)
        window.navigationBarColor = Color.rgb(10, 20, 18)
        store = LocalWorkspaceStore(this); downloads = ModelDownloadManager(this); runner = LiteRtLmRunner(this)
        val screen = buildScreen(); appLockGate = AppLockGate(this); setContentView(appLockGate.attach(screen))
        ViewCompat.setOnApplyWindowInsetsListener(screen) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
    }
    override fun onDestroy() { runner.close(); super.onDestroy() }
    override fun onResume() { super.onResume(); if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired(); refreshList() }

    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(22), dp(20), dp(30)); setBackgroundColor(Color.rgb(10, 20, 18)) }
        content.addView(LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; addView(TextView(this@QuickQuizActivity).apply { text = "간결한 쪽지시험"; textSize = 25f; setTextColor(Color.rgb(244, 241, 229)); setTypeface(typeface, android.graphics.Typeface.BOLD) }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)); addView(button("닫기").apply { setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(76), dp(44))) })
        content.addView(TextView(this).apply { text = "한 개념을 한두 문장으로 확인하는 스피드 퀴즈입니다. 복합 자료와 긴 배경 설명은 만들지 않습니다."; textSize = 14f; setTextColor(Color.rgb(185, 205, 191)); setPadding(0, dp(8), 0, dp(16)) })
        val subject = field("과목", "화학 I"); val unit = field("단원", "공통"); val topic = field("확인할 개념·정의", "예: 공유 결합의 정의"); val difficulty = field("난이도", "낮음"); val count = field("문항 수", "3").apply { inputType = android.text.InputType.TYPE_CLASS_NUMBER }
        listOf(subject, unit, topic, difficulty, count).forEach { content.addView(it, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) }) }
        status = TextView(this).apply { text = "E2B 또는 E4B를 준비한 뒤 생성할 수 있습니다."; textSize = 13f; setTextColor(Color.rgb(191, 207, 195)); setPadding(dp(4), dp(6), dp(4), dp(8)) }; content.addView(status)
        generate = button("로컬 모델로 쪽지시험 생성", true).apply { setOnClickListener { val term = topic.text.toString().trim(); val blocked = PromptDisclosurePolicy.safeResponseFor(term); if (blocked != null) { status.text = blocked; return@setOnClickListener }; if (term.isBlank()) { status.text = "확인할 개념 또는 정의를 입력해 주세요."; return@setOnClickListener }; lifecycleScope.launch { if (ensureModelReady()) createQuiz(subject.text.toString().trim(), unit.text.toString().trim(), term, difficulty.text.toString().trim(), count.text.toString().toIntOrNull()?.coerceIn(1, 10) ?: 3) } } }
        content.addView(generate, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply { bottomMargin = dp(18) })
        content.addView(TextView(this).apply { text = "쪽지시험 검수"; textSize = 18f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) })
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(8), 0, 0) }; content.addView(list)
        return ScrollView(this).apply { addView(content) }
    }

    private suspend fun ensureModelReady(): Boolean {
        if (activeModel != null) return true
        val selected = ModelSelection.selected(this)
        if (selected == null || !downloads.isInstalled(selected)) { status.text = "생성 전 모델 관리에서 기본 모델 E2B를 내려받아 선택해 주세요."; return false }
        return try { status.text = "${selected.displayName}을 쪽지시험용으로 준비하고 있습니다."; runner.initialize(downloads.installedFile(selected).absolutePath, preferGpu = false); activeModel = selected; true } catch (error: Throwable) { status.text = error.message ?: "쪽지시험 모델을 준비하지 못했습니다."; false }
    }

    private fun createQuiz(subject: String, unit: String, topic: String, difficulty: String, count: Int) {
        lifecycleScope.launch {
            try {
                generate.isEnabled = false; status.text = "한 개념을 확인하는 짧은 문항을 만들고 있습니다."
                val output = StringBuilder(); runner.generate(QuickQuizPromptContract.generationPrompt(subject, unit, topic, difficulty, count, store.teacherInstructions())) { partial -> output.append(partial); runOnUiThread { status.text = output.toString().takeLast(240) } }
                val response = output.toString().trim(); val safe = if (PromptDisclosurePolicy.isPotentialDisclosure(response)) PromptDisclosurePolicy.SAFE_REPLY else response
                store.saveQuickQuiz(LocalQuickQuiz(subject = subject.ifBlank { "화학 I" }, unit = unit.ifBlank { "공통" }, topic = topic, difficulty = difficulty.ifBlank { "낮음" }, questionCount = count, content = safe, model = activeModel?.displayName ?: "Gemma", promptVersion = QuickQuizPromptContract.VERSION))
                status.text = "쪽지시험을 검수 목록에 저장했습니다. 정답과 해설을 확인해 주세요."; refreshList()
            } catch (error: Throwable) { status.text = error.message ?: "쪽지시험 생성에 실패했습니다." } finally { generate.isEnabled = true }
        }
    }

    private fun refreshList() {
        if (!::list.isInitialized) return
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        list.removeAllViews()
        if (store.quickQuizzes().isEmpty()) list.addView(TextView(this).apply { text = "아직 만든 쪽지시험이 없습니다."; setTextColor(Color.rgb(181, 200, 185)); setPadding(dp(4), dp(12), dp(4), dp(12)) })
        store.quickQuizzes().forEach { quiz -> list.addView(LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(12)); background = surface(Color.rgb(22, 38, 33), dp(20)); addView(TextView(this@QuickQuizActivity).apply { text = "[${quiz.reviewStatus}] ${quiz.topic}"; textSize = 17f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) }); addView(TextView(this@QuickQuizActivity).apply { text = "${quiz.subject} · ${quiz.unit} · ${quiz.questionCount}문항 · ${quiz.model}"; textSize = 12f; setTextColor(Color.rgb(177, 199, 183)); setPadding(0, dp(4), 0, dp(5)) }); addView(TextView(this@QuickQuizActivity).apply { text = quiz.content; textSize = 14f; setTextColor(Color.rgb(201, 215, 202)); maxLines = 10 }); addView(LinearLayout(this@QuickQuizActivity).apply { addView(button("내용·검수").apply { setOnClickListener { showQuizDetail(quiz) } }, LinearLayout.LayoutParams(dp(112), dp(38))); addView(button("삭제").apply { setOnClickListener { store.deleteQuickQuiz(quiz.id); refreshList() } }, LinearLayout.LayoutParams(dp(70), dp(38)).apply { leftMargin = dp(8) }) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) }) }
    }

    private fun showQuizDetail(quiz: LocalQuickQuiz) { AlertDialog.Builder(this).setTitle("${quiz.topic} · ${quiz.reviewStatus}").setMessage(quiz.content).setNegativeButton("보류") { _, _ -> store.updateQuickQuizReviewStatus(quiz.id, "보류"); refreshList() }.setNeutralButton("수정 필요") { _, _ -> store.updateQuickQuizReviewStatus(quiz.id, "수정 필요"); refreshList() }.setPositiveButton("교사 검수 후 승인") { _, _ -> store.updateQuickQuizReviewStatus(quiz.id, "승인"); refreshList(); status.text = "승인으로 표시했습니다. 실제 사용 전 다시 확인해 주세요." }.show() }
    private fun field(label: String, value: String) = EditText(this).apply { hint = label; setText(value); setTextColor(Color.WHITE); setHintTextColor(Color.rgb(145, 165, 151)); background = surface(Color.rgb(15, 29, 25), (resources.displayMetrics.density * 16).toInt()); setPadding((resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt(), (resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt()) }
    private fun button(label: String, accent: Boolean = false) = Button(this).apply { text = label; isAllCaps = false; textSize = 14f; setTextColor(if (accent) Color.rgb(20, 28, 23) else Color.rgb(232, 239, 231)); background = surface(if (accent) Color.rgb(216, 191, 140) else Color.rgb(32, 54, 47), (resources.displayMetrics.density * 15).toInt()) }
    private fun surface(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat(); setStroke((resources.displayMetrics.density).toInt(), Color.rgb(51, 75, 67)) }
}
