package com.eunmastudio.teacherworkspace

import android.Manifest
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.eunmastudio.teacherworkspace.ai.GemmaModel
import com.eunmastudio.teacherworkspace.ai.ModelDownloadService
import com.eunmastudio.teacherworkspace.ai.ModelDownloadSession
import com.eunmastudio.teacherworkspace.ai.ModelDownloadUiStage
import com.eunmastudio.teacherworkspace.ai.ModelDownloadUiState
import com.eunmastudio.teacherworkspace.ai.ModelDownloadManager
import com.eunmastudio.teacherworkspace.ai.ModelSelection
import com.eunmastudio.teacherworkspace.ai.eligibility
import kotlinx.coroutines.launch

/** 모델 설치·선택·삭제·라이선스 확인을 한 화면에서 제공하는 Android 전용 관리 화면이다. */
class ModelManagerActivity : ComponentActivity() {
    private lateinit var downloadManager: ModelDownloadManager
    private lateinit var e2Status: TextView
    private lateinit var e2Action: Button
    private lateinit var e2Delete: Button
    private lateinit var e4Status: TextView
    private lateinit var e4Action: Button
    private lateinit var e4Delete: Button
    private lateinit var progress: ProgressBar
    private lateinit var progressDetail: TextView
    private var notificationPermissionModel: GemmaModel? = null

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        notificationPermissionModel?.let { model ->
            if (granted) ModelDownloadService.start(this, model)
            else showMessage("알림을 허용하면 화면을 닫아도 다운로드 진행 상태를 확인할 수 있습니다.")
        }
        notificationPermissionModel = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(14, 16, 21)
        window.navigationBarColor = Color.rgb(14, 16, 21)
        downloadManager = ModelDownloadManager(this)
        ModelDownloadSession.restore(this)
        setContentView(buildScreen())
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                ModelDownloadSession.state.collect { state -> renderState(state) }
            }
        }
    }

    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(36))
            background = solid(Color.rgb(14, 16, 21), 0)
        }
        root.addView(TextView(this).apply {
            text = "‹   모델 관리"
            textSize = 22f
            setTextColor(Color.WHITE)
            setPadding(0, 0, 0, dp(22))
            setOnClickListener { finish() }
        })
        root.addView(TextView(this).apply {
            text = "Gemma 4를 이 기기에 준비합니다"
            textSize = 28f
            setTextColor(Color.WHITE)
        })
        root.addView(TextView(this).apply {
            text = "모델은 앱 전용 저장소에 보관됩니다. 화면을 닫아도 알림과 함께 다운로드를 계속합니다."
            textSize = 15f
            setTextColor(Color.rgb(183, 191, 204))
            setPadding(0, dp(8), 0, dp(20))
        })
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { visibility = View.GONE; max = 100 }
        progressDetail = TextView(this).apply { visibility = View.GONE; textSize = 14f; setTextColor(Color.rgb(202, 210, 222)); setPadding(0, dp(8), 0, dp(16)) }
        root.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(8)))
        root.addView(progressDetail)
        root.addView(modelCard(GemmaModel.E2B).also { card ->
            e2Status = card.findViewWithTag("status")
            e2Action = card.findViewWithTag("action")
            e2Delete = card.findViewWithTag("delete")
        })
        root.addView(modelCard(GemmaModel.E4B).also { card ->
            e4Status = card.findViewWithTag("status")
            e4Action = card.findViewWithTag("action")
            e4Delete = card.findViewWithTag("delete")
        })
        root.addView(Button(this).apply {
            text = "Gemma 모델 라이선스·NOTICE 확인"
            isAllCaps = false
            setTextColor(Color.rgb(202, 210, 222))
            background = solid(Color.rgb(31, 35, 44), dp(18))
            setOnClickListener { showLicense() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { topMargin = dp(8) })
        return ScrollView(this).apply { addView(root) }
    }

    private fun modelCard(model: GemmaModel): LinearLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        fun label(value: String, size: Float, color: Int) = TextView(this).apply { text = value; textSize = size; setTextColor(color) }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(18))
            background = solid(if (model == GemmaModel.E2B) Color.rgb(33, 37, 48) else Color.rgb(29, 31, 38), dp(24))
            val params = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) }
            layoutParams = params
            addView(label(if (model.isDefault) "기본 권장 모델" else "고성능 기기용", 14f, if (model.isDefault) Color.rgb(129, 183, 255) else Color.rgb(246, 202, 79)))
            addView(label(model.displayName, 24f, Color.WHITE).apply { setPadding(0, dp(5), 0, dp(6)) })
            addView(label("${"%.2f".format(model.byteSize / 1_000_000_000.0)}GB · ${model.recommendation}", 15f, Color.rgb(196, 204, 217)).apply { tag = "status" })
            val row = LinearLayout(this@ModelManagerActivity).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(18), 0, 0) }
            row.addView(Button(this@ModelManagerActivity).apply {
                text = if (model.isDefault) "E2B 다운로드" else "E4B 다운로드"
                isAllCaps = false
                tag = "action"
                setTextColor(Color.rgb(18, 21, 27))
                background = solid(if (model.isDefault) Color.rgb(126, 174, 255) else Color.rgb(246, 202, 79), dp(18))
                setOnClickListener { onModelAction(model) }
            }, LinearLayout.LayoutParams(0, dp(52), 1f).apply { rightMargin = dp(8) })
            row.addView(Button(this@ModelManagerActivity).apply {
                text = "삭제"
                isAllCaps = false
                tag = "delete"
                setTextColor(Color.rgb(224, 229, 237))
                background = solid(Color.rgb(55, 60, 71), dp(18))
                setOnClickListener { confirmDelete(model) }
            }, LinearLayout.LayoutParams(dp(76), dp(52)))
            addView(row)
        }
    }

    private fun onModelAction(model: GemmaModel) {
        if (ModelDownloadSession.state.value.isRunning) return
        if (downloadManager.isInstalled(model)) {
            ModelSelection.select(this, model)
            showMessage("${model.displayName}을 현재 작업 모델로 선택했습니다.")
            renderState(ModelDownloadSession.state.value)
            return
        }
        val eligibility = model.eligibility(com.eunmastudio.teacherworkspace.ai.DeviceProfile.read(this))
        if (!eligibility.canInstall) {
            showMessage(eligibility.message)
            return
        }
        AlertDialog.Builder(this)
            .setTitle("${model.displayName} 내려받기")
            .setMessage("약 ${"%.2f".format(model.byteSize / 1_000_000_000.0)}GB를 앱 전용 저장소에 내려받습니다. Wi‑Fi를 권장하며, 화면을 닫아도 고정 알림과 함께 계속됩니다. 다운로드 뒤 SHA-256 무결성 확인을 통과해야 사용할 수 있습니다.")
            .setNegativeButton("취소", null)
            .setPositiveButton("동의하고 다운로드") { _, _ -> requestNotificationAndStart(model) }
            .show()
    }

    private fun requestNotificationAndStart(model: GemmaModel) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionModel = model
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            ModelDownloadService.start(this, model)
        }
    }

    private fun confirmDelete(model: GemmaModel) {
        if (ModelDownloadSession.state.value.isRunning) return
        AlertDialog.Builder(this)
            .setTitle("${model.displayName} 삭제")
            .setMessage("이 기기의 모델 파일만 삭제합니다. 자료와 문항은 삭제하지 않습니다.")
            .setNegativeButton("취소", null)
            .setPositiveButton("삭제") { _, _ ->
                downloadManager.remove(model)
                ModelSelection.clearIfSelected(this, model)
                renderState(ModelDownloadSession.state.value)
            }
            .show()
    }

    private fun renderState(state: ModelDownloadUiState) {
        val selected = ModelSelection.selected(this)
        val running = state.isRunning
        progress.visibility = if (running) View.VISIBLE else View.GONE
        progressDetail.visibility = if (running) View.VISIBLE else View.GONE
        if (running) {
            val percent = ((state.receivedBytes * 100L) / state.totalBytes.coerceAtLeast(1L)).toInt().coerceIn(0, 100)
            progress.isIndeterminate = state.stage != ModelDownloadUiStage.DOWNLOADING
            progress.progress = percent
            progressDetail.text = when (state.stage) {
                ModelDownloadUiStage.DOWNLOADING -> "$percent% · ${"%.2f".format(state.receivedBytes / 1_000_000_000.0)}GB / ${"%.2f".format(state.totalBytes / 1_000_000_000.0)}GB · ${"%.1f".format(state.bytesPerSecond / 1_000_000.0)}MB/s"
                else -> state.message.orEmpty()
            }
        }
        updateModelCard(GemmaModel.E2B, e2Status, e2Action, e2Delete, selected, state)
        updateModelCard(GemmaModel.E4B, e4Status, e4Action, e4Delete, selected, state)
    }

    private fun updateModelCard(model: GemmaModel, status: TextView, action: Button, delete: Button, selected: GemmaModel?, downloadState: ModelDownloadUiState) {
        val installed = downloadManager.isInstalled(model)
        val runningThisModel = downloadState.isRunning && downloadState.model == model
        val anotherRunning = downloadState.isRunning && !runningThisModel
        action.isEnabled = !downloadState.isRunning || installed
        delete.visibility = if (installed && !downloadState.isRunning) View.VISIBLE else View.GONE
        action.text = when {
            runningThisModel -> "다운로드 진행 중"
            installed && selected == model -> "현재 선택됨"
            installed -> "이 모델 선택"
            else -> "${if (model == GemmaModel.E2B) "E2B" else "E4B"} 다운로드"
        }
        status.text = when {
            runningThisModel -> downloadState.message ?: "다운로드 진행 중"
            anotherRunning -> "${downloadState.model?.displayName ?: "다른 모델"} 다운로드가 진행 중입니다."
            installed && selected == model -> "이 기기의 현재 작업 모델입니다."
            installed -> "다운로드 완료 · 이 모델 선택을 눌러 문항 생성에 사용하세요."
            else -> model.recommendation
        }
    }

    private fun showLicense() {
        val notice = assets.open("NOTICE-GEMMA-4.txt").bufferedReader().use { it.readText() }
        val license = assets.open("LICENSE-APACHE-2.0.txt").bufferedReader().use { it.readText() }
        AlertDialog.Builder(this).setTitle("Gemma 4 라이선스·NOTICE").setMessage("$notice\n\n$license").setPositiveButton("확인", null).show()
    }

    private fun showMessage(value: String) {
        AlertDialog.Builder(this).setMessage(value).setPositiveButton("확인", null).show()
    }

    private fun solid(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat() }
}
