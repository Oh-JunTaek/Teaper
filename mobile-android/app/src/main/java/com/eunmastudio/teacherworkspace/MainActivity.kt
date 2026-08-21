package com.eunmastudio.teacherworkspace

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.eunmastudio.teacherworkspace.ai.DeviceProfile
import com.eunmastudio.teacherworkspace.ai.GemmaModel
import com.eunmastudio.teacherworkspace.ai.LiteRtLmRunner
import com.eunmastudio.teacherworkspace.ai.ModelDownloadManager
import com.eunmastudio.teacherworkspace.ai.QuestionPromptContract
import com.eunmastudio.teacherworkspace.ai.eligibility
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 초기 Android 파일럿 화면이다. 모델은 E2B·E4B만 보여 주며 E2B가 기본값이다.
 * 이후 웹의 자료·기출·생성·검수 도메인 화면을 이 앱에 단계적으로 연결한다.
 */
class MainActivity : ComponentActivity() {
    private lateinit var status: TextView
    private lateinit var progress: ProgressBar
    private lateinit var e2bButton: Button
    private lateinit var e4bButton: Button
    private lateinit var promptInput: EditText
    private lateinit var runButton: Button
    private lateinit var result: TextView
    private lateinit var downloads: ModelDownloadManager
    private lateinit var runner: LiteRtLmRunner
    private lateinit var store: LocalWorkspaceStore
    private lateinit var workspaceSummary: TextView
    private var activeModel: GemmaModel? = null
    private var selectedSourceKind: LocalSourceKind = LocalSourceKind.REFERENCE

