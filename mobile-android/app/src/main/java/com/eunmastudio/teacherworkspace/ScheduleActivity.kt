package com.eunmastudio.teacherworkspace

import android.app.DatePickerDialog
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

/** 시험일·마감·회의를 이 기기 안에서만 기록하는 교사용 일정 화면이다. 백그라운드 알림이나 외부 동기화는 하지 않는다. */
class ScheduleActivity : AppCompatActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var list: LinearLayout
    private lateinit var titleInput: EditText
    private lateinit var dateInput: EditText
    private lateinit var timeInput: EditText
    private lateinit var typeInput: Spinner
    private lateinit var noteInput: EditText
    private lateinit var completeInput: CheckBox
    private lateinit var appLockGate: AppLockGate
    private var editingId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(10, 20, 18); window.navigationBarColor = Color.rgb(10, 20, 18)
        store = LocalWorkspaceStore(this)
        val screen = buildScreen(); appLockGate = AppLockGate(this); setContentView(appLockGate.attach(screen))
        ViewCompat.setOnApplyWindowInsetsListener(screen) { view, insets -> val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()); view.setPadding(0, bars.top, 0, bars.bottom); insets }
    }

    override fun onResume() { super.onResume(); if (::appLockGate.isInitialized) appLockGate.authenticateIfRequired(); refreshList() }

    private fun buildScreen(): ScrollView {
        val density = resources.displayMetrics.density; fun dp(value: Int) = (value * density).toInt()
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(22), dp(20), dp(30)); setBackgroundColor(Color.rgb(10, 20, 18)) }
        content.addView(LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; addView(TextView(this@ScheduleActivity).apply { text = "시험일·일정"; textSize = 26f; setTextColor(Color.rgb(244, 241, 229)); setTypeface(typeface, android.graphics.Typeface.BOLD) }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)); addView(button("닫기").apply { setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(76), dp(44))) })
        content.addView(TextView(this).apply { text = "시험일과 업무 계획은 이 기기 안에만 저장됩니다. 외부 캘린더·AI 요청에는 자동으로 전송하지 않습니다."; textSize = 14f; setTextColor(Color.rgb(185, 205, 191)); setPadding(0, dp(8), 0, dp(16)) })
        titleInput = input("일정 제목 · 예: 2학년 화학 I 중간고사")
        dateInput = input("날짜").apply { isFocusable = false; setOnClickListener { chooseDate() } }
        timeInput = input("시간 (선택) · 예: 09:00")
        typeInput = Spinner(this).apply { adapter = ArrayAdapter(this@ScheduleActivity, android.R.layout.simple_spinner_dropdown_item, listOf("시험일", "마감", "회의", "검수", "기타")); background = surface(Color.rgb(15, 29, 25), dp(16)); setPadding(dp(10), 0, dp(10), 0) }
        noteInput = input("준비할 사항이나 간단한 메모 (선택)").apply { minLines = 3; gravity = Gravity.TOP }
        completeInput = CheckBox(this).apply { text = "완료한 일정"; setTextColor(Color.rgb(218, 230, 217)) }
        listOf(titleInput, dateInput, timeInput, typeInput, noteInput, completeInput).forEach { view -> content.addView(view, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) }) }
        content.addView(LinearLayout(this).apply { addView(button("일정 저장", true).apply { setOnClickListener { saveCurrent() } }, LinearLayout.LayoutParams(0, dp(48), 1f)); addView(button("새 일정").apply { setOnClickListener { clearForm() } }, LinearLayout.LayoutParams(dp(104), dp(48)).apply { leftMargin = dp(8) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(4); bottomMargin = dp(18) })
        content.addView(TextView(this).apply { text = "다가오는 일정"; textSize = 18f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) })
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(6), 0, 0) }; content.addView(list)
        return ScrollView(this).apply { addView(content) }
    }

    private fun saveCurrent() {
        val title = titleInput.text.toString().trim(); val date = dateInput.text.toString().trim()
        if (title.isBlank() || !Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date)) return
        val existing = store.schedules().firstOrNull { it.id == editingId }
        store.saveSchedule(LocalScheduleItem(id = editingId ?: UUID.randomUUID().toString(), title = title, scheduleDate = date, scheduleTime = timeInput.text.toString().trim(), eventType = typeInput.selectedItem.toString(), note = noteInput.text.toString().trim(), status = if (completeInput.isChecked) "완료" else "예정", createdAt = existing?.createdAt ?: System.currentTimeMillis(), updatedAt = System.currentTimeMillis()))
        clearForm(); refreshList()
    }

    private fun chooseDate() {
        val parts = dateInput.text.toString().split("-").mapNotNull { it.toIntOrNull() }; val calendar = Calendar.getInstance()
        val year = parts.getOrNull(0) ?: calendar.get(Calendar.YEAR); val month = (parts.getOrNull(1) ?: calendar.get(Calendar.MONTH) + 1) - 1; val day = parts.getOrNull(2) ?: calendar.get(Calendar.DAY_OF_MONTH)
        DatePickerDialog(this, { _, selectedYear, selectedMonth, selectedDay -> dateInput.setText(String.format(Locale.US, "%04d-%02d-%02d", selectedYear, selectedMonth + 1, selectedDay)) }, year, month, day).show()
    }

    private fun refreshList() {
        if (!::list.isInitialized) return; val density = resources.displayMetrics.density; fun dp(value: Int) = (value * density).toInt(); list.removeAllViews()
        val schedules = store.schedules(); if (schedules.isEmpty()) list.addView(TextView(this).apply { text = "아직 등록한 일정이 없습니다. 시험일이나 검수 마감을 먼저 추가해 보세요."; setTextColor(Color.rgb(181, 200, 185)); setPadding(dp(4), dp(12), dp(4), dp(12)) })
        schedules.forEach { item -> list.addView(LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(12)); background = surface(Color.rgb(22, 38, 33), dp(20)); addView(TextView(this@ScheduleActivity).apply { text = "[${item.status}] ${item.title}"; textSize = 17f; setTextColor(if (item.status == "완료") Color.rgb(160, 177, 165) else Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) }); addView(TextView(this@ScheduleActivity).apply { text = "${item.scheduleDate}${if (item.scheduleTime.isBlank()) "" else " · ${item.scheduleTime}"} · ${item.eventType}"; textSize = 13f; setTextColor(Color.rgb(177, 199, 183)); setPadding(0, dp(4), 0, dp(5)) }); if (item.note.isNotBlank()) addView(TextView(this@ScheduleActivity).apply { text = item.note; textSize = 14f; setTextColor(Color.rgb(201, 215, 202)); maxLines = 3 }); addView(LinearLayout(this@ScheduleActivity).apply { addView(button("수정").apply { setOnClickListener { editingId = item.id; titleInput.setText(item.title); dateInput.setText(item.scheduleDate); timeInput.setText(item.scheduleTime); typeInput.setSelection(listOf("시험일", "마감", "회의", "검수", "기타").indexOf(item.eventType).coerceAtLeast(0)); noteInput.setText(item.note); completeInput.isChecked = item.status == "완료" } }, LinearLayout.LayoutParams(dp(78), dp(38))); addView(button(if (item.status == "완료") "미완료" else "완료").apply { setOnClickListener { store.saveSchedule(item.copy(status = if (item.status == "완료") "예정" else "완료", updatedAt = System.currentTimeMillis())); refreshList() } }, LinearLayout.LayoutParams(dp(78), dp(38)).apply { leftMargin = dp(8) }); addView(button("삭제").apply { setOnClickListener { store.deleteSchedule(item.id); refreshList() } }, LinearLayout.LayoutParams(dp(70), dp(38)).apply { leftMargin = dp(8) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) }) }
    }

    private fun clearForm() { editingId = null; titleInput.text.clear(); dateInput.text.clear(); timeInput.text.clear(); noteInput.text.clear(); typeInput.setSelection(0); completeInput.isChecked = false }
    private fun input(hint: String) = EditText(this).apply { this.hint = hint; setHintTextColor(Color.rgb(145, 165, 151)); setTextColor(Color.WHITE); background = surface(Color.rgb(15, 29, 25), (resources.displayMetrics.density * 16).toInt()); setPadding((resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt(), (resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt()) }
    private fun button(label: String, accent: Boolean = false) = Button(this).apply { text = label; isAllCaps = false; textSize = 14f; setTextColor(if (accent) Color.rgb(20, 28, 23) else Color.rgb(232, 239, 231)); background = surface(if (accent) Color.rgb(216, 191, 140) else Color.rgb(32, 54, 47), (resources.displayMetrics.density * 15).toInt()) }
    private fun surface(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat(); setStroke(resources.displayMetrics.density.toInt(), Color.rgb(51, 75, 67)) }
}
