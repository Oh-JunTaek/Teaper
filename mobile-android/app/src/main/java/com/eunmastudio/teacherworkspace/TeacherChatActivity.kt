package com.eunmastudio.teacherworkspace

import android.app.Dialog
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.eunmastudio.teacherworkspace.ai.ChatPromptMessage
import com.eunmastudio.teacherworkspace.ai.ChatTurnPolicy
import com.eunmastudio.teacherworkspace.ai.GemmaModel
import com.eunmastudio.teacherworkspace.ai.LiteRtLmRunner
import com.eunmastudio.teacherworkspace.ai.ModelDownloadManager
import com.eunmastudio.teacherworkspace.ai.ModelSelection
import com.eunmastudio.teacherworkspace.ai.PromptDisclosurePolicy
import com.eunmastudio.teacherworkspace.ai.TeacherChatPromptContract
import com.eunmastudio.teacherworkspace.ui.ChatMarkdownRenderer
import kotlinx.coroutines.launch
import kotlin.math.max

/**
 * GPT 형태의 질문·응답 흐름을 제공하되, 모델·대화·자료는 Android 앱 전용 저장소와 LiteRT-LM 안에서만 처리한다.
 */
class TeacherChatActivity : AppCompatActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var downloads: ModelDownloadManager
    private lateinit var runner: LiteRtLmRunner
    private lateinit var messageList: LinearLayout
    private lateinit var messageScroll: ScrollView
    private lateinit var input: EditText
    private lateinit var sendButton: Button
    private lateinit var status: TextView
    private lateinit var sourceSwitch: Switch
    private lateinit var appLockGate: AppLockGate
    private var currentThread: LocalChatThread? = null
    private var activeModel: GemmaModel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        store = LocalWorkspaceStore(this)
        downloads = ModelDownloadManager(this)
        runner = LiteRtLmRunner(this)
        val screen = buildScreen()
        appLockGate = AppLockGate(this)
        setContentView(appLockGate.attach(screen))
        applyWindowInsets(screen)
        loadThread(store.refreshSuggestedChatTitles().firstOrNull() ?: store.createChatThread())
    }

    override fun onResume() {
        super.onResume()
        if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired()
    }

    override fun onDestroy() {
        runner.close()
        super.onDestroy()
    }

    private fun buildScreen(): LinearLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(16))
            setBackgroundColor(Color.rgb(10, 20, 18))
            addView(LinearLayout(this@TeacherChatActivity).apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(Button(this@TeacherChatActivity).apply {
                    text = "‹"; textSize = 28f; setTextColor(Color.WHITE); isAllCaps = false
                    background = solid(Color.TRANSPARENT, 0)
                    setOnClickListener { finish() }
                }, LinearLayout.LayoutParams(dp(48), dp(52)))
                addView(LinearLayout(this@TeacherChatActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(this@TeacherChatActivity).apply {
                        text = "온디바이스 AI 채팅"; textSize = 21f; setTextColor(Color.WHITE)
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                    })
                    addView(TextView(this@TeacherChatActivity).apply { text = "Gemma 4 · 이 기기 안에서만 처리"; textSize = 12.5f; setTextColor(Color.rgb(190, 202, 161)) })
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                addView(Button(this@TeacherChatActivity).apply {
                    text = "대화"; isAllCaps = false; textSize = 13f; setTextColor(Color.WHITE)
                    background = chalkSurface(Color.rgb(29, 50, 43), dp(16))
                    setOnClickListener { showThreadPicker() }
                }, LinearLayout.LayoutParams(dp(72), dp(42)))
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            status = TextView(this@TeacherChatActivity).apply {
                text = "이 기기에서만 처리 · 최종 판단은 교사가 확인합니다"
                textSize = 13f; setTextColor(Color.rgb(191, 209, 188)); setPadding(dp(14), dp(9), dp(14), dp(9))
                background = chalkSurface(Color.rgb(20, 38, 33), dp(14))
            }
            addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) })
            sourceSwitch = Switch(this@TeacherChatActivity).apply {
                text = "등록 자료 참고"; textSize = 13f; setTextColor(Color.rgb(213, 226, 207)); isChecked = true
                setPadding(dp(4), dp(7), dp(4), dp(5))
            }
            addView(sourceSwitch)
            messageList = LinearLayout(this@TeacherChatActivity).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(8), 0, dp(8)) }
            messageScroll = ScrollView(this@TeacherChatActivity).apply { addView(messageList) }
            addView(messageScroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(LinearLayout(this@TeacherChatActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(9), dp(9), dp(9), dp(9))
                background = chalkSurface(Color.rgb(18, 34, 30), dp(24))
                input = EditText(this@TeacherChatActivity).apply {
                    hint = "질문을 입력하세요"; textSize = 16f; minLines = 1; maxLines = 5
                    setTextColor(Color.WHITE); setHintTextColor(Color.rgb(139, 160, 147))
                    background = chalkSurface(Color.rgb(24, 44, 38), dp(20)); setPadding(dp(16), dp(10), dp(16), dp(10))
                }
                addView(input, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = dp(8) })
                sendButton = Button(this@TeacherChatActivity).apply {
                    text = "보내기"; isAllCaps = false; setTextColor(Color.rgb(15, 18, 24))
                    background = solid(Color.rgb(216, 191, 140), dp(20)); setOnClickListener { sendMessage() }
                }
                addView(sendButton, LinearLayout.LayoutParams(dp(82), dp(52)))
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) })
        }
    }

    private fun configureSystemBars() {
        val surface = Color.rgb(10, 20, 18)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = surface
        window.navigationBarColor = surface
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
    }

    /** 키보드와 제스처·버튼 내비게이션 영역 중 더 큰 하단 인셋만큼 작성 바를 위로 올린다. */
    private fun applyWindowInsets(screen: View) {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        ViewCompat.setOnApplyWindowInsetsListener(screen) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(
                dp(18),
                max(dp(12), bars.top + dp(8)),
                dp(18),
                max(bars.bottom, ime.bottom) + dp(8),
            )
            insets
        }
        ViewCompat.requestApplyInsets(screen)
    }

    private fun loadThread(thread: LocalChatThread) {
        runner.resetChatConversation()
        currentThread = thread
        messageList.removeAllViews()
        if (thread.messages.isEmpty()) {
            addSystemHint("안녕하세요. 자료 정리, 수업 아이디어, 문항 표현, 검수 관점, 일반 질문을 도울 수 있습니다. 학생 식별 정보나 실제 출제 예정 문항의 민감 원문은 입력하지 마세요.")
        } else {
            thread.messages.forEach { message -> addBubble(message.content, message.isUser) }
        }
    }

    private fun sendMessage() {
        val content = input.text.toString().trim()
        if (content.isBlank()) return
        val thread = currentThread ?: store.createChatThread().also { currentThread = it }
        sendButton.isEnabled = false
        lifecycleScope.launch {
            var assistantBubble: TextView? = null
            try {
                val persistedUser = store.appendChatMessage(thread.id, content, isUser = true)
                ChatTurnPolicy.requirePersisted(content, persistedUser != null)
                currentThread = persistedUser ?: currentThread
                input.setText("")
                addBubble(content, true)
                PromptDisclosurePolicy.safeResponseFor(content)?.let { safeReply ->
                    assistantBubble = addBubble(safeReply, false)
                    val persistedAssistant = store.appendChatMessage(thread.id, safeReply, isUser = false)
                    assistantBubble?.text = renderChatMessage(ChatTurnPolicy.requirePersisted(safeReply, persistedAssistant != null))
                    currentThread = persistedAssistant ?: currentThread
                    status.text = "내부 설정은 공개하지 않습니다. 교사용 기능 안내는 계속 도와드릴 수 있습니다."
                    return@launch
                }
                if (!ensureModelReady()) return@launch
                assistantBubble = addBubble("입력 중…", false)
                val latestThread = store.chatThreads().firstOrNull { it.id == thread.id } ?: thread
                val request = TeacherChatPromptContract.conversationRequest(
                    history = latestThread.messages.map { ChatPromptMessage(it.isUser, it.content) },
                    sourceSummaries = if (sourceSwitch.isChecked) sourceSummaries() else "",
                    teacherInstructions = store.teacherInstructions(),
                )
                val response = runner.chat(request.systemInstruction, request.history)
                val finalResponse = ChatTurnPolicy.normalizeForPersistence(
                    if (PromptDisclosurePolicy.isPotentialDisclosure(response)) PromptDisclosurePolicy.SAFE_REPLY else response,
                )
                if (finalResponse.isBlank()) throw IllegalStateException("모델이 빈 응답을 반환했습니다. 다시 시도해 주세요.")
                val persistedAssistant = store.appendChatMessage(thread.id, finalResponse, isUser = false)
                assistantBubble?.text = renderChatMessage(ChatTurnPolicy.requirePersisted(finalResponse, persistedAssistant != null))
                messageScroll.post { messageScroll.fullScroll(View.FOCUS_DOWN) }
                currentThread = persistedAssistant ?: currentThread
                status.text = "${activeModel?.displayName ?: "로컬 모델"}이 이 기기에서 응답했습니다. 외부 전송을 사용하지 않습니다."
            } catch (error: Throwable) {
                assistantBubble?.text = renderChatMessage("응답을 완료하지 못했습니다. ${error.message ?: "모델 상태를 확인한 뒤 다시 시도해 주세요."}")
                status.text = "생성 오류가 기록되었습니다. 앱을 다시 열 필요 없이 같은 질문을 다시 보낼 수 있습니다."
            } finally {
                sendButton.isEnabled = true
            }
        }
    }

    private suspend fun ensureModelReady(): Boolean {
        if (activeModel != null) return true
        val selected = ModelSelection.selected(this)
        if (selected == null || !downloads.isInstalled(selected)) {
            status.text = "채팅을 시작하려면 모델 관리에서 기본 모델 E2B를 먼저 내려받아 선택해 주세요."
            startActivity(Intent(this, ModelManagerActivity::class.java))
            return false
        }
        return try {
            status.text = "${selected.displayName}을 채팅용으로 준비하고 있습니다."
            // S25+ 실기기에서 GPU 생성 완료 뒤 프로세스가 종료되는 현상을 분리하기 위해,
            // 채팅은 우선 CPU 안정성 모드로 실행한다. 문항·이미지 경로의 GPU 정책과는 별개다.
            val mode = runner.initialize(
                downloads.installedFile(selected).absolutePath,
                preferGpu = false,
                maxNumTokens = ChatTurnPolicy.MAX_CONTEXT_TOKENS,
            )
            activeModel = selected
            status.text = "${selected.displayName} 준비 완료 · $mode"
            true
        } catch (error: Throwable) {
            status.text = error.message ?: "모델을 준비하지 못했습니다."
            false
        }
    }

    private fun sourceSummaries(): String = store.sources().joinToString("\n\n") { source ->
        "[${source.kind.label}] ${source.title}${source.pageReferences?.let { " · $it" } ?: ""}\n${source.excerpt.take(1_200)}"
    }.take(6_000)

    private fun showThreadPicker() {
        val threads = store.refreshSuggestedChatTitles()
        val container = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        lateinit var dialog: Dialog
        container.addView(chatActionButton("＋ 새 대화", accent = true).apply {
            setOnClickListener { dialog.dismiss(); loadThread(store.createChatThread()) }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)).apply { bottomMargin = dp(12) })
        threads.forEach { thread ->
            container.addView(LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(15), dp(13), dp(13), dp(12))
                background = chalkSurface(Color.rgb(21, 40, 34), dp(18))
                setOnClickListener { dialog.dismiss(); loadThread(thread) }
                addView(LinearLayout(this@TeacherChatActivity).apply {
                    gravity = Gravity.CENTER_VERTICAL
                    addView(TextView(this@TeacherChatActivity).apply {
                        text = thread.title; textSize = 16f; setTextColor(Color.rgb(242, 239, 225)); maxLines = 1
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                    }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                    addView(chatActionButton("편집").apply {
                        textSize = 12f
                        setOnClickListener { dialog.dismiss(); showRenameThreadDialog(thread) }
                    }, LinearLayout.LayoutParams(dp(64), dp(38)))
                })
                addView(TextView(this@TeacherChatActivity).apply {
                    text = thread.messages.lastOrNull()?.content?.take(58).orEmpty().ifBlank { "아직 메시지가 없습니다." }
                    textSize = 13f; setTextColor(Color.rgb(177, 198, 181)); maxLines = 2; setPadding(0, dp(5), 0, 0)
                })
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
        }
        val footer = LinearLayout(this).apply {
            gravity = Gravity.END
            addView(chatActionButton("현재 대화 삭제").apply {
                setOnClickListener {
                    currentThread?.let { store.deleteChatThread(it.id) }
                    dialog.dismiss()
                    loadThread(store.createChatThread())
                }
            }, LinearLayout.LayoutParams(dp(132), dp(44)))
        }
        container.addView(footer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(6) })
        dialog = showChatDialog("대화 기록", "제목은 이 기기에서 최근 질문을 바탕으로 자동 정리됩니다. ‘편집’으로 직접 고정할 수 있습니다.", ScrollView(this).apply { addView(container) })
    }

    private fun showRenameThreadDialog(thread: LocalChatThread) {
        val input = EditText(this).apply {
            setText(thread.title); selectAll(); setTextColor(Color.WHITE); setHintTextColor(Color.rgb(148, 169, 151))
            background = chalkSurface(Color.rgb(16, 31, 26), dp(16)); setPadding(dp(14), dp(10), dp(14), dp(10))
        }
        showChatDialog("대화 제목 수정", "직접 입력한 제목은 이후 자동 제목으로 바뀌지 않습니다.", input, "저장") {
            val updated = store.renameChatThread(thread.id, input.text.toString())
            if (updated != null && currentThread?.id == thread.id) loadThread(updated)
            updated != null
        }
    }

    private fun showChatDialog(title: String, message: String, content: View, positiveLabel: String? = null, onPositive: (() -> Boolean)? = null): Dialog {
        lateinit var dialog: Dialog
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(21), dp(22), dp(18))
            background = chalkSurface(Color.rgb(22, 38, 33), dp(24))
            addView(TextView(this@TeacherChatActivity).apply { text = title; textSize = 24f; setTextColor(Color.rgb(246, 240, 222)); setTypeface(typeface, android.graphics.Typeface.BOLD) })
            addView(TextView(this@TeacherChatActivity).apply { text = message; textSize = 13.5f; setTextColor(Color.rgb(190, 208, 191)); setPadding(0, dp(8), 0, dp(12)) })
            addView(content)
            addView(LinearLayout(this@TeacherChatActivity).apply {
                gravity = Gravity.END; setPadding(0, dp(15), 0, 0)
                addView(chatActionButton("닫기").apply { setOnClickListener { dialog.dismiss() } }, LinearLayout.LayoutParams(dp(88), dp(44)).apply { rightMargin = dp(8) })
                positiveLabel?.let { label -> addView(chatActionButton(label, accent = true).apply { setOnClickListener { if (onPositive?.invoke() != false) dialog.dismiss() } }, LinearLayout.LayoutParams(dp(92), dp(44))) }
            })
        }
        dialog = Dialog(this)
        dialog.setContentView(panel)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.show()
        dialog.window?.setLayout((resources.displayMetrics.widthPixels * 0.9).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT)
        return dialog
    }

    private fun chatActionButton(label: String, accent: Boolean = false): Button = Button(this).apply {
        text = label; isAllCaps = false; setTextColor(if (accent) Color.rgb(24, 29, 22) else Color.rgb(236, 241, 231)); textSize = 14f
        background = chalkSurface(if (accent) Color.rgb(216, 191, 140) else Color.rgb(31, 54, 47), dp(15))
    }

    private fun addSystemHint(content: String) {
        messageList.addView(TextView(this).apply {
            text = content; textSize = 14f; setTextColor(Color.rgb(193, 207, 192)); setPadding(24, 20, 24, 20)
            background = chalkSurface(Color.rgb(20, 38, 33), 24)
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = 12 })
    }

    private fun addBubble(content: String, isUser: Boolean): TextView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        return TextView(this).apply {
            text = renderChatMessage(content); textSize = 16f; setTextColor(Color.WHITE); setLineSpacing(0f, 1.15f)
            setTextIsSelectable(!isUser)
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = chalkSurface(if (isUser) Color.rgb(58, 85, 128) else Color.rgb(25, 42, 36), dp(20))
            messageList.addView(this, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                gravity = if (isUser) Gravity.END else Gravity.START
                topMargin = dp(8)
                if (isUser) leftMargin = dp(42) else rightMargin = dp(42)
            })
            messageScroll.post { messageScroll.fullScroll(View.FOCUS_DOWN) }
        }
    }

    private fun renderChatMessage(content: String): CharSequence =
        ChatMarkdownRenderer.render(content, resources.displayMetrics.density)

    private fun solid(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat() }

    private fun chalkSurface(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius.toFloat()
        setStroke((resources.displayMetrics.density * 1).toInt(), Color.rgb(53, 77, 68))
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