    private val chooseSourceFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@registerForActivityResult
        contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        showAddSourceDialog(selectedSourceKind, uri.toString())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        downloads = ModelDownloadManager(this)
        runner = LiteRtLmRunner(this)
        store = LocalWorkspaceStore(this)
        setContentView(buildScreen())
        refreshDeviceState()
    }

    override fun onDestroy() {
        runner.close()
        super.onDestroy()
    }

    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(28))
            setBackgroundColor(Color.WHITE)
        }
        fun text(value: String, size: Float = 16f) = TextView(this).apply {
            this.text = value
            textSize = size
            setTextColor(Color.rgb(26, 43, 60))
            setPadding(0, dp(6), 0, dp(6))
        }

        content.addView(text("문제 출제 워크스페이스", 26f))
        content.addView(text("Android 로컬 AI 파일럿 · EunmaStudio", 14f))
        content.addView(text("모델과 자료는 이 기기에서 처리합니다. 초기 파일럿에서는 Gemma 4 E2B·E4B만 사용할 수 있습니다.", 15f))
        status = text("기기 상태를 확인하고 있습니다.", 15f)
        content.addView(status)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = false
            max = 100
            visibility = android.view.View.GONE
        }
        content.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(8)))
        e2bButton = Button(this).apply { text = "기본 모델 Gemma 4 E2B 준비" }
        e4bButton = Button(this).apply { text = "고성능 기기용 Gemma 4 E4B 확인" }
        content.addView(e2bButton)
        content.addView(e4bButton)
        content.addView(text("E4B는 고성능 기기에서만 권장됩니다. 기기 메모리·저장 공간·발열 상태가 좋지 않으면 E2B를 사용하세요.", 14f))
        content.addView(Button(this).apply {
            text = "Gemma 모델 라이선스·NOTICE"
            setOnClickListener { showModelLicenseDialog() }
        })

        content.addView(text("교사 작업", 20f))
        workspaceSummary = text("로컬 자료와 문항을 확인하고 있습니다.", 15f)
        content.addView(workspaceSummary)
        content.addView(Button(this).apply {
            text = "1. 자료 준비"
            setOnClickListener { showSourcesDialog() }
        })
        content.addView(Button(this).apply {
            text = "2. 문항 생성"
            setOnClickListener { showGenerationDialog() }
        })
        content.addView(Button(this).apply {
            text = "3. 검수함"
            setOnClickListener { showReviewDialog() }
        })
        content.addView(Button(this).apply {
            text = "교사 추가 작성 선호"
            setOnClickListener { showTeacherInstructionsDialog() }
        })

        promptInput = EditText(this).apply {
            hint = "빠른 로컬 요청: 자료 정리 또는 검수 질문"
            minLines = 3
            gravity = Gravity.TOP
        }
        content.addView(promptInput, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(150)))
        runButton = Button(this).apply {
            text = "로컬 모델로 실행"
            isEnabled = false
        }
        content.addView(runButton)
        result = text("결과는 이 기기에서만 표시됩니다.", 15f)
        content.addView(result)

        e2bButton.setOnClickListener { installOrPrepare(GemmaModel.E2B) }
        e4bButton.setOnClickListener { installOrPrepare(GemmaModel.E4B) }
        runButton.setOnClickListener { runPrompt() }
        refreshWorkspaceSummary()
        return ScrollView(this).apply { addView(content) }
    }

    private fun refreshDeviceState() {
        val profile = DeviceProfile.read(this)
        val e2b = GemmaModel.E2B.eligibility(profile)
        val e4b = GemmaModel.E4B.eligibility(profile)
        status.text = "기기 확인: 저장 공간 ${(profile.freeStorageBytes / 1_000_000_000)}GB 여유. E2B: ${e2b.message}"
        e2bButton.isEnabled = e2b.canInstall
        e4bButton.isEnabled = e4b.canInstall
        if (!e4b.isRecommended) {
            e4bButton.text = "Gemma 4 E4B는 현재 기기에서 권장하지 않음"
        }
    }

    private fun installOrPrepare(model: GemmaModel) {
        val eligibility = model.eligibility(DeviceProfile.read(this))
        if (!eligibility.canInstall) {
            status.text = eligibility.message
            return
        }
        if (!downloads.isInstalled(model)) {
            AlertDialog.Builder(this)
                .setTitle("${model.displayName} 내려받기")
                .setMessage(
                    "이 모델은 약 ${(model.byteSize / 1_000_000_000.0).let { "%.2f".format(it) }}GB입니다. " +
                        "Wi‑Fi와 전원을 권장합니다.\n\n" +
                        "Gemma 4는 Apache License 2.0으로 제공됩니다. 모델 파일은 이 앱 전용 저장소에 보관하며, " +
                        "다운로드 뒤 SHA-256 무결성 확인에 통과해야만 사용할 수 있습니다.\n\n" +
                        "${if (model == GemmaModel.E4B) "E4B는 발열과 배터리 사용량이 커질 수 있습니다. " else ""}" +
                        "교사는 생성·검수 결과를 최종 확인해야 합니다.",
                )
                .setNegativeButton("취소", null)
                .setPositiveButton("동의하고 준비") { _, _ -> prepareModel(model) }
                .show()
        } else {
            prepareModel(model)
        }
    }

    private fun prepareModel(model: GemmaModel) {
        lifecycleScope.launch {
            try {
                progress.visibility = android.view.View.VISIBLE
                if (!downloads.isInstalled(model)) {
                    status.text = "${model.displayName}을 내려받는 중입니다. Wi‑Fi와 전원을 권장합니다."
                    downloads.download(model) { update ->
                        runOnUiThread {
                            progress.progress = ((update.receivedBytes * 100) / update.totalBytes).toInt()
                        }
                    }
                }
                status.text = "${model.displayName}을 준비하는 중입니다. 처음에는 시간이 걸릴 수 있습니다."
                val executionMode = runner.initialize(downloads.installedFile(model).absolutePath)
                activeModel = model
                status.text = "${model.displayName} 준비 완료. $executionMode"
                runButton.isEnabled = true
            } catch (error: Throwable) {
                status.text = error.message ?: "모델 준비에 실패했습니다."
            } finally {
                progress.visibility = android.view.View.GONE
            }
        }
    }

    private fun showModelLicenseDialog() {
        val notice = assets.open("NOTICE-GEMMA-4.txt").bufferedReader().use { it.readText() }
        val license = assets.open("LICENSE-APACHE-2.0.txt").bufferedReader().use { it.readText() }
        AlertDialog.Builder(this)
            .setTitle("Gemma 4 라이선스·NOTICE")
            .setMessage("$notice\n\n$license")
            .setPositiveButton("확인", null)
            .show()
    }

    private fun refreshWorkspaceSummary() {
        if (!::workspaceSummary.isInitialized) return
        val sources = store.sources()
        val questions = store.questions()
        workspaceSummary.text = "등록 자료 ${sources.size}건 · 문항 ${questions.size}건 · " +
            "승인 ${questions.count { it.reviewStatus == "승인" }}건\n" +
            "자료·문항은 앱 전용 저장소에 보관되고 자동 백업하지 않습니다."
    }

    private fun showSourcesDialog() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(42, 20, 42, 20)
        }
        LocalSourceKind.entries.forEach { kind ->
            container.addView(Button(this).apply {
                text = "${kind.label} 추가"
                setOnClickListener { showAddSourceDialog(kind, null) }
            })
            container.addView(Button(this).apply {
                text = "파일에서 ${kind.label} 추가"
                setOnClickListener {
                    selectedSourceKind = kind
                    chooseSourceFile.launch(arrayOf("application/pdf", "text/plain", "image/*"))
                }
            })
        }
        val existing = store.sources()
        if (existing.isEmpty()) {
            container.addView(TextView(this).apply { text = "아직 등록한 자료가 없습니다. 교육과정·참고 자료·기출 유형을 먼저 정리해 주세요." })
        } else {
            container.addView(TextView(this).apply { text = "등록한 자료" })
            existing.forEach { source ->
                container.addView(Button(this).apply {
                    text = "${source.kind.label} · ${source.title}\n${source.excerpt.take(70)}"
                    isAllCaps = false
                    setOnClickListener { showSourceDetailDialog(source) }
                })
            }
        }
        AlertDialog.Builder(this)
            .setTitle("자료 준비")
            .setView(ScrollView(this).apply { addView(container) })
            .setNegativeButton("닫기", null)
            .show()
    }

    private fun showAddSourceDialog(kind: LocalSourceKind, sourceUri: String?) {
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(42, 20, 42, 8)
        }
        val title = EditText(this).apply { hint = "자료 이름 또는 출처" }
        val excerpt = EditText(this).apply {
            hint = "문항 생성에 사용할 핵심 내용·쪽수·평가 요소를 적어 주세요"
            minLines = 5
            gravity = Gravity.TOP
        }
        form.addView(title)
        form.addView(excerpt)
        if (sourceUri != null) {
            form.addView(TextView(this).apply { text = "선택한 파일: ${sourceUri.substringAfterLast('/')}\n파일은 원본 위치로만 보관하며, 핵심 내용을 직접 확인해 입력해 주세요." })
        }
        AlertDialog.Builder(this)
            .setTitle("${kind.label} 등록")
            .setView(form)
            .setNegativeButton("취소", null)
            .setPositiveButton("로컬에 저장") { _, _ ->
                val normalizedTitle = title.text.toString().trim().ifBlank { "이름 없는 ${kind.label}" }
                val normalizedExcerpt = excerpt.text.toString().trim()
                if (normalizedExcerpt.isBlank()) {
                    status.text = "자료의 핵심 내용·쪽수·평가 요소를 입력한 뒤 저장해 주세요."
                    return@setPositiveButton
                }
                store.saveSource(LocalSource(title = normalizedTitle, kind = kind, excerpt = normalizedExcerpt, sourceUri = sourceUri))
                refreshWorkspaceSummary()
                status.text = "${kind.label}을 이 기기에 저장했습니다."
            }
            .show()
    }

    private fun showSourceDetailDialog(source: LocalSource) {
        AlertDialog.Builder(this)
            .setTitle(source.title)
            .setMessage("분류: ${source.kind.label}\n\n${source.excerpt}\n\n원본 위치: ${source.sourceUri ?: "직접 입력"}")
            .setNegativeButton("닫기", null)
            .setPositiveButton("삭제") { _, _ ->
                store.deleteSource(source.id)
                refreshWorkspaceSummary()
                status.text = "자료를 이 기기에서 삭제했습니다."
            }
            .show()
    }

    private fun showGenerationDialog() {
        if (activeModel == null) {
            status.text = "먼저 기본 모델 E2B를 준비해 주세요."
            return
        }
        val request = EditText(this).apply {
            hint = "예: 고등 화학 I, 화학 결합 단원, 5지선다 1문항, 중 난이도"
            minLines = 4
            gravity = Gravity.TOP
        }
        AlertDialog.Builder(this)
            .setTitle("문항 생성")
            .setMessage("등록한 자료를 근거로 문항을 생성합니다. 결과는 반드시 교사가 검수해야 합니다.")
            .setView(request)
            .setNegativeButton("취소", null)
            .setPositiveButton("로컬 모델로 생성") { _, _ ->
                val requestText = request.text.toString().trim()
                if (requestText.isBlank()) {
                    status.text = "문항 생성 요청을 입력해 주세요."
                } else {
                    generateQuestion(requestText)
                }
            }
            .show()
    }

    private fun generateQuestion(request: String) {
        val sources = store.sources()
        val sourceText = sources.joinToString("\n\n") { source ->
            "[${source.kind.label}] ${source.title}\n${source.excerpt}"
        }
        lifecycleScope.launch {
            try {
                runButton.isEnabled = false
                result.text = "자료 확인 후 문항을 생성하고 있습니다."
                val response = StringBuilder()
                runner.generate(QuestionPromptContract.generationPrompt(request, sourceText, store.teacherInstructions())) { partial ->
                    response.append(partial)
                    runOnUiThread { result.text = response.toString() }
                }
                store.saveQuestion(
                    LocalQuestion(
                        title = "문항 ${SimpleDateFormat("MM-dd HH:mm", Locale.KOREA).format(Date())}",
                        content = response.toString(),
                        sourceIds = sources.map { it.id },
                    ),
                )
                refreshWorkspaceSummary()
                status.text = "문항을 검수함에 저장했습니다."
            } catch (error: Throwable) {
                result.text = error.message ?: "문항 생성에 실패했습니다."
            } finally {
                runButton.isEnabled = activeModel != null
            }
        }
    }

    private fun showReviewDialog() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(42, 20, 42, 20)
        }
        val questions = store.questions()
        if (questions.isEmpty()) {
            container.addView(TextView(this).apply { text = "검수할 문항이 없습니다. 자료를 준비한 뒤 문항을 생성해 주세요." })
        } else {
            questions.sortedByDescending { it.createdAt }.forEach { question ->
                container.addView(Button(this).apply {
                    text = "[${question.reviewStatus}] ${question.title}\n${question.content.take(90)}"
                    isAllCaps = false
                    setOnClickListener { showQuestionDetailDialog(question) }
                })
            }
        }
        AlertDialog.Builder(this)
            .setTitle("검수함")
            .setView(ScrollView(this).apply { addView(container) })
            .setNegativeButton("닫기", null)
            .show()
    }

    private fun showQuestionDetailDialog(question: LocalQuestion) {
        AlertDialog.Builder(this)
            .setTitle("${question.title} · ${question.reviewStatus}")
            .setMessage(question.content)
            .setNegativeButton("닫기", null)
            .setNeutralButton("공유") { _, _ -> shareQuestion(question) }
            .setPositiveButton("교사 검수") { _, _ -> runLocalReview(question) }
            .show()
    }

    private fun runLocalReview(question: LocalQuestion) {
        if (activeModel == null) {
            status.text = "자동 검수를 사용하려면 먼저 모델을 준비해 주세요. 교사는 원문을 직접 검수할 수 있습니다."
            return
        }
        val sourceText = store.sources().filter { it.id in question.sourceIds }.joinToString("\n\n") { source ->
            "[${source.kind.label}] ${source.title}\n${source.excerpt}"
        }
        lifecycleScope.launch {
            try {
                result.text = "근거와 문항을 대조하는 중입니다."
                val response = StringBuilder()
                runner.generate(QuestionPromptContract.reviewPrompt(question.content, sourceText)) { partial ->
                    response.append(partial)
                    runOnUiThread { result.text = response.toString() }
                }
                store.updateReviewStatus(question.id, "교사 확인 필요")
                refreshWorkspaceSummary()
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("자동 검수 결과")
                    .setMessage(response.toString())
                    .setNegativeButton("보류") { _, _ ->
                        store.updateReviewStatus(question.id, "보류")
                        refreshWorkspaceSummary()
                    }
                    .setPositiveButton("교사 검수 후 승인") { _, _ ->
                        store.updateReviewStatus(question.id, "승인")
                        refreshWorkspaceSummary()
                        status.text = "승인 문항으로 표시했습니다. 시험지 사용 전 교사의 최종 확인이 필요합니다."
                    }
                    .show()
            } catch (error: Throwable) {
                status.text = error.message ?: "자동 검수에 실패했습니다."
            }
        }
    }

    private fun showTeacherInstructionsDialog() {
        val input = EditText(this).apply {
            setText(store.teacherInstructions())
            hint = "예: 표 중심 문항을 선호함. 단, 공통 안전 기준을 덮어쓰지 않습니다."
            minLines = 5
            gravity = Gravity.TOP
        }
        AlertDialog.Builder(this)
            .setTitle("교사 추가 작성 선호")
            .setMessage("표현·구성의 개인 선호를 적을 수 있습니다. 근거 사용·비복제·교사 검수 원칙과 충돌하면 공통 원칙이 우선합니다.")
            .setView(input)
            .setNegativeButton("취소", null)
            .setPositiveButton("로컬에 저장") { _, _ ->
                store.saveTeacherInstructions(input.text.toString())
                status.text = "교사 추가 작성 선호를 이 기기에 저장했습니다."
            }
            .show()
    }

    private fun shareQuestion(question: LocalQuestion) {
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, question.title)
            putExtra(Intent.EXTRA_TEXT, "${question.title}\n검수 상태: ${question.reviewStatus}\n\n${question.content}\n\nEunmaStudio 문제 출제 워크스페이스에서 생성된 검수용 문항입니다. 교사 최종 확인이 필요합니다.")
        }
        startActivity(Intent.createChooser(shareIntent, "검수용 문항 공유"))
    }

    private fun runPrompt() {
        val prompt = promptInput.text?.toString()?.trim().orEmpty()
        if (prompt.isEmpty()) {
            result.text = "요청을 입력해 주세요."
            return
        }
        lifecycleScope.launch {
            try {
                runButton.isEnabled = false
                result.text = "${activeModel?.displayName ?: "모델"}이 이 기기에서 응답을 만드는 중입니다."
                val response = StringBuilder()
                runner.generate(
                    """당신은 교사의 출제 검수를 돕는 보조 도구입니다.
                    문항의 정답을 보증하지 말고, 자료 확인과 교사 최종 검수를 권고하세요.
                    외부 웹사이트·개인 API·기기 밖의 자료에 접근하지 마세요.
                    요청: $prompt""".trimIndent(),
                ) { partial ->
                    response.append(partial)
                    runOnUiThread { result.text = response.toString() }
                }
            } catch (error: Throwable) {
                result.text = error.message ?: "로컬 실행에 실패했습니다."
            } finally {
                runButton.isEnabled = true
            }
        }
    }
}
