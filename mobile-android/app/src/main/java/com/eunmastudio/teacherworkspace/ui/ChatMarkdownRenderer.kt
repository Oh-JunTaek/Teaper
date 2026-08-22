package com.eunmastudio.teacherworkspace.ui

import android.graphics.Color
import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.BackgroundColorSpan
import android.text.style.BulletSpan
import android.text.style.ForegroundColorSpan
import android.text.style.QuoteSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan

/** 외부 HTML·스크립트를 해석하지 않고 읽기용 Markdown 일부만 Android Span으로 표시한다. */
object ChatMarkdownRenderer {
    fun plainText(markdown: String): String = markdown
        .replace("\r\n", "\n")
        .replace(Regex("(?m)^#{1,3}\\s+"), "")
        .replace(Regex("(?m)^\\s*[-*+]\\s+"), "• ")
        .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
        .replace(Regex("`([^`]+)`"), "$1")

    fun render(markdown: String, density: Float): CharSequence {
        val output = SpannableStringBuilder()
        markdown.replace("\r\n", "\n").lines().forEachIndexed { index, raw ->
            val start = output.length
            when {
                raw.startsWith("# ") -> output.append(raw.removePrefix("# "))
                raw.startsWith("## ") -> output.append(raw.removePrefix("## "))
                raw.startsWith("### ") -> output.append(raw.removePrefix("### "))
                raw.trimStart().startsWith(">") -> output.append(raw.trimStart().removePrefix(">").trimStart())
                raw.trimStart().startsWith("- ") || raw.trimStart().startsWith("* ") -> output.append("• ${raw.trimStart().drop(2)}")
                else -> output.append(raw)
            }
            applyInline(output, start, output.length)
            val end = output.length
            when {
                raw.startsWith("# ") -> heading(output, start, end, 1.20f)
                raw.startsWith("## ") -> heading(output, start, end, 1.12f)
                raw.startsWith("### ") -> heading(output, start, end, 1.05f)
                raw.trimStart().startsWith(">") -> output.setSpan(QuoteSpan(Color.rgb(119, 151, 211)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                raw.trimStart().startsWith("- ") || raw.trimStart().startsWith("* ") -> output.setSpan(BulletSpan((density * 10).toInt(), Color.rgb(145, 180, 247)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            if (index < markdown.lines().lastIndex) output.append('\n')
        }
        return output
    }

    private fun applyInline(output: SpannableStringBuilder, start: Int, end: Int) {
        val value = output.substring(start, end)
        Regex("\\*\\*(.+?)\\*\\*").findAll(value).toList().asReversed().forEach { match ->
            val from = start + match.range.first
            val to = start + match.range.last + 1
            output.replace(from, to, match.groupValues[1])
            output.setSpan(StyleSpan(Typeface.BOLD), from, from + match.groupValues[1].length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        Regex("`([^`]+)`").findAll(output.substring(start, output.length)).toList().asReversed().forEach { match ->
            val from = start + match.range.first
            output.replace(from, start + match.range.last + 1, match.groupValues[1])
            output.setSpan(TypefaceSpan(Typeface.MONOSPACE), from, from + match.groupValues[1].length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            output.setSpan(BackgroundColorSpan(Color.rgb(24, 31, 43)), from, from + match.groupValues[1].length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }

    private fun heading(output: SpannableStringBuilder, start: Int, end: Int, scale: Float) {
        output.setSpan(StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        output.setSpan(RelativeSizeSpan(scale), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        output.setSpan(ForegroundColorSpan(Color.WHITE), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
}
