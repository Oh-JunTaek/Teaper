package com.eunmastudio.teacherworkspace.ai

import android.content.Context

/** 다운로드한 모델 중 교사가 현재 문항 작업에 사용할 모델을 명시적으로 고른다. */
object ModelSelection {
    private const val PREFS = "model_selection_v1"
    private const val KEY_SELECTED_MODEL = "selected_model"

    fun selected(context: Context): GemmaModel? = context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getString(KEY_SELECTED_MODEL, null)
        ?.let { saved -> GemmaModel.entries.firstOrNull { it.name == saved } }

    fun select(context: Context, model: GemmaModel) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_SELECTED_MODEL, model.name)
            .apply()
    }

    fun clearIfSelected(context: Context, model: GemmaModel) {
        if (selected(context) == model) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_SELECTED_MODEL).apply()
        }
    }
}
