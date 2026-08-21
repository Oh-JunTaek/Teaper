package com.eunmastudio.teacherworkspace

import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.eunmastudio.teacherworkspace.ai.ChatPromptMessage
import com.eunmastudio.teacherworkspace.ai.GemmaModel
import com.eunmastudio.teacherworkspace.ai.LiteRtLmRunner
import com.eunmastudio.teacherworkspace.ai.ModelDownloadManager
import com.eunmastudio.teacherworkspace.ai.ModelSelection
import com.eunmastudio.teacherworkspace.ai.TeacherChatPromptContract
import kotlinx.coroutines.launch

/**
 * GPT 형태의 질문·응답 흐름을 제공하되, 모델·대화·자료는 Android 앱 전용 저장소와 LiteRT-LM 안에서만 처리한다.
 */
class TeacherChatActivity : ComponentActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var downloads: ModelDownloadManager
    private lateinit var runner: LiteRtLmRunner
    private lateinit var messageList: LinearLayout
    private lateinit var messageScroll: ScrollView
    private lateinit var input: EditText
    private lateinit var sendButton: Button
    private lateinit var status: TextView
    private lateinit var sourceSwitch: Switch
    private var currentThread: LocalChatThread? = null
    private var activeModel: GemmaModel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = LocalWorkspaceStore(this)
        downloads = ModelDownloadManager(this)
        runner = LiteRtLmRunner(this)
        setContentView(buildScreen())
        loadThread(store.chatThreads().firstOrNull() ?: store.createChatThread())
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
            setPadding(dp(18), dp(18), dp(18), dp(18))
            setBackgroundColor(Color.rgb(14, 16, 21))
            addView(LinearLayout(this@TeacherChatActivity).apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(Button(this@TeacherChatActivity).apply {
                    text = "‹"; textSize = 28f; setTextColor(Color.WHITE); isAllCaps = false
                    background = solid(Color.TRANSPARENT, 0)
                    setOnClickListener { finish() }
                }, LinearLayout.LayoutParams(dp(48), dp(52)))
                addView(LinearLayout(this@TeacherChatActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(this@TeacherChatActivity).apply { text = "온디바이스 AI 채팅"; textSize = 22f; setTextColor(Color.WHITE) })
                    addView(TextView(this@TeacherChatActivity).apply { text = "Gemma 4 · 이 기기에서만 처리"; textSize = 13f; setTextColor(Color.rgb(146, 185, 255)) })
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                addView(Button(this@TeacherChatActivity).apply {
                    text = "대화"; isAllCaps = false; textSize = 13f; setTextColor(Color.WHITE)
                    background = solid(Color.rgb(42, 48, 61), dp(16))
                    setOnClickListener { showThreadPicker() }
                }, LinearLayout.LayoutParams(dp(72), dp(42)))
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            status = TextView(this@TeacherChatActivity).apply {
                text = "일반 질의응답과 자료 기반 출제 보조를 제공합니다. 최종 판단은 교사가 확인합니다."
                textSize = 14f; setTextColor(Color.rgb(190, 200, 216)); setPadding(dp(8), dp(10), dp(8), dp(10))
                background = solid(Color.rgb(28, 34, 45), dp(16))
            }
            addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) })
            sourceSwitch = Switch(this@TeacherChatActivity).apply {
                text = "등록 자료 참고"; textSize = 14f; setTextColor(Color.rgb(214, 221, 232)); isChecked = true
                setPadding(dp(6), dp(6), dp(6), dp(6))
            }
            addView(sourceSwitch)
            messageList = LinearLayout(this@TeacherChatActivity).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(8), 0, dp(8)) }
            messageScroll = ScrollView(this@TeacherChatActivity).apply { addView(messageList) }
            addView(messageScroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(LinearLayout(this@TeacherChatActivity).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.BOTTOM; setPadding(0, dp(8), 0, 0)
                input = EditText(this@TeacherChatActivity).apply {
                    hint = "질문을 입력하세요"; textSize = 16f; minLines = 1; maxLines = 5
                    setTextColor(Color.WHITE); setHintTextColor(Color.rgb(139, 151, 171))
                    background = solid(Color.rgb(36, 41, 52), dp(22)); setPadding(dp(16), dp(10), dp(16), dp(10))
                }
                addView(input, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = dp(8) })
                sendButton = Button(this@TeacherChatActivity).apply {
                    text = "보내기"; isAllCaps = false; setTextColor(Color.rgb(15, 18, 24))
                    background = solid(Color.rgb(126, 174, 255), dp(20)); setOnClickListener { sendMessage() }
                }
                addView(sendButton, LinearLayout.LayoutParams(dp(82), dp(52)))
            })
        }
    }

    private fun loadThread(thread: LocalChatThread) {
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
        store.appendChatMessage(thread.id, content, isUser = true)
        input.setText("")
        addBubble(content, true)
        sendButton.isEnabled = false
        lifecycleScope.launch {
            val ready = ensureModelReady()
            if (!ready) {
                sendButton.isEnabled = true
                return@launch
            }
            val assistantBubble = addBubble("응답을 준비하고 있습니다.", false)
            try {
                val latestThread = store.chatThreads().firstOrNull { it.id == thread.id } ?: thread
                val prompt = TeacherChatPromptContract.conversationPrompt(
                    history = latestThread.messages.map { ChatPromptMessage(it.isUser, it.content) },
                    sourceSummaries = if (sourceSwitch.isChecked) sourceSummaries() else "",
                    teacherInstructions = store.teacherInstructions(),
                )
                val response = StringBuilder()
                runner.generate(prompt) { partial ->
                    response.append(partial)
                    runOnUiThread {
                        assistantBubble.text = response.toString()
                        messageScroll.post { messageScroll.fullScroll(View.FOCUS_DOWN) }
                    }
                }
                store.appendChatMessage(thread.id, response.toString(), isUser = false)
                status.text = "${activeModel?.displayName ?: "로컬 모델"}이 이 기기에서 응답했습니다. 외부 전송을 사용하지 않습니다."
            } catch (error: Throwable) {
                assistantBubble.text = error.message ?: "이 기기에서 응답을 만들지 못했습니다. 모델 상태를 확인해 주세요."
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
            val mode = runner.initialize(downloads.installedFile(selected).absolutePath)
            activeModel = selected
            status.text = "${selected.displayName} 준비 완료 · $mode"
            true
        } catch (error: Throwable) {
            status.text = error.message ?: "모델을 준비하지 못했습니다."
            false
        }
    }

    private fun sourceSummaries(): String = store.sources().joinToString("\n\n") { source ->
        "[${source.kind.label}] ${source.title}${source.pageReferences?.let { " · $it" } ?: ""}\n${source.excerpt}"
    }

    private fun showThreadPicker() {
        val threads = store.chatThreads()
        val container = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(34, 16, 34, 16) }
        container.addView(Button(this).apply {
            text = "+ 새 대화"; isAllCaps = false
            setOnClickListener { loadThread(store.createChatThread()); (parent as? android.app.AlertDialog)?.dismiss() }
        })
        threads.forEach { thread ->
            container.addView(Button(this).apply {
                text = "${thread.title}\n${thread.messages.lastOrNull()?.content?.take(50).orEmpty()}"; isAllCaps = false; gravity = Gravity.START
                setOnClickListener { loadThread(thread); (parent as? android.app.AlertDialog)?.dismiss() }
            })
        }
        val dialog = android.app.AlertDialog.Builder(this)
            .setTitle("대화 기록 · 이 기기에만 보관")
            .setView(ScrollView(this).apply { addView(container) })
            .setNegativeButton("닫기", null)
            .setNeutralButton("현재 대화 삭제") { _, _ ->
                currentThread?.let { store.deleteChatThread(it.id) }
                loadThread(store.createChatThread())
            }
            .create()
        dialog.show()
    }

    private fun addSystemHint(content: String) {
        messageList.addView(TextView(this).apply {
            text = content; textSize = 14f; setTextColor(Color.rgb(188, 198, 214)); setPadding(24, 20, 24, 20)
            background = solid(Color.rgb(29, 34, 44), 24)
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = 12 })
    }

    private fun addBubble(content: String, isUser: Boolean): TextView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        return TextView(this).apply {
            text = content; textSize = 16f; setTextColor(Color.WHITE); setLineSpacing(0f, 1.1f)
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = solid(if (isUser) Color.rgb(66, 101, 171) else Color.rgb(38, 43, 54), dp(20))
            messageList.addView(this, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                gravity = if (isUser) Gravity.END else Gravity.START
                topMargin = dp(8)
                if (isUser) leftMargin = dp(42) else rightMargin = dp(42)
            })
            messageScroll.post { messageScroll.fullScroll(View.FOCUS_DOWN) }
        }
    }

    private fun solid(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat() }
}
