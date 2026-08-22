package com.eunmastudio.teacherworkspace

import android.app.AlertDialog
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.eunmastudio.teacherworkspace.ai.AndroidAccelerationPreference
import com.eunmastudio.teacherworkspace.ai.LocalModelSettings
import com.eunmastudio.teacherworkspace.ai.LocalModelSettingsPolicy
import com.eunmastudio.teacherworkspace.ai.PromptDisclosurePolicy
import kotlin.math.roundToInt

/** 앱 전용 Gemma 실행 설정과 교사 맞춤 지시문을 한 화면에서 안전하게 조정한다. */
class ModelSettingsActivity : AppCompatActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var appLockGate: AppLockGate

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(14, 16, 21)
        window.navigationBarColor = Color.rgb(14, 16, 21)
        store = LocalWorkspaceStore(this)
        appLockGate = AppLockGate(this)
        setContentView(appLockGate.attach(buildScreen()))
    }

    override fun onResume() {
        super.onResume()
        if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired()
    }

    private fun buildScreen(): ScrollView {
        val initial = store.modelSettings()
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).roundToInt()
        fun panel() = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(18))
            background = solid(Color.rgb(25, 46, 40), dp(20))
        }
        fun label(value: String, size: Float = 15f, color: Int = Color.rgb(211, 221, 215)) = TextView(this).apply { text = value; textSize = size; setTextColor(color) }
        fun helpButton(title: String, message: String) = Button(this).apply {
            text = "?"; isAllCaps = false; textSize = 14f; setTextColor(Color.rgb(22, 30, 27))
            background = solid(Color.rgb(215, 234, 222), dp(16))
            setOnClickListener { AlertDialog.Builder(this@ModelSettingsActivity).setTitle(title).setMessage(message).setPositiveButton("확인", null).show() }
        }
        fun sectionTitle(title: String, help: String): LinearLayout = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(label(title, 18f, Color.WHITE), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(helpButton(title, help), LinearLayout.LayoutParams(dp(38), dp(38)))
        }
        fun <T> spinner(items: List<T>, selected: T, toLabel: (T) -> String): Spinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@ModelSettingsActivity, android.R.layout.simple_spinner_dropdown_item, items.map(toLabel))
            setSelection(items.indexOf(selected).coerceAtLeast(0))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(36))
            background = solid(Color.rgb(14, 16, 21), 0)
        }
        root.addView(TextView(this).apply { text = "‹   모델 고급 설정"; textSize = 22f; setTextColor(Color.WHITE); setPadding(0, 0, 0, dp(20)); setOnClickListener { finish() } })
        root.addView(TextView(this).apply { text = "안전한 권장값으로 시작합니다"; textSize = 27f; setTextColor(Color.WHITE) })
        root.addView(label("변경한 값은 이 기기에만 저장됩니다. 내부 기본 지시문과 검수·보안 원칙은 표시하거나 바꿀 수 없습니다.", 15f, Color.rgb(184, 197, 190)).apply { setPadding(0, dp(8), 0, dp(18)) })

        val generationPanel = panel()
        generationPanel.addView(sectionTitle("생성 길이와 표현", "맥락 길이가 높으면 더 많은 대화를 참고할 수 있지만 메모리와 첫 응답 시간이 늘어납니다. 최대 생성 길이 ‘자동’은 남은 맥락 예산을 사용합니다."))
        generationPanel.addView(label("대화 맥락 길이", 14f).apply { setPadding(0, dp(14), 0, dp(4)) })
        val contextSpinner = spinner(LocalModelSettingsPolicy.contextChoices, initial.contextTokens) { "$it 토큰" }
        generationPanel.addView(contextSpinner)
        generationPanel.addView(label("최대 생성 길이", 14f).apply { setPadding(0, dp(12), 0, dp(4)) })
        val outputSpinner = spinner(LocalModelSettingsPolicy.outputChoices, initial.maxOutputTokens) { if (it == 0) "자동 · 남은 맥락까지" else "$it 토큰" }
        generationPanel.addView(outputSpinner)

        fun samplingSlider(title: String, help: String, minimum: Double, maximum: Double, step: Double, current: Double): Pair<SeekBar, TextView> {
            generationPanel.addView(sectionTitle(title, help).apply { setPadding(0, dp(14), 0, 0) })
            val value = label("", 14f, Color.rgb(245, 210, 137))
            val slider = SeekBar(this).apply { max = ((maximum - minimum) / step).roundToInt(); progress = ((current.coerceIn(minimum, maximum) - minimum) / step).roundToInt() }
            fun refresh() { value.text = "%1$.2f".format(minimum + slider.progress * step) }
            refresh(); slider.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) = refresh()
                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
            generationPanel.addView(value); generationPanel.addView(slider)
            return slider to value
        }
        val temperatureSlider = samplingSlider("표현 다양성", "낮으면 표현이 더 일관되고, 높으면 대안 표현이 늘어납니다. 출제 보조는 0.20~0.50을 권장합니다.", 0.0, 1.2, 0.05, initial.temperature).first
        val topKSlider = samplingSlider("후보 폭 Top-K", "다음 단어 후보의 개수입니다. 낮으면 보수적이고, 높으면 표현이 다양해질 수 있습니다.", 1.0, 100.0, 1.0, initial.topK.toDouble()).first
        val topPSlider = samplingSlider("누적 확률 Top-P", "누적 확률에 따라 후보 폭을 정합니다. 높을수록 다양한 단어 선택을 허용합니다.", 0.10, 1.0, 0.05, initial.topP).first
        root.addView(generationPanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) })

        val executionPanel = panel()
        executionPanel.addView(sectionTitle("실행 방식", "CPU는 안정성을 우선합니다. GPU는 빠를 수 있으나 기기·드라이버 상태에 따라 CPU로 자동 전환될 수 있습니다."))
        val accelerationGroup = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        val cpu = RadioButton(this).apply { text = "CPU 안정성 · 기본 권장"; setTextColor(Color.WHITE); isChecked = initial.acceleration == AndroidAccelerationPreference.CPU }
        val gpu = RadioButton(this).apply { text = "GPU 가속 · 지원 기기에서 우선 시도"; setTextColor(Color.WHITE); isChecked = initial.acceleration == AndroidAccelerationPreference.GPU }
        accelerationGroup.addView(cpu); accelerationGroup.addView(gpu); executionPanel.addView(accelerationGroup)
        val thinking = Switch(this).apply { text = "추론 기능 사용"; setTextColor(Color.WHITE); isChecked = initial.thinkingEnabled; setPadding(0, dp(12), 0, 0) }
        executionPanel.addView(thinking)
        executionPanel.addView(label("Gemma 4에서만 적용합니다. 내부 추론 과정은 표시·저장하지 않고 최종 답변만 사용합니다.", 13f, Color.rgb(184, 197, 190)))
        val speculative = Switch(this).apply { text = "빠른 생성 · 추측 디코딩"; setTextColor(Color.rgb(150, 160, 156)); isChecked = initial.speculativeDecodingEnabled; isEnabled = false; setPadding(0, dp(10), 0, 0) }
        executionPanel.addView(speculative)
        executionPanel.addView(label("현재 Android Kotlin 실행 경로에서는 이 기능을 아직 적용하지 않습니다. 모델이 지원하지 않아도 오류 없이 무시됩니다.", 13f, Color.rgb(184, 197, 190)))
        root.addView(executionPanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) })

        val instructionPanel = panel()
        instructionPanel.addView(sectionTitle("교사 맞춤 지시문", "예: ‘계산 과정의 단위를 확인해 주세요.’처럼 표현·구성 선호를 더합니다. 내부 기본 지시문을 보거나 교체할 수는 없습니다."))
        instructionPanel.addView(label("교사 추가 작성 선호", 14f).apply { setPadding(0, dp(12), 0, dp(4)) })
        val teacherInstructions = EditText(this).apply { setText(store.teacherInstructions()); hint = "예: 학생 수준에 맞춘 짧은 해설을 제안해 주세요."; minLines = 5; maxLines = 8; gravity = Gravity.TOP; setTextColor(Color.WHITE); setHintTextColor(Color.rgb(142, 157, 148)); background = outlined(Color.rgb(61, 91, 79), dp(14)) }
        instructionPanel.addView(teacherInstructions, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(176)))
        root.addView(instructionPanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) })

        val actionRow = LinearLayout(this).apply { gravity = Gravity.END; orientation = LinearLayout.HORIZONTAL }
        actionRow.addView(Button(this).apply { text = "기본값 복원"; isAllCaps = false; setTextColor(Color.rgb(224, 232, 227)); background = solid(Color.rgb(44, 69, 59), dp(18)); setOnClickListener { store.resetModelSettings(); store.saveTeacherInstructions(""); recreate() } }, LinearLayout.LayoutParams(0, dp(52), 1f).apply { rightMargin = dp(8) })
        actionRow.addView(Button(this).apply {
            text = "이 기기에 저장"; isAllCaps = false; setTextColor(Color.rgb(21, 31, 27)); background = solid(Color.rgb(234, 204, 139), dp(18))
            setOnClickListener {
                val instruction = teacherInstructions.text.toString().trim().take(600)
                if (PromptDisclosurePolicy.safeResponseFor(instruction) != null) { showMessage("내부 지시문을 보거나 바꾸려는 내용은 저장할 수 없습니다. 수업·평가 표현 선호만 작성해 주세요."); return@setOnClickListener }
                val settings = LocalModelSettingsPolicy.normalize(LocalModelSettings(
                    contextTokens = LocalModelSettingsPolicy.contextChoices[contextSpinner.selectedItemPosition],
                    maxOutputTokens = LocalModelSettingsPolicy.outputChoices[outputSpinner.selectedItemPosition],
                    temperature = temperatureSlider.progress * 0.05,
                    topK = topKSlider.progress + 1,
                    topP = 0.10 + topPSlider.progress * 0.05,
                    acceleration = if (gpu.isChecked) AndroidAccelerationPreference.GPU else AndroidAccelerationPreference.CPU,
                    thinkingEnabled = thinking.isChecked,
                    speculativeDecodingEnabled = speculative.isChecked,
                ))
                store.saveModelSettings(settings); store.saveTeacherInstructions(instruction)
                showMessage("고급 설정과 교사 맞춤 지시문을 이 기기에 저장했습니다. 다음 모델 준비부터 적용됩니다.")
            }
        }, LinearLayout.LayoutParams(0, dp(52), 1f))
        root.addView(actionRow)
        return ScrollView(this).apply { addView(root) }
    }

    private fun showMessage(message: String) { AlertDialog.Builder(this).setMessage(message).setPositiveButton("확인", null).show() }
    private fun solid(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat() }
    private fun outlined(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply { setColor(Color.TRANSPARENT); setStroke((resources.displayMetrics.density * 1).roundToInt(), color); cornerRadius = radius.toFloat() }
}
