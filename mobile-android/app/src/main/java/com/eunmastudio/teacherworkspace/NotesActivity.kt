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
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/** 교사의 작업 메모를 AI 요청과 분리해 기기 내에서만 관리하는 전용 화면이다. */
class NotesActivity : AppCompatActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var list: LinearLayout
    private lateinit var titleInput: EditText
    private lateinit var contentInput: EditText
    private lateinit var pinnedInput: android.widget.CheckBox
    private lateinit var appLockGate: AppLockGate
    private var editingId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(10, 20, 18)
        window.navigationBarColor = Color.rgb(10, 20, 18)
        store = LocalWorkspaceStore(this)
        val screen = buildScreen()
        appLockGate = AppLockGate(this)
        setContentView(appLockGate.attach(screen))
        ViewCompat.setOnApplyWindowInsetsListener(screen) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
    }

    override fun onResume() { super.onResume(); if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired(); refreshList() }

    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(22), dp(20), dp(30)); setBackgroundColor(Color.rgb(10, 20, 18)) }
        content.addView(LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; addView(TextView(this@NotesActivity).apply { text = "메모장"; textSize = 26f; setTextColor(Color.rgb(244, 241, 229)); setTypeface(typeface, android.graphics.Typeface.BOLD) }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)); addView(button("닫기").apply { setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(76), dp(44))) })
        content.addView(TextView(this).apply { text = "작업 메모는 이 기기 안에만 저장되며 AI 문항·쪽지시험 요청에 자동으로 포함되지 않습니다."; textSize = 14f; setTextColor(Color.rgb(185, 205, 191)); setPadding(0, dp(8), 0, dp(16)) })
        titleInput = EditText(this).apply { hint = "메모 제목"; setHintTextColor(Color.rgb(145, 165, 151)); setTextColor(Color.WHITE); background = surface(Color.rgb(15, 29, 25), dp(16)); setPadding(dp(16), dp(12), dp(16), dp(12)) }
        contentInput = EditText(this).apply { hint = "수업 메모, 문항 아이디어, 검수할 사항"; minLines = 5; gravity = Gravity.TOP; setHintTextColor(Color.rgb(145, 165, 151)); setTextColor(Color.WHITE); background = surface(Color.rgb(15, 29, 25), dp(16)); setPadding(dp(16), dp(12), dp(16), dp(12)) }
        pinnedInput = android.widget.CheckBox(this).apply { text = "상단에 고정"; setTextColor(Color.rgb(218, 230, 217)) }
        content.addView(titleInput, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
        content.addView(contentInput, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(6) })
        content.addView(pinnedInput)
        content.addView(LinearLayout(this).apply { addView(button("메모 저장", true).apply { setOnClickListener { val name = titleInput.text.toString().trim(); val text = contentInput.text.toString().trim(); if (name.isBlank() || text.isBlank()) return@setOnClickListener; val existing = store.notes().firstOrNull { it.id == editingId }; store.saveNote(LocalNote(id = editingId ?: java.util.UUID.randomUUID().toString(), title = name, content = text, isPinned = pinnedInput.isChecked, createdAt = existing?.createdAt ?: System.currentTimeMillis(), updatedAt = System.currentTimeMillis())); editingId = null; titleInput.text.clear(); contentInput.text.clear(); pinnedInput.isChecked = false; refreshList() } }, LinearLayout.LayoutParams(0, dp(48), 1f)); addView(button("새 메모").apply { setOnClickListener { editingId = null; titleInput.text.clear(); contentInput.text.clear(); pinnedInput.isChecked = false } }, LinearLayout.LayoutParams(dp(104), dp(48)).apply { leftMargin = dp(8) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8); bottomMargin = dp(18) })
        content.addView(TextView(this).apply { text = "저장한 메모"; textSize = 18f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) })
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(6), 0, 0) }
        content.addView(list)
        return ScrollView(this).apply { addView(content) }
    }

    private fun refreshList() {
        if (!::list.isInitialized) return
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        list.removeAllViews()
        if (store.notes().isEmpty()) list.addView(TextView(this).apply { text = "아직 저장한 메모가 없습니다."; setTextColor(Color.rgb(181, 200, 185)); setPadding(dp(4), dp(12), dp(4), dp(12)) })
        store.notes().forEach { note ->
            list.addView(LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(12)); background = surface(Color.rgb(22, 38, 33), dp(20)); addView(TextView(this@NotesActivity).apply { text = "${if (note.isPinned) "📌 " else ""}${note.title}"; textSize = 17f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) }); addView(TextView(this@NotesActivity).apply { text = note.content; textSize = 14f; setTextColor(Color.rgb(193, 210, 196)); maxLines = 5; setPadding(0, dp(6), 0, dp(6)) }); addView(LinearLayout(this@NotesActivity).apply { addView(button("수정").apply { setOnClickListener { editingId = note.id; titleInput.setText(note.title); contentInput.setText(note.content); pinnedInput.isChecked = note.isPinned } }, LinearLayout.LayoutParams(dp(78), dp(38))); addView(button("삭제").apply { setOnClickListener { store.deleteNote(note.id); refreshList() } }, LinearLayout.LayoutParams(dp(78), dp(38)).apply { leftMargin = dp(8) }) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) })
        }
    }

    private fun button(label: String, accent: Boolean = false) = Button(this).apply { text = label; isAllCaps = false; textSize = 14f; setTextColor(if (accent) Color.rgb(20, 28, 23) else Color.rgb(232, 239, 231)); background = surface(if (accent) Color.rgb(216, 191, 140) else Color.rgb(32, 54, 47), (resources.displayMetrics.density * 15).toInt()) }
    private fun surface(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat(); setStroke((resources.displayMetrics.density).toInt(), Color.rgb(51, 75, 67)) }
}
