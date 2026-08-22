package com.eunmastudio.teacherworkspace

import android.app.AlertDialog
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.eunmastudio.teacherworkspace.ai.DeviceProfile
import com.eunmastudio.teacherworkspace.ai.DownloadStage
import com.eunmastudio.teacherworkspace.ai.GemmaModel
import com.eunmastudio.teacherworkspace.ai.LiteRtLmRunner
import com.eunmastudio.teacherworkspace.ai.ModelDownloadManager
import com.eunmastudio.teacherworkspace.ai.ModelDownloadService
import com.eunmastudio.teacherworkspace.ai.ModelDownloadSession
import com.eunmastudio.teacherworkspace.ai.ModelDownloadUiStage
import com.eunmastudio.teacherworkspace.ai.ModelDownloadUiState
import com.eunmastudio.teacherworkspace.ai.ModelSelection
import com.eunmastudio.teacherworkspace.ai.QuestionPromptContract
import com.eunmastudio.teacherworkspace.ai.eligibility
import com.eunmastudio.teacherworkspace.export.ApprovedQuestionExporter
import com.eunmastudio.teacherworkspace.export.QuestionExportType
import com.eunmastudio.teacherworkspace.source.SourceContentExtractor
import com.eunmastudio.teacherworkspace.source.SourceExtraction
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 초기 Android 파일럿 화면이다. 모델은 E2B·E4B만 보여 주며 E2B가 기본값이다.
 * 이후 웹의 자료·기출·생성·검수 도메인 화면을 이 앱에 단계적으로 연결한다.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var status: TextView
    private lateinit var progress: ProgressBar
    private lateinit var downloadDetail: TextView
    private lateinit var promptInput: EditText
    private lateinit var runButton: Button
    private lateinit var result: TextView
    private lateinit var downloads: ModelDownloadManager
    private lateinit var runner: LiteRtLmRunner
    private lateinit var questionExporter: ApprovedQuestionExporter
    private lateinit var sourceExtractor: SourceContentExtractor
    private lateinit var store: LocalWorkspaceStore
    private lateinit var workspaceSummary: TextView
    private lateinit var appLockGate: AppLockGate
    private lateinit var overflowButton: Button
    private var activeModel: GemmaModel? = null
    private var selectedSourceKind: LocalSourceKind = LocalSourceKind.REFERENCE
    private var notificationPermissionModel: GemmaModel? = null

    private data class WorkCardItem(
        val id: String,
        val title: String,
        val subtitle: String,
        val iconRes: Int,
        val color: Int,
        val action: () -> Unit,
    )

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val model = notificationPermissionModel
        notificationPermissionModel = null
        if (granted && model != null) {
            ModelDownloadService.start(this, model)
        } else {
            status.text = "백그라운드 다운로드 진행 상태를 알림으로 보여 주려면 알림 허용이 필요합니다."
        }
    }

    private val chooseSourceFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@registerForActivityResult
        contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        lifecycleScope.launch {
            status.text = "선택한 자료의 내용을 이 기기에서 읽는 중입니다."
            val extracted = runCatching { sourceExtractor.extract(uri) }
                .getOrElse {
                    SourceExtraction(
                        suggestedTitle = "선택한 자료",
                        suggestedExcerpt = "자료 내용을 자동으로 읽지 못했습니다. 핵심 내용·쪽수·평가 요소를 직접 입력해 주세요.",
                        extractionNotice = it.message,
                    )
                }
            showAddSourceDialog(selectedSourceKind, uri.toString(), extracted)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        downloads = ModelDownloadManager(this)
        runner = LiteRtLmRunner(this)
        questionExporter = ApprovedQuestionExporter(this)
        sourceExtractor = SourceContentExtractor(this)
        store = LocalWorkspaceStore(this)
        ModelDownloadSession.restore(this)
        val screen = buildScreen()
        appLockGate = AppLockGate(this)
        setContentView(appLockGate.attach(screen))
        applySystemInsets(screen)
        refreshDeviceState()
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                ModelDownloadSession.state.collect { state -> renderDownloadState(state) }
            }
        }
    }

    private fun configureSystemBars() {
        val surface = Color.rgb(14, 16, 21)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = surface
        window.navigationBarColor = surface
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
    }

    /** 카드 목록 마지막 항목이 제스처·버튼 내비게이션 바 아래로 들어가지 않도록 ScrollView 여백을 적용한다. */
    private fun applySystemInsets(screen: ScrollView) {
        ViewCompat.setOnApplyWindowInsetsListener(screen) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
        screen.clipToPadding = false
        ViewCompat.requestApplyInsets(screen)
    }

    override fun onDestroy() {
        runner.close()
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired()
        if (::status.isInitialized) refreshDeviceState()
        if (::workspaceSummary.isInitialized) refreshWorkspaceSummary()
    }

    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(30))
            setBackgroundColor(Color.rgb(14, 16, 21))
        }
        fun text(value: String, size: Float = 16f, color: Int = Color.WHITE) = TextView(this).apply {
            this.text = value
            textSize = size
            setTextColor(color)
            setPadding(0, dp(6), 0, dp(6))
        }

        content.addView(LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(text("문제 출제 워크스페이스", 18f, Color.rgb(236, 240, 248)).apply {
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            overflowButton = Button(this@MainActivity).apply {
                text = "☰"; textSize = 22f; isAllCaps = false; setTextColor(Color.WHITE)
                contentDescription = "설정 메뉴 열기"
                background = roundedSurface(Color.rgb(29, 33, 42), dp(16))
                setOnClickListener { showOverflowMenu() }
            }
            addView(overflowButton, LinearLayout.LayoutParams(dp(52), dp(44)))
        })
        content.addView(text("자료를 준비하고, 문항을 만들고, 교사가 검수합니다.", 15f, Color.rgb(174, 187, 208)).apply {
            setPadding(0, dp(4), 0, dp(22))
        })

        content.addView(text("오늘의 작업", 21f).apply { setPadding(0, dp(2), 0, dp(6)) })
        workspaceSummary = text("로컬 자료와 문항을 확인하고 있습니다.", 15f, Color.rgb(191, 200, 215))
        content.addView(workspaceSummary)
        val workItems = listOf(
            WorkCardItem("chat", "온디바이스 AI 채팅", "질문·자료 정리·수업 아이디어", R.drawable.ic_workspace_chat, Color.rgb(75, 126, 235)) {
                startActivity(Intent(this@MainActivity, TeacherChatActivity::class.java))
            },
            WorkCardItem("source", "자료 준비", "참고 자료·기출 유형·공식 자료", R.drawable.ic_workspace_sources, Color.rgb(65, 174, 152)) { showSourcesDialog() },
            WorkCardItem("generate", "문항 생성", "선택한 자료로 문항 만들기", R.drawable.ic_workspace_generate, Color.rgb(118, 156, 244)) { showGenerationDialog() },
            WorkCardItem("review", "검수함", "근거 대조·승인 문항 내보내기", R.drawable.ic_workspace_review, Color.rgb(238, 177, 77)) { showReviewDialog() },
            WorkCardItem("model", "모델 관리", "Gemma 4 E2B 상태·설치·라이선스", R.drawable.ic_workspace_model, Color.rgb(151, 112, 230)) {
                startActivity(Intent(this@MainActivity, ModelManagerActivity::class.java))
            },
        )
        if (store.homeCardLayout() == HomeCardLayout.ALBUM) {
            content.addView(albumCardGrid(workItems))
        } else {
            workItems.forEach { item -> content.addView(workCard(item)) }
        }
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = false
            max = 100
            visibility = View.GONE
        }
        content.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(8)).apply { topMargin = dp(6) })
        downloadDetail = text("", 14f, Color.rgb(191, 200, 215)).apply { visibility = View.GONE }
        content.addView(downloadDetail)
        promptInput = EditText(this).apply { visibility = View.GONE }
        runButton = Button(this).apply { visibility = View.GONE }
        result = text("", 14f, Color.rgb(191, 200, 215)).apply { visibility = View.GONE }
        content.addView(result)
        content.addView(text("© 2026 EunmaStudio. All rights reserved.", 11f, Color.rgb(111, 124, 145)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(28), 0, dp(6))
        })
        refreshWorkspaceSummary()
        return ScrollView(this).apply { addView(content) }
    }

    private fun workCard(item: WorkCardItem): LinearLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(16))
            background = roundedSurface(Color.rgb(28, 34, 45), dp(22))
            setOnClickListener { item.action() }
            minimumHeight = dp(100)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) }
            addView(ImageView(this@MainActivity).apply {
                scaleType = ImageView.ScaleType.CENTER
                setImageResource(item.iconRes)
                setColorFilter(Color.WHITE)
                background = roundedSurface(item.color, dp(18))
            }, LinearLayout.LayoutParams(dp(52), dp(52)).apply { rightMargin = dp(16) })
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@MainActivity).apply { text = item.title; textSize = 20f; setTextColor(Color.WHITE); maxLines = 2 })
                addView(TextView(this@MainActivity).apply {
                    text = item.subtitle; textSize = 14f; setTextColor(Color.rgb(185, 195, 209)); maxLines = 3; setPadding(0, dp(3), 0, 0)
                    if (item.id == "model") status = this
                })
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(TextView(this@MainActivity).apply { text = "›"; textSize = 28f; setTextColor(Color.rgb(159, 171, 191)) })
        }
    }

    /** 기본 앨범형 보기: 자주 쓰는 교사 작업을 두 칸씩 묶어 시선 이동을 줄인다. */
    private fun albumCardGrid(items: List<WorkCardItem>): LinearLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            items.chunked(2).forEach { rowItems ->
                addView(LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    rowItems.forEachIndexed { index, item ->
                        addView(albumCard(item), LinearLayout.LayoutParams(0, dp(166), 1f).apply {
                            if (index == 0 && rowItems.size == 2) rightMargin = dp(10)
                        })
                    }
                    if (rowItems.size == 1) addView(View(this@MainActivity), LinearLayout.LayoutParams(0, dp(166), 1f))
                }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(166)).apply { bottomMargin = dp(10) })
            }
        }
    }

    private fun albumCard(item: WorkCardItem): LinearLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(12))
            background = roundedSurface(Color.rgb(28, 34, 45), dp(22))
            setOnClickListener { item.action() }
            addView(ImageView(this@MainActivity).apply {
                scaleType = ImageView.ScaleType.CENTER
                setImageResource(item.iconRes)
                setColorFilter(Color.WHITE)
                background = roundedSurface(item.color, dp(16))
            }, LinearLayout.LayoutParams(dp(46), dp(46)))
            addView(TextView(this@MainActivity).apply {
                text = item.title; textSize = 17f; setTextColor(Color.WHITE); maxLines = 2; setPadding(0, dp(10), 0, 0)
            })
            addView(TextView(this@MainActivity).apply {
                text = item.subtitle; textSize = 12.5f; setTextColor(Color.rgb(185, 195, 209)); maxLines = 2; setPadding(0, dp(4), 0, 0)
                if (item.id == "model") status = this
            })
        }
    }

    private fun roundedSurface(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat() }

    /** 모델·자료 작업과 분리된 앱 수준 설정을 우측 상단 메뉴로 모은다. */
    private fun showOverflowMenu() {
        PopupMenu(this, overflowButton).apply {
            menu.add("설정")
            menu.add("Gemma 라이선스·NOTICE")
            setOnMenuItemClickListener { item ->
                when (item.title.toString()) {
                    "설정" -> showTeacherInstructionsDialog()
                    "Gemma 라이선스·NOTICE" -> showModelLicenseDialog()
                }
                true
            }
            show()
        }
    }

    private fun refreshDeviceState() {
        val profile = DeviceProfile.read(this)
        val e2b = GemmaModel.E2B.eligibility(profile)
        val selected = ModelSelection.selected(this)
        val modelState = when {
            ModelDownloadSession.state.value.isRunning -> "${ModelDownloadSession.state.value.model?.displayName ?: "모델"} 다운로드 진행 중"
            selected != null && downloads.isInstalled(selected) -> "${selected.displayName} 선택됨"
            downloads.isInstalled(GemmaModel.E2B) -> "Gemma 4 E2B 준비됨"
            else -> "기본 모델 E2B를 준비해 주세요"
        }
        status.text = "$modelState\n저장 공간 ${(profile.freeStorageBytes / 1_000_000_000)}GB 여유"
    }

    private fun installOrPrepare(model: GemmaModel) {
        val existingDownload = ModelDownloadSession.state.value
        if (existingDownload.isRunning) {
            status.text = "${existingDownload.model?.displayName ?: "모델"} 다운로드가 진행 중입니다. 상단 진행 상태 또는 알림에서 확인해 주세요."
            return
        }
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
                .setPositiveButton("동의하고 다운로드") { _, _ -> requestBackgroundDownload(model) }
                .show()
        } else {
            prepareInstalledModel(model)
        }
    }

    private fun requestBackgroundDownload(model: GemmaModel) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionModel = model
            AlertDialog.Builder(this)
                .setTitle("다운로드 진행 알림")
                .setMessage("약 ${(model.byteSize / 1_000_000_000.0).let { "%.2f".format(it) }}GB 모델을 받는 동안 화면을 닫아도 계속하려면 진행 알림이 필요합니다.")
                .setNegativeButton("취소", null)
                .setPositiveButton("알림 허용") { _, _ -> notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS) }
                .show()
        } else {
            ModelDownloadService.start(this, model)
        }
    }

    private fun prepareInstalledModel(model: GemmaModel, afterReady: (() -> Unit)? = null) {
        lifecycleScope.launch {
            try {
                status.text = "${model.displayName}을 준비하는 중입니다. 처음에는 시간이 걸릴 수 있습니다."
                val executionMode = runner.initialize(downloads.installedFile(model).absolutePath)
                activeModel = model
                status.text = "${model.displayName} 준비 완료. $executionMode"
                afterReady?.invoke()
            } catch (error: Throwable) {
                status.text = error.message ?: "모델 준비에 실패했습니다."
            } finally {
                refreshDeviceState()
            }
        }
    }

    private fun renderDownloadState(state: ModelDownloadUiState) {
        if (!::downloadDetail.isInitialized) return
        if (!state.isRunning) {
            progress.visibility = android.view.View.GONE
            downloadDetail.visibility = android.view.View.GONE
            if (state.stage == ModelDownloadUiStage.COMPLETED) {
                status.text = state.message.orEmpty()
            } else if (state.stage == ModelDownloadUiStage.FAILED) {
                status.text = "${state.message.orEmpty()} 다시 누르면 부분 파일부터 이어받기를 시도합니다."
            }
            refreshDeviceState()
            return
        }
        progress.visibility = android.view.View.VISIBLE
        downloadDetail.visibility = android.view.View.VISIBLE
        val model = state.model ?: return
        val percent = ((state.receivedBytes * 100L) / state.totalBytes.coerceAtLeast(1L)).toInt().coerceIn(0, 100)
        when (state.stage) {
            ModelDownloadUiStage.CONNECTING -> {
                progress.isIndeterminate = true
                status.text = "${model.displayName} 다운로드 서버에 연결하고 있습니다."
                downloadDetail.text = "연결 중 · 진행이 60초 이상 멈추면 Wi‑Fi를 확인한 뒤 다시 시도해 주세요."
            }
            ModelDownloadUiStage.DOWNLOADING -> {
                progress.isIndeterminate = false
                progress.progress = percent
                val receivedGb = "%.2f".format(state.receivedBytes / 1_000_000_000.0)
                val totalGb = "%.2f".format(state.totalBytes / 1_000_000_000.0)
                val speedMb = "%.1f".format(state.bytesPerSecond / 1_000_000.0)
                status.text = "${model.displayName}을 내려받는 중입니다."
                downloadDetail.text = "$percent% · $receivedGb GB / $totalGb GB · ${speedMb} MB/s"
            }
            ModelDownloadUiStage.VERIFYING -> {
                progress.isIndeterminate = true
                status.text = "다운로드가 끝났습니다. 파일 무결성을 확인하고 있습니다."
                downloadDetail.text = "SHA-256 확인 중 · 앱을 종료하지 마세요."
            }
            ModelDownloadUiStage.SAVING -> {
                progress.isIndeterminate = true
                status.text = "검증한 모델을 이 기기에 저장하고 있습니다."
                downloadDetail.text = "앱 전용 저장소에 저장 중"
            }
            else -> Unit
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

    private fun showAddSourceDialog(kind: LocalSourceKind, sourceUri: String?, extraction: SourceExtraction? = null) {
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(42, 20, 42, 8)
        }
        val title = EditText(this).apply {
            hint = "자료 이름 또는 출처"
            setText(extraction?.suggestedTitle.orEmpty())
        }
        val excerpt = EditText(this).apply {
            hint = "문항 생성에 사용할 핵심 내용·쪽수·평가 요소를 적어 주세요"
            minLines = 5
            gravity = Gravity.TOP
            setText(extraction?.suggestedExcerpt.orEmpty())
        }
        form.addView(title)
        form.addView(excerpt)
        if (sourceUri != null) {
            form.addView(TextView(this).apply { text = "선택한 파일: ${sourceUri.substringAfterLast('/')}\n${extraction?.extractionNotice ?: "원본을 직접 대조해 핵심 내용을 입력해 주세요."}" })
        }
        extraction?.imageCachePath?.let { imagePath ->
            form.addView(Button(this).apply {
                text = "로컬 모델로 이미지 내용 읽기"
                isEnabled = activeModel != null
                setOnClickListener {
                    lifecycleScope.launch {
                        try {
                            this@MainActivity.status.text = "이미지를 이 기기에서 읽는 중입니다. 원본과 대조해 저장해 주세요."
                            val response = StringBuilder()
                            runner.inspectImage(
                                imagePath = imagePath,
                                prompt = "이 교육 자료 이미지를 교사의 문항 근거로 정리해 주세요. 보이는 텍스트·표·그래프·단위만 기록하고, 불명확한 부분은 추정하지 말고 ‘원본 확인 필요’로 표시하세요.",
                            ) { partial ->
                                response.append(partial)
                                runOnUiThread { excerpt.setText(response.toString()) }
                            }
                        } catch (error: Throwable) {
                            this@MainActivity.status.text = error.message ?: "이미지 내용을 읽지 못했습니다. 원본을 직접 확인해 주세요."
                        }
                    }
                }
            })
            if (activeModel == null) {
                form.addView(TextView(this).apply { text = "이미지 내용 읽기는 먼저 E2B 또는 E4B 모델을 준비한 뒤 사용할 수 있습니다." })
            }
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
                store.saveSource(
                    LocalSource(
                        title = normalizedTitle,
                        kind = kind,
                        excerpt = normalizedExcerpt,
                        sourceUri = sourceUri,
                        pageReferences = extraction?.pageReferences,
                        extractionNotice = extraction?.extractionNotice,
                    ),
                )
                refreshWorkspaceSummary()
                status.text = "${kind.label}을 이 기기에 저장했습니다."
            }
            .show()
    }

    private fun showSourceDetailDialog(source: LocalSource) {
        AlertDialog.Builder(this)
            .setTitle(source.title)
            .setMessage("분류: ${source.kind.label}\n근거 위치: ${source.pageReferences ?: "교사 직접 확인"}\n\n${source.excerpt}\n\n${source.extractionNotice ?: ""}\n\n원본 위치: ${source.sourceUri ?: "직접 입력"}")
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
            val selected = ModelSelection.selected(this)
            if (selected != null && downloads.isInstalled(selected)) {
                status.text = "${selected.displayName}을 준비한 뒤 문항 생성 화면을 엽니다."
                prepareInstalledModel(selected) { showGenerationDialog() }
            } else {
                status.text = "모델 관리에서 기본 모델 E2B를 내려받아 준비해 주세요."
            }
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
            "[${source.kind.label}] ${source.title}${source.pageReferences?.let { " · $it" } ?: ""}\n${source.excerpt}"
        }
        lifecycleScope.launch {
            try {
                runButton.isEnabled = false
                result.visibility = View.VISIBLE
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
            .setNeutralButton("내보내기") { _, _ -> showExportDialog(question) }
            .setPositiveButton("교사 검수") { _, _ -> runLocalReview(question) }
            .show()
    }

    private fun runLocalReview(question: LocalQuestion) {
        if (activeModel == null) {
            val selected = ModelSelection.selected(this)
            if (selected != null && downloads.isInstalled(selected)) {
                status.text = "${selected.displayName}을 준비한 뒤 자동 검수를 시작합니다."
                prepareInstalledModel(selected) { runLocalReview(question) }
            } else {
                status.text = "자동 검수를 사용하려면 모델 관리에서 E2B를 준비해 주세요. 교사는 원문을 직접 검수할 수 있습니다."
            }
            return
        }
        val sourceText = store.sources().filter { it.id in question.sourceIds }.joinToString("\n\n") { source ->
            "[${source.kind.label}] ${source.title}${source.pageReferences?.let { " · $it" } ?: ""}\n${source.excerpt}"
        }
        lifecycleScope.launch {
            try {
                result.visibility = View.VISIBLE
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
        val layoutGroup = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        val albumOption = RadioButton(this).apply {
            text = "2열 앨범형 카드 (기본값)"
            isChecked = store.homeCardLayout() == HomeCardLayout.ALBUM
        }
        val listOption = RadioButton(this).apply {
            text = "일자형 카드"
            isChecked = store.homeCardLayout() == HomeCardLayout.LIST
        }
        val appLockOption = Switch(this).apply {
            text = "앱 잠금 사용"
            isChecked = AppLockGate.isEnabled(this@MainActivity)
        }
        layoutGroup.addView(albumOption)
        layoutGroup.addView(listOption)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(8, 8, 8, 8)
            addView(TextView(this@MainActivity).apply { text = "홈 카드 보기"; textSize = 16f })
            addView(layoutGroup)
            addView(TextView(this@MainActivity).apply { text = "로컬 자료 보호"; textSize = 16f; setPadding(0, 18, 0, 6) })
            addView(appLockOption)
            addView(TextView(this@MainActivity).apply { text = "교사 추가 작성 선호"; textSize = 16f; setPadding(0, 18, 0, 6) })
            addView(input)
        }
        AlertDialog.Builder(this)
            .setTitle("교사 추가 작성 선호")
            .setMessage("홈 카드 보기와 표현·구성의 개인 선호를 이 기기에 저장합니다. 공통 안전 원칙이 우선합니다.")
            .setView(panel)
            .setNegativeButton("취소", null)
            .setPositiveButton("로컬에 저장") { _, _ ->
                store.saveTeacherInstructions(input.text.toString())
                store.saveHomeCardLayout(if (albumOption.isChecked) HomeCardLayout.ALBUM else HomeCardLayout.LIST)
                AppLockGate.setEnabled(this, appLockOption.isChecked)
                status.text = "교사 추가 작성 선호·홈 카드 보기·앱 잠금 설정을 이 기기에 저장했습니다."
                recreate()
            }
            .show()
    }

    private fun showExportDialog(question: LocalQuestion) {
        if (question.reviewStatus != "승인") {
            status.text = "검수 중인 문항입니다. 교사가 승인으로 표시한 뒤 문서로 내보낼 수 있습니다."
            return
        }
        AlertDialog.Builder(this)
            .setTitle("승인 문항 내보내기")
            .setMessage("문서는 앱 전용 캐시에 생성한 뒤 선택한 앱으로만 공유합니다. 시험 보안과 최종 검수를 다시 확인해 주세요.")
            .setNegativeButton("취소", null)
            .setNeutralButton("인쇄용 PDF") { _, _ -> exportAndShare(question, QuestionExportType.PDF) }
            .setPositiveButton("시험지 DOCX") { _, _ -> exportAndShare(question, QuestionExportType.DOCX) }
            .show()
    }

    private fun exportAndShare(question: LocalQuestion, type: QuestionExportType) {
        runCatching { questionExporter.export(question, type) }
            .onSuccess { output ->
                val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", output)
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    this.type = type.mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, question.title)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(shareIntent, "${type.label} 공유"))
                status.text = "${type.label}을 공유할 앱을 선택해 주세요."
            }
            .onFailure { error -> status.text = error.message ?: "문서 내보내기에 실패했습니다." }
    }

    private fun shareTextQuestion(question: LocalQuestion) {
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
