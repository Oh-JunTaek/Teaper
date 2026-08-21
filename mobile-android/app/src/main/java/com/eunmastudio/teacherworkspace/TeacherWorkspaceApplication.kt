package com.eunmastudio.teacherworkspace

import android.app.Application
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner

/** 앱이 화면 밖으로 이동하면 선택한 앱 잠금을 다시 요구하도록 프로세스 수명주기를 감시한다. */
class TeacherWorkspaceApplication : Application(), DefaultLifecycleObserver {
    override fun onCreate() {
        super<Application>.onCreate()
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    }

    override fun onStop(owner: LifecycleOwner) {
        if (AppLockGate.isEnabled(this)) AppLockSession.lock()
    }
}
