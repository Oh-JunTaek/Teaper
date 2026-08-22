package com.eunmastudio.teacherworkspace

import android.app.Dialog
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.eunmastudio.teacherworkspace.source.SourceContentExtractor
import com.eunmastudio.teacherworkspace.source.SourceExtraction
import kotlinx.coroutines.launch

/**
 * 자료 준비을 홈 팝업에서 분리한 전용 자료실 화면이다.
 * 교사는 이 화면에서 직접 작성·파일 업로드·공식 원문 열기와 기존 자료 관리를 한 흐름으로 수행한다.
 */
class SourcesActivity : AppCompatActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var extractor: SourceContentExtractor
    private lateinit var list: LinearLayout
    private lateinit var status: TextView
    private lateinit var appLockGate: AppLockGate
    private var selectedKind = LocalSourceKind.REFERENCE

    private val filePicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@registerForActivityResult
        runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        lifecycleScope.launch {
            status.text = "선택한 자료의 내용을 이 기기에서 읽는 중입니다."
            val extraction = runCatching { extractor.extract(uri) }.getOrElse {
                SourceExtraction(
                    suggestedTitle = "선택한 자료",
                    suggestedExcerpt = "내용을 자동으로 읽지 못했습니다. 핵심 내용·쪽수·평가 요소를 직접 입력해 주세요.",
                    extractionNotice = it.message,
                )
            }
            showSourceEditor(selectedKind, uri.toString(), extraction)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(10, 20, 18)
        window.navigationBarColor = Color.rgb(10, 20, 18)
        store = LocalWorkspaceStore(this)
        extractor = SourceContentExtractor(this)
        val screen = buildScreen()
        appLockGate = AppLockGate(this)
        setContentView(appLockGate.attach(screen))
        ViewCompat.setOnApplyWindowInsetsListener(screen) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
        renderSources()
    }

    override fun onResume() {
        super.onResume()
        if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired()
        if (::list.isInitialized) renderSources()
    }

    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(28))
            setBackgroundColor(Color.rgb(10, 20, 18))
        }
        content.addView(LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(Button(this@SourcesActivity).apply {
                text = "‹"; textSize = 30f; isAllCaps = false; setTextColor(Color.rgb(240, 239, 225))
                background = surface(Color.TRANSPARENT, dp(18)); setOnClickListener { finish() }
            }, LinearLayout.LayoutParams(dp(52), dp(48)))
            addView(LinearLayout(this@SourcesActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(label("자료 준비", 28f, Color.rgb(245, 240, 222), bold = true))
                addView(label("수업 자료·기출 유형·공식 원문을 한곳에서 관리합니다.", 13f, Color.rgb(182, 200, 184)))
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        })
        content.addView(label("문항에 활용할 자료를 추가하고, 공식 자료는 원문을 직접 확인하세요.", 15f, Color.rgb(198, 212, 198)).apply {
            setPadding(dp(4), dp(18), dp(4), dp(14))
        })

        content.addView(sectionCard().apply {
            addView(label("자료 추가", 22f, Color.rgb(246, 240, 221), bold = true))
            addView(label("직접 핵심을 작성하거나 파일을 불러올 수 있습니다.", 14f, Color.rgb(194, 210, 196)).apply { setPadding(0, dp(5), 0, dp(14)) })
            addView(LinearLayout(this@SourcesActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                addView(actionButton("직접 작성").apply { setOnClickListener { showKindPicker { showSourceEditor(it, null, null) } } }, LinearLayout.LayoutParams(0, dp(50), 1f).apply { rightMargin = dp(8) })
                addView(actionButton("파일 업로드", accent = true).apply { setOnClickListener { showKindPicker { kind -> selectedKind = kind; filePicker.launch(arrayOf("application/pdf", "text/plain", "image/*")) } } }, LinearLayout.LayoutParams(0, dp(50), 1f))
            })
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) })

        content.addView(sectionCard(Color.rgb(18, 50, 47)).apply {
            addView(label("공식 자료 찾아보기", 20f, Color.rgb(201, 231, 207), bold = true))
            addView(label("공신력 있는 제공처의 원문을 브라우저에서 확인합니다.", 14f, Color.rgb(184, 211, 192)).apply { setPadding(0, dp(5), 0, dp(10)) })
            officialLinkButton("국가교육과정정보센터", "교육과정 · 성취기준 · 교수학습 자료", "https://www.ncic.go.kr/")
            officialLinkButton("교육부", "교육 정책 · 고시 · 공식 안내", "https://www.moe.go.kr/")
            officialLinkButton("한국교육과정평가원", "평가 자료 · 연구 · 기출 안내", "https://www.kice.re.kr/")
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) })

        content.addView(label("최근 자료", 20f, Color.rgb(244, 239, 223), bold = true).apply { setPadding(dp(4), dp(4), dp(4), dp(6)) })
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(list)
        status = label("자료는 이 기기 안에만 보관됩니다.", 12.5f, Color.rgb(144, 166, 150)).apply { setPadding(dp(4), dp(20), dp(4), 0) }
        content.addView(status)
        return ScrollView(this).apply { addView(content); clipToPadding = false }
    }

    private fun renderSources() {
        list.removeAllViews()
        val sources = store.sources().sortedByDescending { it.createdAt }
        if (sources.isEmpty()) {
            list.addView(sectionCard().apply {
                addView(label("아직 등록한 자료가 없습니다.", 16f, Color.rgb(213, 226, 212), bold = true))
                addView(label("위의 ‘직접 작성’ 또는 ‘파일 업로드’에서 첫 자료를 추가해 보세요.", 14f, Color.rgb(179, 198, 183)).apply { setPadding(0, dp(5), 0, 0) })
            })
            return
        }
        sources.forEach { source ->
            list.addView(sectionCard(Color.rgb(20, 35, 31)).apply {
                isClickable = true
                setOnClickListener { showSourceDetail(source) }
                addView(label("${source.kind.label} · ${source.title}", 17f, Color.rgb(239, 238, 223), bold = true))
                addView(label(source.excerpt.take(120), 13.5f, Color.rgb(178, 198, 181)).apply { setPadding(0, dp(5), 0, 0) })
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
        }
    }

    private fun showKindPicker(onChosen: (LocalSourceKind) -> Unit) {
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        lateinit var dialog: Dialog
        LocalSourceKind.entries.forEach { kind ->
            content.addView(actionButton(kind.label).apply { setOnClickListener { dialog.dismiss(); onChosen(kind) } }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { bottomMargin = dp(8) })
        }
        dialog = studioDialog("자료 구분", "추가할 자료의 성격을 선택하세요.", content)
    }

    private fun showSourceEditor(kind: LocalSourceKind, uri: String?, extraction: SourceExtraction?) {
        val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val title = EditText(this).apply {
            hint = "자료 이름 또는 출처"; setText(extraction?.suggestedTitle.orEmpty())
            setTextColor(Color.WHITE); setHintTextColor(Color.rgb(144, 166, 149)); background = surface(Color.rgb(15, 29, 25), dp(16)); setPadding(dp(16), dp(10), dp(16), dp(10))
        }
        val excerpt = EditText(this).apply {
            hint = "문항에 사용할 핵심 내용·쪽수·평가 요소"; minLines = 5; gravity = Gravity.TOP; setText(extraction?.suggestedExcerpt.orEmpty())
            setTextColor(Color.WHITE); setHintTextColor(Color.rgb(144, 166, 149)); background = surface(Color.rgb(15, 29, 25), dp(16)); setPadding(dp(16), dp(10), dp(16), dp(10))
        }
        form.addView(title, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) })
        form.addView(excerpt)
        uri?.let { form.addView(label("선택한 파일: ${it.substringAfterLast('/')}\n${extraction?.extractionNotice ?: "원본을 직접 대조해 주세요."}", 12.5f, Color.rgb(180, 201, 183)).apply { setPadding(4, dp(10), 4, 0) }) }
        studioDialog(
            "${kind.label} 등록",
            "핵심 내용과 위치를 남기면 문항 생성 시 근거로 확인할 수 있습니다.",
            form,
            positiveLabel = "로컬에 저장",
        ) {
            val body = excerpt.text.toString().trim()
            if (body.isBlank()) {
                status.text = "자료의 핵심 내용·쪽수·평가 요소를 입력한 뒤 저장해 주세요."
                false
            } else {
                store.saveSource(LocalSource(
                    title = title.text.toString().trim().ifBlank { "이름 없는 ${kind.label}" }, kind = kind, excerpt = body,
                    sourceUri = uri, pageReferences = extraction?.pageReferences, extractionNotice = extraction?.extractionNotice,
                ))
                status.text = "${kind.label}을 이 기기에 저장했습니다."
                renderSources()
                true
            }
        }
    }

    private fun showSourceDetail(source: LocalSource) {
        studioDialog(
            source.title,
            "${source.kind.label} · ${source.pageReferences ?: "교사 직접 확인"}\n\n${source.excerpt}\n\n${source.extractionNotice ?: ""}",
            TextView(this).apply { visibility = View.GONE },
            positiveLabel = "삭제",
        ) {
            store.deleteSource(source.id)
            renderSources()
            status.text = "자료를 이 기기에서 삭제했습니다."
            true
        }
    }

    private fun LinearLayout.officialLinkButton(title: String, description: String, url: String) {
        addView(actionButton("$title\n$description   ↗").apply {
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
    }

    private fun studioDialog(title: String, message: String, content: View, positiveLabel: String? = null, onPositive: (() -> Boolean)? = null): Dialog {
        lateinit var dialog: Dialog
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(22), dp(24), dp(18)); background = surface(Color.rgb(22, 37, 32), dp(26))
            addView(label(title, 24f, Color.rgb(246, 240, 222), bold = true))
            addView(label(message, 14f, Color.rgb(192, 209, 192)).apply { setPadding(0, dp(8), 0, dp(12)) })
            addView(content)
            addView(LinearLayout(this@SourcesActivity).apply {
                gravity = Gravity.END; setPadding(0, dp(16), 0, 0)
                addView(actionButton("닫기").apply { setOnClickListener { dialog.dismiss() } }, LinearLayout.LayoutParams(dp(92), dp(46)).apply { rightMargin = dp(8) })
                positiveLabel?.let { label -> addView(actionButton(label, accent = true).apply { setOnClickListener { if (onPositive?.invoke() != false) dialog.dismiss() } }, LinearLayout.LayoutParams(dp(132), dp(46))) }
            })
        }
        dialog = Dialog(this)
        dialog.setContentView(panel)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.show()
        dialog.window?.setLayout((resources.displayMetrics.widthPixels * 0.9).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT)
        return dialog
    }

    private fun sectionCard(color: Int = Color.rgb(22, 38, 33)): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(18), dp(18), dp(18)); background = surface(color, dp(24))
    }

    private fun actionButton(text: String, accent: Boolean = false): Button = Button(this).apply {
        this.text = text; isAllCaps = false; textSize = 15f; gravity = Gravity.CENTER
        setTextColor(if (accent) Color.rgb(25, 29, 22) else Color.rgb(235, 240, 230))
        background = surface(if (accent) Color.rgb(216, 191, 140) else Color.rgb(30, 54, 47), dp(16))
    }

    private fun label(value: String, size: Float, color: Int, bold: Boolean = false): TextView = TextView(this).apply {
        text = value; textSize = size; setTextColor(color); setLineSpacing(0f, 1.12f)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private fun surface(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply {
        setColor(color); cornerRadius = radius.toFloat(); setStroke((resources.displayMetrics.density * 1).toInt(), Color.rgb(51, 75, 67))
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
