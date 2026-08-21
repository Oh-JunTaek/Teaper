package com.eunmastudio.teacherworkspace

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

/**
 * 앱 잠금은 자료·문항·대화 화면 위에 차단 화면을 먼저 올린 뒤 기기 인증에 성공할 때만 내용을 표시한다.
 * 인증 정보와 자료 원문은 앱 밖으로 전송하지 않으며, Android 기기 잠금 또는 생체 인증만 재사용한다.
 */
object AppLockPolicy {
    const val PREFERENCES = "teacher_workspace_security_v1"
    const val ENABLED_KEY = "appLockEnabled"
    const val AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL

    fun shouldRequireAuthentication(enabled: Boolean, sessionLocked: Boolean): Boolean = enabled && sessionLocked
}

object AppLockSession {
    @Volatile private var locked: Boolean = true

    fun lock() { locked = true }
    fun unlock() { locked = false }
    fun isLocked(): Boolean = locked
}

class AppLockGate(private val activity: FragmentActivity) {
    private var overlay: View? = null

    fun attach(content: View): FrameLayout {
        val container = FrameLayout(activity).apply { addView(content) }
        overlay = createOverlay()
        container.addView(overlay, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        return container
    }

    fun authenticateIfRequired() {
        if (!AppLockPolicy.shouldRequireAuthentication(isEnabled(activity), AppLockSession.isLocked())) {
            overlay?.visibility = View.GONE
            return
        }
        overlay?.visibility = View.VISIBLE
        val manager = BiometricManager.from(activity)
        if (manager.canAuthenticate(AppLockPolicy.AUTHENTICATORS) != BiometricManager.BIOMETRIC_SUCCESS) {
            setOverlayMessage("기기 인증을 사용할 수 없습니다. Android 설정에서 화면 잠금 또는 생체 인증을 설정한 뒤 다시 시도해 주세요.")
            return
        }
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    AppLockSession.unlock()
                    overlay?.visibility = View.GONE
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    setOverlayMessage("잠금이 해제되지 않았습니다. $errString")
                }

                override fun onAuthenticationFailed() {
                    setOverlayMessage("인증을 확인하지 못했습니다. 다시 시도해 주세요.")
                }
            },
        )
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("문제 출제 워크스페이스 잠금 해제")
                .setSubtitle("자료·문항·대화는 이 기기에만 보관됩니다.")
                .setAllowedAuthenticators(AppLockPolicy.AUTHENTICATORS)
                .build(),
        )
    }

    private fun createOverlay(): LinearLayout {
        val density = activity.resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        return LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(Color.rgb(14, 16, 21))
            tag = "appLockOverlay"
            addView(TextView(activity).apply {
                text = "앱 잠금"; textSize = 28f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
            })
            addView(TextView(activity).apply {
                text = "등록 자료, 문항, 대화 내용을 보려면 이 기기의 잠금을 해제해 주세요."
                textSize = 16f; setTextColor(Color.rgb(193, 203, 219)); gravity = Gravity.CENTER
                setPadding(0, dp(12), 0, dp(20)); tag = "appLockMessage"
            })
            addView(Button(activity).apply {
                text = "잠금 해제"; isAllCaps = false; setTextColor(Color.rgb(14, 16, 21))
                background = surface(Color.rgb(126, 174, 255), dp(22))
                setOnClickListener { authenticateIfRequired() }
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)))
        }
    }

    private fun setOverlayMessage(message: String) {
        overlay?.findViewWithTag<TextView>("appLockMessage")?.text = message
        overlay?.visibility = View.VISIBLE
    }

    private fun surface(color: Int, radius: Int): GradientDrawable = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius.toFloat()
    }

    companion object {
        fun isEnabled(context: Context): Boolean = context.getSharedPreferences(AppLockPolicy.PREFERENCES, Context.MODE_PRIVATE)
            .getBoolean(AppLockPolicy.ENABLED_KEY, false)

        fun setEnabled(context: Context, enabled: Boolean) {
            context.getSharedPreferences(AppLockPolicy.PREFERENCES, Context.MODE_PRIVATE)
                .edit().putBoolean(AppLockPolicy.ENABLED_KEY, enabled).apply()
            if (enabled) AppLockSession.lock() else AppLockSession.unlock()
        }
    }
}
