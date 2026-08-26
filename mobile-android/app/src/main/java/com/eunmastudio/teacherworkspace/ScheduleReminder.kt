package com.eunmastudio.teacherworkspace

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.Calendar

/** 일정 제목만 기기 알림으로 전달한다. 메모·문항·자료 원문은 알림에 포함하지 않는다. */
object ScheduleReminder {
    private const val CHANNEL_ID = "teacher_schedule_reminder"
    private const val ACTION_REMIND = "com.eunmastudio.teacherworkspace.SCHEDULE_REMIND"
    private const val EXTRA_ID = "schedule_id"
    private const val EXTRA_TITLE = "schedule_title"

    fun sync(context: Context, items: List<LocalScheduleItem>, enabled: Boolean) {
        items.forEach { cancel(context, it.id) }
        if (!enabled) return
        items.forEach { schedule(context, it) }
    }

    fun schedule(context: Context, item: LocalScheduleItem) {
        if (item.status != "예정" || !Regex("^\\d{2}:\\d{2}$").matches(item.scheduleTime)) return
        val moment = runCatching {
            val date = item.scheduleDate.split("-").map { it.toInt() }; val time = item.scheduleTime.split(":").map { it.toInt() }
            Calendar.getInstance().apply { set(date[0], date[1] - 1, date[2], time[0], time[1], 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        }.getOrNull() ?: return
        if (moment <= System.currentTimeMillis()) return
        val pending = pendingIntent(context, item.id, item.title)
        context.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, moment, pending)
    }

    fun cancel(context: Context, id: String) {
        val pending = pendingIntent(context, id, "")
        context.getSystemService(AlarmManager::class.java).cancel(pending)
        pending.cancel()
    }

    private fun pendingIntent(context: Context, id: String, title: String): PendingIntent = PendingIntent.getBroadcast(context, id.hashCode(), Intent(context, ScheduleReminderReceiver::class.java).setAction(ACTION_REMIND).putExtra(EXTRA_ID, id).putExtra(EXTRA_TITLE, title), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun show(context: Context, title: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "시험일·일정", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "교사가 직접 등록한 시험일과 업무 일정"; setShowBadge(false) })
        val open = PendingIntent.getActivity(context, 0, Intent(context, ScheduleActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        manager.notify(title.hashCode(), NotificationCompat.Builder(context, CHANNEL_ID).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("교사도우미 일정").setContentText(title.take(160)).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).setContentIntent(open).build())
    }
}

/** 알림 시각에만 실행되어 제목을 표시하며, 일정 내용을 서버나 다른 앱으로 전송하지 않는다. */
class ScheduleReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { ScheduleReminder.show(context, intent.getStringExtra("schedule_title").orEmpty()) }
}

/** 기기 재부팅 뒤에도 교사가 허용한 미래 일정만 다시 예약한다. */
class ScheduleReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { val store = LocalWorkspaceStore(context); ScheduleReminder.sync(context, store.schedules(), store.scheduleNotificationsEnabled()) }
}
