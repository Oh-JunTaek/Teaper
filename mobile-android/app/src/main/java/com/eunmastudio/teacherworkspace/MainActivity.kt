package com.eunmastudio.teacherworkspace

import android.app.AlertDialog
import android.app.Dialog
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.net.Uri
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
        val surface = Color.rgb(10, 20, 18)
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
            setBackgroundColor(Color.rgb(10, 20, 18))
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
        content.addView(text("교사의 수업 설계와 문항 검수를 위한 로컬 작업실", 15f, Color.rgb(180, 195, 184)).apply {
            setPadding(0, dp(4), 0, dp(22))
        })

        content.addView(text("오늘의 작업", 21f).apply { setPadding(0, dp(2), 0, dp(6)) })
        workspaceSummary = text("로컬 자료와 문항을 확인하고 있습니다.", 15f, Color.rgb(191, 200, 215))
        content.addView(workspaceSummary)
        val workItems = listOf(
            WorkCardItem("chat", "온디바이스 AI 채팅", "질문·자료 정리·수업 아이디어", R.drawable.ic_workspace_chat, Color.rgb(75, 126, 235)) {
                startActivity(Intent(this@MainActivity, TeacherChatActivity::class.java))
            },
            WorkCardItem("source", "자료 준비", "참고 자료·기출 유형·공식 자료", R.drawable.ic_workspace_sources, Color.rgb(65, 174, 152)) {
                startActivity(Intent(this@MainActivity, SourcesActivity::class.java))
            },
            WorkCardItem("generate", "문항 생성", "선택한 자료로 문항 만들기", R.drawable.ic_workspace_generate, Color.rgb(118, 156, 244)) { showGenerationDialog() },
            WorkCardItem("quick_quiz", "간결한 쪽지시험", "한 개념을 빠르게 확인하기", R.drawable.ic_workspace_generate, Color.rgb(91, 145, 232)) {
                startActivity(Intent(this@MainActivity, QuickQuizActivity::class.java))
            },
            WorkCardItem("notes", "메모장", "AI에 자동 반영되지 않는 작업 메모", R.drawable.ic_workspace_sources, Color.rgb(132, 111, 204)) {
                startActivity(Intent(this@MainActivity, NotesActivity::class.java))
            },
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
            background = chalkSurface(Color.rgb(22, 38, 33), dp(22))
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
            background = chalkSurface(Color.rgb(22, 38, 33), dp(22))
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

    /** 교사용 작업실의 칠판 질감을 어두운 녹색 표면과 미세한 분필 테두리로 표현한다. */
    private fun chalkSurface(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius.toFloat()
        setStroke((resources.displayMetrics.density * 1).toInt(), Color.rgb(51, 75, 67))
    }

    private fun studioButton(label: String, accent: Boolean = false): Button = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 15f
        setTextColor(if (accent) Color.rgb(19, 27, 23) else Color.rgb(232, 239, 231))
        background = chalkSurface(
            if (accent) Color.rgb(216, 191, 140) else Color.rgb(32, 54, 47),
            (resources.displayMetrics.density * 16).toInt(),
        )
    }

    /** 기본 시스템 경고창 대신 서비스 색·여백·행동 계층을 통일한 작업실 팝업을 사용한다. */
    private fun showStudioDialog(
        title: String,
        message: String? = null,
        content: View? = null,
        negativeLabel: String = "닫기",
        positiveLabel: String? = null,
        onPositive: (() -> Boolean)? = null,
    ): Dialog {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val dialog = Dialog(this)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(22), dp(24), dp(18))
            background = chalkSurface(Color.rgb(22, 37, 32), dp(26))
        }
        panel.addView(TextView(this).apply {
            text = title; textSize = 24f; setTextColor(Color.rgb(244, 241, 229))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        message?.takeIf { it.isNotBlank() }?.let { value ->
            panel.addView(TextView(this).apply {
                text = value; textSize = 14f; setTextColor(Color.rgb(191, 207, 195)); setLineSpacing(0f, 1.12f)
                setPadding(0, dp(10), 0, dp(10))
            })
        }
        content?.let { panel.addView(it, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(4) }) }
        panel.addView(LinearLayout(this).apply {
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            setPadding(0, dp(18), 0, 0)
            addView(studioButton(negativeLabel).apply { setOnClickListener { dialog.dismiss() } }, LinearLayout.LayoutParams(dp(92), dp(46)).apply { rightMargin = dp(8) })
            positiveLabel?.let { label ->
                addView(studioButton(label, accent = true).apply {
                    setOnClickListener { if (onPositive?.invoke() != false) dialog.dismiss() }
                }, LinearLayout.LayoutParams(dp(132), dp(46)))
            }
        })
        dialog.setContentView(panel)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.show()
        dialog.window?.setLayout((resources.displayMetrics.widthPixels * 0.9).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT)
        return dialog
    }

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
        val notes = store.notes()
        val quickQuizzes = store.quickQuizzes()
        workspaceSummary.text = "등록 자료 ${sources.size}건 · 문항 ${questions.size}건 · 메모 ${notes.size}건 · 쪽지시험 ${quickQuizzes.size}건\n" +
            "승인 ${questions.count { it.reviewStatus == "승인" }}건\n" +
            "자료·문항은 앱 전용 저장소에 보관되고 자동 백업하지 않습니다."
    }

    private fun showSourcesDialog() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 4, 0, 0)
        }
        lateinit var sourceDialog: Dialog
        container.addView(studioButton("＋ 자료 추가", accent = true).apply {
            setOnClickListener { sourceDialog.dismiss(); showSourceEntryDialog() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 52).apply { bottomMargin = 10 })
        container.addView(studioButton("⌁ 공식 자료 찾아보기").apply {
            setOnClickListener { sourceDialog.dismiss(); showOfficialSourcesDialog() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 50).apply { bottomMargin = 14 })
        val existing = store.sources()
        if (existing.isEmpty()) {
            container.addView(TextView(this).apply {
                text = "아직 등록한 자료가 없습니다. ‘자료 추가’에서 직접 작성하거나 파일을 업로드해 주세요."
                textSize = 14f; setTextColor(Color.rgb(181, 200, 185)); setPadding(4, 8, 4, 6)
            })
        } else {
            container.addView(TextView(this).apply { text = "등록한 자료"; textSize = 16f; setTextColor(Color.rgb(230, 237, 228)); setPadding(4, 6, 4, 6) })
            existing.forEach { source ->
                container.addView(studioButton("${source.kind.label} · ${source.title}\n${source.excerpt.take(56)}").apply {
                    text = "${source.kind.label} · ${source.title}\n${source.excerpt.take(70)}"
                    isAllCaps = false
                    setOnClickListener { sourceDialog.dismiss(); showSourceDetailDialog(source) }
                }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 7 })
            }
        }
        sourceDialog = showStudioDialog(
            title = "자료 준비",
            message = "수업 자료·기출 유형·공식 자료를 한곳에서 관리합니다.",
            content = ScrollView(this).apply { addView(container) },
        )
    }

    /** 파일 업로드를 별도 항목으로 나열하지 않고 ‘자료 추가’ 안에서 직접 작성과 함께 선택한다. */
    private fun showSourceEntryDialog() {
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, 4, 0, 0) }
        val kindGroup = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        LocalSourceKind.entries.forEachIndexed { index, kind ->
            kindGroup.addView(RadioButton(this).apply {
                text = kind.label; setTextColor(Color.rgb(225, 235, 224)); id = View.generateViewId(); isChecked = index == 0
                tag = kind
            })
        }
        content.addView(TextView(this).apply { text = "자료 구분"; textSize = 15f; setTextColor(Color.rgb(214, 227, 214)); setPadding(4, 0, 4, 4) })
        content.addView(kindGroup)
        lateinit var entryDialog: Dialog
        fun selectedKind(): LocalSourceKind = kindGroup.findViewById<RadioButton>(kindGroup.checkedRadioButtonId).tag as LocalSourceKind
        content.addView(studioButton("직접 작성").apply {
            setOnClickListener { entryDialog.dismiss(); showAddSourceDialog(selectedKind(), null) }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 50).apply { topMargin = 12 })
        content.addView(studioButton("파일 업로드", accent = true).apply {
            setOnClickListener {
                selectedSourceKind = selectedKind()
                entryDialog.dismiss()
                chooseSourceFile.launch(arrayOf("application/pdf", "text/plain", "image/*"))
            }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 50).apply { topMargin = 8 })
        entryDialog = showStudioDialog(
            title = "자료 추가",
            message = "자료 구분을 고른 뒤 작성 방식 또는 파일 업로드를 선택하세요.",
            content = content,
        )
    }

    private fun showOfficialSourcesDialog() {
        data class OfficialLink(val title: String, val description: String, val url: String)
        val links = listOf(
            OfficialLink("국가교육과정정보센터", "교육과정·성취기준·교수학습 자료", "https://www.ncic.go.kr/"),
            OfficialLink("교육부", "교육 정책·고시·공식 안내", "https://www.moe.go.kr/"),
            OfficialLink("한국교육과정평가원", "평가 자료·연구·기출 안내", "https://www.kice.re.kr/"),
        )
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        lateinit var officialDialog: Dialog
        links.forEach { link ->
            content.addView(studioButton("${link.title}\n${link.description}").apply {
                setOnClickListener {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link.url)))
                    officialDialog.dismiss()
                }
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 8 })
        }
        officialDialog = showStudioDialog(
            title = "공식 자료 찾아보기",
            message = "원문은 외부 브라우저에서 열립니다. 이용 범위와 최신성을 교사가 확인한 뒤 자료로 등록해 주세요.",
            content = content,
        )
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
        showStudioDialog(
            title = "${kind.label} 등록",
            message = "핵심 내용·쪽수·평가 요소를 기록하면 문항 생성 근거로 사용할 수 있습니다.",
            content = form,
            negativeLabel = "취소",
            positiveLabel = "로컬에 저장",
        ) {
                val normalizedTitle = title.text.toString().trim().ifBlank { "이름 없는 ${kind.label}" }
                val normalizedExcerpt = excerpt.text.toString().trim()
                if (normalizedExcerpt.isBlank()) {
                    status.text = "자료의 핵심 내용·쪽수·평가 요소를 입력한 뒤 저장해 주세요."
                    false
                } else {
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
                    true
                }
            }
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
        val request = EditText(this).apply {
            hint = "예: 고등 화학 I, 화학 결합 단원, 5지선다 1문항, 중 난이도"
            minLines = 4
            gravity = Gravity.TOP
            setTextColor(Color.rgb(239, 244, 238))
            setHintTextColor(Color.rgb(145, 165, 151))
            background = chalkSurface(Color.rgb(15, 29, 25), (resources.displayMetrics.density * 16).toInt())
            setPadding(22, 16, 22, 16)
        }
        showStudioDialog(
            title = "문항 생성",
            message = "등록한 자료를 바탕으로 생성합니다. 결과는 반드시 교사가 검수해야 합니다.",
            content = request,
            negativeLabel = "취소",
            positiveLabel = "생성 시작",
        ) {
                val requestText = request.text.toString().trim()
                if (requestText.isBlank()) {
                    status.text = "문항 생성 요청을 입력해 주세요."
                    false
                } else {
                    lifecycleScope.launch {
                        if (ensureGenerationModelReady()) generateQuestion(requestText)
                    }
                    true
                }
            }
    }

    /** 카드 탭은 즉시 반응시키고, 무거운 모델 준비는 사용자가 생성 실행을 확정한 뒤에만 한다. */
    private suspend fun ensureGenerationModelReady(): Boolean {
        if (activeModel != null) return true
        val selected = ModelSelection.selected(this)
        if (selected == null || !downloads.isInstalled(selected)) {
            status.text = "문항 생성 전 모델 관리에서 기본 모델 E2B를 내려받아 선택해 주세요."
            return false
        }
        return try {
            status.text = "${selected.displayName}을 문항 생성용으로 준비하고 있습니다."
            val mode = runner.initialize(downloads.installedFile(selected).absolutePath, preferGpu = false)
            activeModel = selected
            status.text = "${selected.displayName} 준비 완료 · $mode"
            true
        } catch (error: Throwable) {
            status.text = error.message ?: "문항 생성 모델을 준비하지 못했습니다."
            false
        }
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
            setPadding(0, 4, 0, 0)
        }
        val questions = store.questions()
        if (questions.isEmpty()) {
            container.addView(TextView(this).apply {
                text = "검수할 문항이 없습니다. 자료 준비에서 근거를 정리한 뒤 문항 생성을 시작해 주세요."
                textSize = 15f; setTextColor(Color.rgb(192, 207, 193)); setPadding(4, 8, 4, 8)
            })
        } else {
            lateinit var reviewDialog: Dialog
            questions.sortedByDescending { it.createdAt }.forEach { question ->
                container.addView(studioButton("[${question.reviewStatus}] ${question.title}\n${question.content.take(90)}").apply {
                    text = "[${question.reviewStatus}] ${question.title}\n${question.content.take(90)}"
                    isAllCaps = false
                    setOnClickListener { reviewDialog.dismiss(); showQuestionDetailDialog(question) }
                }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 8 })
            }
            reviewDialog = showStudioDialog(
                title = "검수함",
                message = "자료와 문항을 대조하고, 최종 판단은 교사가 확인합니다.",
                content = ScrollView(this).apply { addView(container) },
            )
            return
        }
        showStudioDialog(
            title = "검수함",
            message = "자료와 문항을 대조하고, 최종 판단은 교사가 확인합니다.",
            content = ScrollView(this).apply { addView(container) },
        )
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
