package com.eunmastudio.teacherworkspace

import android.Manifest
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

/** 일정은 이 기기에만 보관하고, 교사가 허용하면 시간 있는 예정 일정의 제목만 운영체제 알림으로 표시한다. */
class ScheduleActivity : AppCompatActivity() {
    private lateinit var store: LocalWorkspaceStore
    private lateinit var list: LinearLayout
    private lateinit var titleInput: EditText
    private lateinit var dateInput: EditText
    private lateinit var timeInput: EditText
    private lateinit var typeInput: Spinner
    private lateinit var noteInput: EditText
    private lateinit var completeInput: CheckBox
    private lateinit var reminderInput: CheckBox
    private lateinit var holidayViewInput: CheckBox
    private lateinit var calendarGrid: GridLayout
    private lateinit var calendarTitle: TextView
    private lateinit var appLockGate: AppLockGate
    private var editingId: String? = null
    private val calendarMonth = Calendar.getInstance()

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
        content.addView(LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; addView(TextView(this@ScheduleActivity).apply { text = "시험일·일정"; textSize = 26f; setTextColor(Color.rgb(244, 241, 229)); setTypeface(typeface, android.graphics.Typeface.BOLD) }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)); addView(button("날짜 보기").apply { setOnClickListener { chooseDateSummary() } }, LinearLayout.LayoutParams(dp(92), dp(44))); addView(button("닫기").apply { setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(76), dp(44)).apply { leftMargin = dp(6) }) })
        content.addView(TextView(this).apply { text = "시험일과 업무 계획은 이 기기 안에만 저장됩니다. 외부 캘린더·AI 요청에는 자동으로 전송하지 않습니다."; textSize = 14f; setTextColor(Color.rgb(185, 205, 191)); setPadding(0, dp(8), 0, dp(16)) })
        calendarTitle = TextView(this).apply { gravity = Gravity.CENTER; textSize = 17f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) }
        content.addView(LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; addView(button("‹").apply { setOnClickListener { calendarMonth.add(Calendar.MONTH, -1); renderCalendar() } }, LinearLayout.LayoutParams(dp(44), dp(40))); addView(calendarTitle, LinearLayout.LayoutParams(0, dp(40), 1f)); addView(button("›").apply { setOnClickListener { calendarMonth.add(Calendar.MONTH, 1); renderCalendar() } }, LinearLayout.LayoutParams(dp(44), dp(40))) })
        holidayViewInput = CheckBox(this).apply { text = "공휴일 보기"; isChecked = true; setTextColor(Color.rgb(218, 230, 217)); setOnCheckedChangeListener { _, _ -> renderCalendar() } }
        content.addView(holidayViewInput, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        calendarGrid = GridLayout(this).apply { columnCount = 7; rowCount = 7; setPadding(0, dp(4), 0, dp(14)) }
        content.addView(calendarGrid, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        titleInput = input("일정 제목 · 예: 2학년 화학 I 중간고사")
        dateInput = input("날짜").apply { isFocusable = false; setOnClickListener { chooseDate() } }
        timeInput = input("시간 (선택) · 예: 09:00")
        typeInput = Spinner(this).apply { adapter = ArrayAdapter(this@ScheduleActivity, android.R.layout.simple_spinner_dropdown_item, listOf("시험일", "마감", "회의", "검수", "기타")); background = surface(Color.rgb(15, 29, 25), dp(16)); setPadding(dp(10), 0, dp(10), 0) }
        noteInput = input("준비할 사항이나 간단한 메모 (선택)").apply { minLines = 3; gravity = Gravity.TOP }
        completeInput = CheckBox(this).apply { text = "완료한 일정"; setTextColor(Color.rgb(218, 230, 217)) }
        reminderInput = CheckBox(this).apply { text = "시간이 있는 예정 일정을 이 기기에서 알림으로 받기"; isChecked = store.scheduleNotificationsEnabled(); setTextColor(Color.rgb(218, 230, 217)); setOnCheckedChangeListener { _, enabled -> setReminderEnabled(enabled) } }
        listOf(titleInput, dateInput, timeInput, typeInput, noteInput, completeInput, reminderInput).forEach { view -> content.addView(view, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) }) }
        content.addView(TextView(this).apply { text = "알림에는 일정 제목만 표시됩니다. 일정 메모·문항·자료 원문은 표시하거나 전송하지 않습니다."; textSize = 12f; setTextColor(Color.rgb(164, 187, 170)); setPadding(dp(4), 0, dp(4), dp(10)) })
        content.addView(LinearLayout(this).apply { addView(button("일정 저장", true).apply { setOnClickListener { saveCurrent() } }, LinearLayout.LayoutParams(0, dp(48), 1f)); addView(button("새 일정").apply { setOnClickListener { clearForm() } }, LinearLayout.LayoutParams(dp(104), dp(48)).apply { leftMargin = dp(8) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(4); bottomMargin = dp(18) })
        content.addView(TextView(this).apply { text = "다가오는 일정"; textSize = 18f; setTextColor(Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) })
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(6), 0, 0) }; content.addView(list)
        renderCalendar()
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

    /** Android 기본 달력에서 날짜를 고르면 당일 공휴일·일정을 먼저 확인하고, 비어 있으면 바로 추가할 수 있다. */
    private fun chooseDateSummary() {
        val calendar = Calendar.getInstance()
        DatePickerDialog(this, { _, year, month, day ->
            val selected = String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day)
            showDateSummary(selected)
        }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH)).show()
    }

    /** 달력의 날짜를 누르면 그날의 일정·공휴일을 먼저 보이고, 비어 있어도 바로 추가할 수 있게 한다. */
    private fun showDateSummary(selected: String) {
        val items = store.schedules().filter { it.scheduleDate == selected }
        val holiday = if (holidayViewInput.isChecked) koreanHolidayName(selected) else null
        val lines = buildList { if (holiday != null) add("공휴일: $holiday"); if (items.isEmpty()) add("등록한 일정이 없습니다.") else addAll(items.map { "• ${it.title}${if (it.scheduleTime.isBlank()) "" else " · ${it.scheduleTime}"}" }) }
        AlertDialog.Builder(this).setTitle("$selected 일정").setMessage(lines.joinToString("\n")).setPositiveButton("이 날짜에 추가") { _, _ -> clearForm(); dateInput.setText(selected); titleInput.requestFocus() }.setNegativeButton("닫기", null).show()
    }

    /** 월간 달력은 일요일·공휴일을 붉게 표시하고, 일정의 첫 제목만 요약해 날짜를 빠르게 고르게 한다. */
    private fun renderCalendar() {
        if (!::calendarGrid.isInitialized) return
        val density = resources.displayMetrics.density; fun dp(value: Int) = (value * density).toInt()
        val cellWidth = ((resources.displayMetrics.widthPixels - dp(40)) / 7).coerceAtLeast(dp(38))
        calendarTitle.text = String.format(Locale.KOREA, "%d년 %d월", calendarMonth.get(Calendar.YEAR), calendarMonth.get(Calendar.MONTH) + 1)
        calendarGrid.removeAllViews()
        listOf("일", "월", "화", "수", "목", "금", "토").forEachIndexed { index, label -> calendarGrid.addView(TextView(this).apply { text = label; gravity = Gravity.CENTER; textSize = 12f; setTextColor(if (index == 0) Color.rgb(222, 102, 102) else Color.rgb(174, 196, 181)) }, ViewGroup.LayoutParams(cellWidth, dp(28))) }
        val first = Calendar.getInstance().apply { timeInMillis = calendarMonth.timeInMillis; set(Calendar.DAY_OF_MONTH, 1) }.get(Calendar.DAY_OF_WEEK) - 1
        repeat(first) { calendarGrid.addView(TextView(this), ViewGroup.LayoutParams(cellWidth, dp(58))) }
        val maximum = calendarMonth.getActualMaximum(Calendar.DAY_OF_MONTH)
        val scheduled = store.schedules().groupBy { it.scheduleDate }
        for (day in 1..maximum) {
            val date = String.format(Locale.US, "%04d-%02d-%02d", calendarMonth.get(Calendar.YEAR), calendarMonth.get(Calendar.MONTH) + 1, day)
            val holiday = if (holidayViewInput.isChecked) koreanHolidayName(date) else null
            val sunday = (first + day - 1) % 7 == 0
            val firstTitle = scheduled[date]?.firstOrNull()?.title.orEmpty()
            calendarGrid.addView(TextView(this).apply { text = buildString { append(day); if (holiday != null) append("\n$holiday"); if (firstTitle.isNotBlank()) append("\n$firstTitle") }; gravity = Gravity.TOP; textSize = 11f; maxLines = 3; setPadding(dp(4), dp(4), dp(2), dp(2)); setTextColor(if (sunday || holiday != null) Color.rgb(222, 102, 102) else Color.rgb(235, 241, 235)); background = surface(Color.rgb(21, 38, 32), dp(8)); setOnClickListener { showDateSummary(date) } }, ViewGroup.LayoutParams(cellWidth, dp(58)))
        }
    }

    /** 공휴일은 2026년 기본값을 앱에 포함해 외부 요청 없이 표시하고, 법령 변경 때 앱 업데이트로 갱신한다. */
    private fun koreanHolidayName(date: String): String? = mapOf(
        "2026-01-01" to "1월 1일", "2026-02-16" to "설날 전날", "2026-02-17" to "설날", "2026-02-18" to "설날 다음 날", "2026-03-01" to "3·1절", "2026-03-02" to "대체공휴일", "2026-05-01" to "노동절", "2026-05-05" to "어린이날", "2026-05-24" to "부처님 오신 날", "2026-05-25" to "대체공휴일", "2026-06-03" to "전국동시지방선거", "2026-06-06" to "현충일", "2026-07-17" to "제헌절", "2026-08-15" to "광복절", "2026-08-17" to "대체공휴일", "2026-09-24" to "추석 전날", "2026-09-25" to "추석", "2026-09-26" to "추석 다음 날", "2026-10-03" to "개천절", "2026-10-05" to "대체공휴일", "2026-10-09" to "한글날", "2026-12-25" to "기독탄신일"
    )[date]

    private fun refreshList() {
        if (!::list.isInitialized) return; val density = resources.displayMetrics.density; fun dp(value: Int) = (value * density).toInt(); list.removeAllViews()
        val schedules = store.schedules(); ScheduleReminder.sync(this, schedules, store.scheduleNotificationsEnabled()); if (schedules.isEmpty()) list.addView(TextView(this).apply { text = "아직 등록한 일정이 없습니다. 시험일이나 검수 마감을 먼저 추가해 보세요."; setTextColor(Color.rgb(181, 200, 185)); setPadding(dp(4), dp(12), dp(4), dp(12)) })
        schedules.forEach { item -> list.addView(LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(12)); background = surface(Color.rgb(22, 38, 33), dp(20)); addView(TextView(this@ScheduleActivity).apply { text = "[${item.status}] ${item.title}"; textSize = 17f; setTextColor(if (item.status == "완료") Color.rgb(160, 177, 165) else Color.WHITE); setTypeface(typeface, android.graphics.Typeface.BOLD) }); addView(TextView(this@ScheduleActivity).apply { text = "${item.scheduleDate}${if (item.scheduleTime.isBlank()) "" else " · ${item.scheduleTime}"} · ${item.eventType}"; textSize = 13f; setTextColor(Color.rgb(177, 199, 183)); setPadding(0, dp(4), 0, dp(5)) }); if (item.note.isNotBlank()) addView(TextView(this@ScheduleActivity).apply { text = item.note; textSize = 14f; setTextColor(Color.rgb(201, 215, 202)); maxLines = 3 }); addView(LinearLayout(this@ScheduleActivity).apply { addView(button("수정").apply { setOnClickListener { editingId = item.id; titleInput.setText(item.title); dateInput.setText(item.scheduleDate); timeInput.setText(item.scheduleTime); typeInput.setSelection(listOf("시험일", "마감", "회의", "검수", "기타").indexOf(item.eventType).coerceAtLeast(0)); noteInput.setText(item.note); completeInput.isChecked = item.status == "완료" } }, LinearLayout.LayoutParams(dp(78), dp(38))); addView(button(if (item.status == "완료") "미완료" else "완료").apply { setOnClickListener { store.saveSchedule(item.copy(status = if (item.status == "완료") "예정" else "완료", updatedAt = System.currentTimeMillis())); refreshList() } }, LinearLayout.LayoutParams(dp(78), dp(38)).apply { leftMargin = dp(8) }); addView(button("삭제").apply { setOnClickListener { store.deleteSchedule(item.id); refreshList() } }, LinearLayout.LayoutParams(dp(70), dp(38)).apply { leftMargin = dp(8) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) }) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(10) }) }
        renderCalendar()
    }

    private fun clearForm() { editingId = null; titleInput.text.clear(); dateInput.text.clear(); timeInput.text.clear(); noteInput.text.clear(); typeInput.setSelection(0); completeInput.isChecked = false }
    private fun setReminderEnabled(enabled: Boolean) {
        if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 410)
            return
        }
        store.setScheduleNotificationsEnabled(enabled)
        ScheduleReminder.sync(this, store.schedules(), enabled)
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != 410) return
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        store.setScheduleNotificationsEnabled(granted)
        if (!granted) reminderInput.isChecked = false
        ScheduleReminder.sync(this, store.schedules(), granted)
    }
    private fun input(hint: String) = EditText(this).apply { this.hint = hint; setHintTextColor(Color.rgb(145, 165, 151)); setTextColor(Color.WHITE); background = surface(Color.rgb(15, 29, 25), (resources.displayMetrics.density * 16).toInt()); setPadding((resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt(), (resources.displayMetrics.density * 16).toInt(), (resources.displayMetrics.density * 12).toInt()) }
    private fun button(label: String, accent: Boolean = false) = Button(this).apply { text = label; isAllCaps = false; textSize = 14f; setTextColor(if (accent) Color.rgb(20, 28, 23) else Color.rgb(232, 239, 231)); background = surface(if (accent) Color.rgb(216, 191, 140) else Color.rgb(32, 54, 47), (resources.displayMetrics.density * 15).toInt()) }
    private fun surface(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat(); setStroke(resources.displayMetrics.density.toInt(), Color.rgb(51, 75, 67)) }
}
