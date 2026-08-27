package com.eunmastudio.teacherworkspace

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.ArrayAdapter
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

    /** 한 개념 입력·모델 준비·생성·세트 검수를 한 화면에서 이어 주는 Android 전용 작업 화면이다. */
    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(22), dp(20), dp(30)); setBackgroundColor(Color.rgb(10, 20, 18)) }
        content.addView(LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; addView(TextView(this@QuickQuizActivity).apply { text = "간결한 쪽지시험"; textSize = 25f; setTextColor(Color.rgb(244, 241, 229)); setTypeface(typeface, android.graphics.Typeface.BOLD) }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)); addView(button("닫기").apply { setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(76), dp(44))) })
        content.addView(TextView(this).apply { text = "한 개념을 한두 문장으로 확인하는 스피드 퀴즈입니다. 복합 자료와 긴 배경 설명은 만들지 않습니다."; textSize = 14f; setTextColor(Color.rgb(185, 205, 191)); setPadding(0, dp(8), 0, dp(16)) })
        content.addView(fieldLabel("과목"))
        val subject = select(QuickQuizFormPolicy.subjects).apply { setSelection(QuickQuizFormPolicy.subjectIndex(store.quickQuizLastSubject())) }
        content.addView(subject, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) })
        content.addView(fieldLabel("단원"))
        val unit = field("예: 화학 결합", "공통")
        content.addView(unit, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) })
        content.addView(fieldLabel("확인할 개념·정의"))
        val topic = field("예: 공유 결합의 정의", "")
        content.addView(topic, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) })
        content.addView(fieldLabel("문항 형식"))
        val questionFormat = select(QuickQuizFormPolicy.questionFormats.map(QuickQuizFormPolicy::questionFormatLabel))
        content.addView(questionFormat, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) })
        content.addView(fieldLabel("목표 정답률"))
        val rateLabels = QuickQuizFormPolicy.targetCorrectRates.map(QuickQuizFormPolicy::difficultyLabel)
        val difficulty = select(rateLabels).apply { setSelection(QuickQuizFormPolicy.targetCorrectRates.indexOf(60)) }
        content.addView(difficulty, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) })
        content.addView(fieldLabel("문항 수"))
        val count = select(QuickQuizFormPolicy.questionCounts.map { "${it}문항" }).apply { setSelection(QuickQuizFormPolicy.questionCounts.indexOf(3)) }
        content.addView(count, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) })
        status = TextView(this).apply { text = "AI 도움 기능을 준비한 뒤 생성할 수 있습니다."; textSize = 13f; setTextColor(Color.rgb(191, 207, 195)); setPadding(dp(4), dp(6), dp(4), dp(8)) }; content.addView(status)
        generate = button("AI 도움 기능으로 쪽지시험 생성", true).apply { setOnClickListener {
            val term = topic.text.toString().trim()
            val blocked = PromptDisclosurePolicy.safeResponseFor(term)
            if (blocked != null) { status.text = blocked; return@setOnClickListener }
            if (term.isBlank()) { status.text = "확인할 개념 또는 정의를 입력해 주세요."; return@setOnClickListener }
            val subjectValue = QuickQuizFormPolicy.subjects[subject.selectedItemPosition]
            val questionFormatValue = QuickQuizFormPolicy.questionFormats[questionFormat.selectedItemPosition]
            val rate = QuickQuizFormPolicy.targetCorrectRates[difficulty.selectedItemPosition]
            val countValue = QuickQuizFormPolicy.questionCounts[count.selectedItemPosition]
            generate.isEnabled = false
            lifecycleScope.launch { try {
                store.saveQuickQuizLastSubject(subjectValue)
                if (ensureModelReady()) createQuiz(subjectValue, unit.text.toString().trim(), term, QuickQuizFormPolicy.difficultyLabel(rate), questionFormatValue, countValue)
            } catch (error: Throwable) { status.text = error.message ?: "쪽지시험 생성에 실패했습니다." } finally { generate.isEnabled = true } }
        } }
        content.addView(generate, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply { bottomMargin = dp(18) })
        content.addView(TextView(this).apply { text = "쪽지시험 검수"; textSize = 18f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) })
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(8), 0, 0) }; content.addView(list)
        return ScrollView(this).apply { addView(content) }
    }

    /** 기기에 이미 준비된 도움 기능만 초기화하며, 다운로드·외부 전송을 자동으로 시작하지 않는다. */
    private suspend fun ensureModelReady(): Boolean {
        if (activeModel != null) return true
        val selected = ModelSelection.selected(this)
        if (selected == null || !downloads.isInstalled(selected)) { status.text = "생성 전 모델 관리에서 기본 AI 도움 기능을 준비해 주세요."; return false }
        return try { status.text = "${selected.displayName}을 쪽지시험용으로 준비하고 있습니다."; runner.initialize(downloads.installedFile(selected).absolutePath, preferGpu = false); activeModel = selected; true } catch (error: Throwable) { status.text = error.message ?: "쪽지시험 모델을 준비하지 못했습니다."; false }
    }

    /** 스트리밍 토큰은 화면에 노출하지 않고, LiteRT-LM 생성이 끝난 한 번의 결과만 검수 목록에 추가한다. */
    private suspend fun createQuiz(subject: String, unit: String, topic: String, difficulty: String, questionFormat: String, count: Int) {
        status.text = "쪽지시험을 생성하고 있습니다. 완료되면 검수 목록에 표시합니다."
        val response = runner.generateFinal(QuickQuizPromptContract.generationPrompt(subject, unit, topic, difficulty, questionFormat, count, store.teacherInstructions())).trim()
        if (response.isBlank()) throw IllegalStateException("모델이 빈 쪽지시험을 반환했습니다. 다시 시도해 주세요.")
        val safe = if (PromptDisclosurePolicy.isPotentialDisclosure(response)) PromptDisclosurePolicy.SAFE_REPLY else response
        store.saveQuickQuiz(LocalQuickQuiz(subject = subject.ifBlank { "화학 I" }, unit = unit.ifBlank { "공통" }, topic = topic, difficulty = difficulty.ifBlank { "낮음" }, questionFormat = questionFormat, questionCount = count, content = safe, model = activeModel?.displayName ?: "Gemma", promptVersion = QuickQuizPromptContract.VERSION))
        status.text = "쪽지시험을 검수 목록에 저장했습니다. 정답과 해설을 확인해 주세요."
        refreshList()
    }

    /** 앱 전용 저장소의 세트를 최신순으로 다시 그리고, 문항별 검수 결과를 요약해 보여 준다. */
    private fun refreshList() {
        if (!::list.isInitialized) return
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        list.removeAllViews()
        val quickQuizzes = store.quickQuizzes()
        if (quickQuizzes.isEmpty()) list.addView(TextView(this).apply { text = "아직 만든 쪽지시험이 없습니다."; setTextColor(Color.rgb(181, 200, 185)); setPadding(dp(4), dp(12), dp(4), dp(12)) }) else {
            val pending = quickQuizzes.filter { it.questionReviewStatuses.contains("검수 대기") }
            val pendingQuestions = pending.sumOf { quiz -> quiz.questionReviewStatuses.count { it == "검수 대기" } }
            val latest = pending.maxByOrNull { it.createdAt }
            list.addView(TextView(this).apply { text = if (latest == null) "현재 검수 대기 쪽지시험 문항이 없습니다." else "검수 대기 ${pending.size}세트 · $pendingQuestions문항\n가장 최근 미검수: ${latest.topic} · ${quickQuizCreatedAtLabel(latest.createdAt)}"; textSize = 13f; setTextColor(if (latest == null) Color.rgb(169, 215, 190) else Color.rgb(241, 202, 126)); setPadding(dp(8), dp(10), dp(8), dp(12)); background = surface(Color.rgb(28, 48, 40), dp(14)) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) })
        }
        store.quickQuizzes().forEach { quiz -> list.addView(LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(12)); background = surface(Color.rgb(22, 38, 33), dp(20)); val approved = quiz.questionReviewStatuses.count { it == "승인" }; addView(TextView(this@QuickQuizActivity).apply { text = "[${store.quickQuizReviewSummary(quiz)}] ${quiz.topic}"; textSize = 17f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) }); addView(TextView(this@QuickQuizActivity).apply { text = "${quiz.subject} · ${quiz.unit} · ${QuickQuizFormPolicy.questionFormatLabel(quiz.questionFormat)} · ${quiz.questionCount}문항 · 승인 $approved문항"; textSize = 12f; setTextColor(Color.rgb(177, 199, 183)); setPadding(0, dp(4), 0, dp(5)) }); addView(TextView(this@QuickQuizActivity).apply { text = readableQuickQuizText(quiz.content); textSize = 14f; setTextColor(Color.rgb(201, 215, 202)); maxLines = 10 }); addView(LinearLayout(this@QuickQuizActivity).apply { addView(button("문항별 검수").apply { setOnClickListener { showQuizDetail(quiz) } }, LinearLayout.LayoutParams(dp(112), dp(38))); addView(button("학생용 공유").apply { setOnClickListener { shareStudentQuiz(quiz) } }, LinearLayout.LayoutParams(dp(96), dp(38)).apply { leftMargin = dp(8) }); addView(button("삭제").apply { setOnClickListener { store.deleteQuickQuiz(quiz.id); refreshList() } }, LinearLayout.LayoutParams(dp(70), dp(38)).apply { leftMargin = dp(8) }) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) }) }
    }

    /** 승인한 문항에서만 정답·해설·개념을 뺀 학생용 공유 텍스트를 만든다. */
    private fun studentShareText(quiz: LocalQuickQuiz): String? {
        val blocks = quickQuizBlocks(quiz.content)
        val marker = Regex("(?m)^\\s*(정답|해설|개념)\\s*[:：]")
        val questions = blocks.mapIndexedNotNull { index, block -> if (quiz.questionReviewStatuses.getOrElse(index) { "검수 대기" } != "승인") null else marker.find(block)?.let { block.substring(0, it.range.first).trim() } }.filter { it.isNotBlank() }
        if (questions.isEmpty()) return null
        return questions.mapIndexed { index, question -> "${index + 1}번\n${readableQuickQuizText(question.replace(Regex("(?m)^문항\\s*[:：]\\s*"), ""))}" }.joinToString("\n\n")
    }

    /** 부분 승인 세트도 승인 문항이 하나 이상이면 학생용 공유 시트로 전달한다. */
    private fun shareStudentQuiz(quiz: LocalQuickQuiz) {
        if (quiz.questionReviewStatuses.none { it == "승인" }) { status.text = "학생용으로 공유할 승인 문항이 없습니다. 문항별 검수에서 먼저 승인해 주세요."; return }
        val studentText = studentShareText(quiz)
        if (studentText == null) { status.text = "학생용으로 분리할 문항 형식을 찾지 못했습니다. 교사용 내용을 확인해 주세요."; return }
        startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, "${quiz.subject} · 쪽지시험"); putExtra(Intent.EXTRA_TEXT, "${quiz.subject} · ${quiz.unit} · ${QuickQuizFormPolicy.questionFormatLabel(quiz.questionFormat)}\n이름: ____________________    날짜: __________\n\n$studentText") }, "학생용 쪽지시험 공유"))
    }

    /** 정답·해설을 읽은 교사가 각 문항을 독립적으로 승인·수정 필요·반려한다. */
    private fun showQuizDetail(quiz: LocalQuickQuiz) {
        val density = resources.displayMetrics.density
        fun localDp(value: Int) = (value * density).toInt()
        var reviewDialog: AlertDialog? = null
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(localDp(18), localDp(8), localDp(18), localDp(18)) }
        content.addView(TextView(this).apply { text = "${quiz.topic} · ${store.quickQuizReviewSummary(quiz)}"; textSize = 18f; setTextColor(Color.rgb(24, 50, 72)); setTypeface(typeface, android.graphics.Typeface.BOLD); setPadding(0, 0, 0, localDp(8)) })
        quickQuizBlocks(quiz.content).forEachIndexed { index, block ->
            val item = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(localDp(12), localDp(12), localDp(12), localDp(10)); background = surface(Color.rgb(238, 247, 242), localDp(14)) }
            val current = quiz.questionReviewStatuses.getOrElse(index) { "검수 대기" }
            item.addView(TextView(this).apply { text = "${index + 1}번 · $current"; textSize = 14f; setTextColor(Color.rgb(21, 133, 107)); setTypeface(typeface, android.graphics.Typeface.BOLD) })
            item.addView(TextView(this).apply { text = readableQuickQuizText(block); textSize = 14f; setTextColor(Color.rgb(29, 47, 42)); setPadding(0, localDp(6), 0, localDp(8)) })
            val actions = LinearLayout(this).apply {
                addView(button("승인").apply { setOnClickListener { updateQuestionReviewAndReopen(quiz.id, index, "승인", reviewDialog) } }, LinearLayout.LayoutParams(0, localDp(38), 1f))
                addView(button("수정 필요").apply { setOnClickListener { updateQuestionReviewAndReopen(quiz.id, index, "수정 필요", reviewDialog) } }, LinearLayout.LayoutParams(0, localDp(38), 1f).apply { leftMargin = localDp(6) })
                addView(button("반려").apply { setOnClickListener { updateQuestionReviewAndReopen(quiz.id, index, "반려", reviewDialog) } }, LinearLayout.LayoutParams(0, localDp(38), 1f).apply { leftMargin = localDp(6) })
            }
            item.addView(actions)
            content.addView(item, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = localDp(10) })
        }
        reviewDialog = AlertDialog.Builder(this).setView(ScrollView(this).apply { addView(content) }).setNegativeButton("닫기", null).create()
        reviewDialog?.show()
    }

    /** 한 문항의 상태만 바꾸고 최신 저장값으로 상세 창을 다시 열어 즉시 결과를 확인하게 한다. */
    private fun updateQuestionReviewAndReopen(quizId: String, questionIndex: Int, review: String, dialog: AlertDialog?) {
        store.updateQuickQuizQuestionReviewStatus(quizId, questionIndex, review)
        refreshList()
        dialog?.dismiss()
        val updated = store.quickQuizzes().firstOrNull { it.id == quizId }
        if (updated != null) showQuizDetail(updated)
    }

    /** 생성 결과에서 각 문항 시작을 찾아 문항별 상태 배열의 순서와 연결한다. */
    private fun quickQuizBlocks(value: String): List<String> = value.split(Regex("(?m)(?=^\\s*문항\\s*[:：])")).map { it.trim() }.filter { it.matches(Regex("(?s)^문항\\s*[:：].*")) }
    /** 생성 순서를 확인할 수 있도록 현재 기기 시간대를 적용한 짧은 생성 시각을 표시한다. */
    private fun quickQuizCreatedAtLabel(value: Long): String = android.text.format.DateFormat.format("M월 d일 HH:mm", value).toString()
    /** 이전 세트의 ‘③ 6’ 같은 숫자 보기를 ‘선택 ③: 6’으로 읽어 선택 번호와 값의 혼동을 막는다. */
    private fun readableQuickQuizText(value: String): String = value.replace(Regex("(?m)^(\\s*)선택\\s*([①②③④])\\s*:\\s*(?:선택\\s*)?\\2\\s*:\\s*"), "$1$2 ").replace(Regex("(?m)^(\\s*)선택\\s*([①②③④])\\s*:\\s*"), "$1$2 ").replace(Regex("(?m)^(정답\\s*[:：]\\s*)선택\\s*([①②③④])\\s*$"), "$1$2번")
    private fun fieldLabel(label: String) = TextView(this).apply { text = label; textSize = 13.5f; setTextColor(Color.rgb(194, 211, 195)); setPadding(dp(4), dp(2), dp(4), dp(5)) }
    private fun field(label: String, value: String) = EditText(this).apply { hint = label; setText(value); setTextColor(Color.WHITE); setHintTextColor(Color.rgb(145, 165, 151)); background = surface(Color.rgb(15, 29, 25), (resources.displayMetrics.density * 16).toInt()); setPadding((resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt(), (resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt()) }
    private fun select(values: List<String>) = Spinner(this).apply { adapter = ArrayAdapter(this@QuickQuizActivity, android.R.layout.simple_spinner_dropdown_item, values); background = surface(Color.rgb(15, 29, 25), (resources.displayMetrics.density * 16).toInt()); setPadding((resources.displayMetrics.density * 12).toInt(), 0, (resources.displayMetrics.density * 12).toInt(), 0) }
    private fun button(label: String, accent: Boolean = false) = Button(this).apply { text = label; isAllCaps = false; textSize = 14f; setTextColor(if (accent) Color.rgb(20, 28, 23) else Color.rgb(232, 239, 231)); background = surface(if (accent) Color.rgb(216, 191, 140) else Color.rgb(32, 54, 47), (resources.displayMetrics.density * 15).toInt()) }
    private fun surface(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat(); setStroke((resources.displayMetrics.density).toInt(), Color.rgb(51, 75, 67)) }
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
