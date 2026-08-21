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
import android.text.style.UnderlineSpan
import kotlin.math.roundToInt

/**
 * 외부 HTML·스크립트를 해석하지 않고, 대화에 필요한 Markdown 일부만 Android Span으로 표시한다.
 * 지원 범위는 제목, 목록, 굵은 글씨, 인라인 코드, 인용문, 코드 블록, 표시용 링크이다.
 */
object ChatMarkdownRenderer {
    private val orderedItem = Regex("^\\s*(\\d+)\\.\\s+(.+)$")
    private val unorderedItem = Regex("^\\s*[-*+]\\s+(.+)$")
    private val link = Regex("\\[([^]]+)]\\((https?://[^)\\s]+)\\)")

    /** Android Span을 만들지 않는 순수 텍스트 경로로, 단위 테스트와 접근성 대체 텍스트에 사용한다. */
    fun plainText(markdown: String): String = markdown
        .replace("\r\n", "\n")
        .replace(Regex("(?m)^\\s*```[^\\n]*\\n?"), "")
        .replace(Regex("(?m)^#{1,3}\\s+"), "")
        .replace(Regex("(?m)^\\s*[-*+]\\s+"), "• ")
        .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
        .replace(Regex("`([^`]+)`"), "$1")
        .replace(Regex("\\[([^]]+)]\\((https?://[^)\\s]+)\\)"), "$1")

    fun render(markdown: String, density: Float): CharSequence {
        val output = SpannableStringBuilder()
        var inCodeBlock = false
        var codeStart = -1
        markdown.replace("\r\n", "\n").lines().forEachIndexed { index, rawLine ->
            if (rawLine.trimStart().startsWith("```")) {
                if (inCodeBlock && codeStart >= 0) applyCodeBlock(output, codeStart, output.length)
                inCodeBlock = !inCodeBlock
                codeStart = if (inCodeBlock) output.length else -1
                return@forEachIndexed
            }
            val start = output.length
            when {
                inCodeBlock -> output.append(rawLine)
                rawLine.startsWith("### ") -> appendInline(output, rawLine.removePrefix("### "))
                rawLine.startsWith("## ") -> appendInline(output, rawLine.removePrefix("## "))
                rawLine.startsWith("# ") -> appendInline(output, rawLine.removePrefix("# "))
                rawLine.trimStart().startsWith(">") -> appendInline(output, rawLine.trimStart().removePrefix(">").trimStart())
                unorderedItem.matches(rawLine) -> {
                    output.append("• ")
                    appendInline(output, unorderedItem.matchEntire(rawLine)!!.groupValues[1])
                }
                orderedItem.matches(rawLine) -> {
                    val match = orderedItem.matchEntire(rawLine)!!
                    output.append("${match.groupValues[1]}. ")
                    appendInline(output, match.groupValues[2])
                }
                else -> appendInline(output, rawLine)
            }
            val end = output.length
            when {
                rawLine.startsWith("# ") -> applyHeading(output, start, end, 1.22f)
                rawLine.startsWith("## ") -> applyHeading(output, start, end, 1.14f)
                rawLine.startsWith("### ") -> applyHeading(output, start, end, 1.06f)
                rawLine.trimStart().startsWith(">") && end > start -> output.setSpan(
                    QuoteSpan(Color.rgb(118, 145, 200)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
                unorderedItem.matches(rawLine) || orderedItem.matches(rawLine) -> output.setSpan(
                    BulletSpan((density * 10).roundToInt(), Color.rgb(140, 171, 232)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
            }
            if (index < markdown.replace("\r\n", "\n").lines().lastIndex) output.append('\n')
        }
        if (inCodeBlock && codeStart >= 0) applyCodeBlock(output, codeStart, output.length)
        return output
    }

    private fun appendInline(output: SpannableStringBuilder, raw: String) {
        var cursor = 0
        while (cursor < raw.length) {
            when {
                raw.startsWith("**", cursor) -> {
                    val close = raw.indexOf("**", cursor + 2)
                    if (close > cursor + 2) {
                        val start = output.length
                        output.append(raw.substring(cursor + 2, close))
                        output.setSpan(StyleSpan(Typeface.BOLD), start, output.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        cursor = close + 2
                    } else {
                        output.append(raw[cursor++])
                    }
                }
                raw[cursor] == '`' -> {
                    val close = raw.indexOf('`', cursor + 1)
                    if (close > cursor + 1) {
                        val start = output.length
                        output.append(raw.substring(cursor + 1, close))
                        output.setSpan(TypefaceSpan(Typeface.MONOSPACE), start, output.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        output.setSpan(BackgroundColorSpan(Color.rgb(24, 31, 43)), start, output.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        cursor = close + 1
                    } else {
                        output.append(raw[cursor++])
                    }
                }
                raw[cursor] == '[' -> {
                    val match = link.find(raw, cursor)
                    if (match?.range?.first == cursor) {
                        val start = output.length
                        output.append(match.groupValues[1])
                        output.setSpan(UnderlineSpan(), start, output.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        output.setSpan(ForegroundColorSpan(Color.rgb(151, 188, 255)), start, output.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        cursor = match.range.last + 1
                    } else {
                        output.append(raw[cursor++])
                    }
                }
                else -> output.append(raw[cursor++])
            }
        }
    }

    private fun applyHeading(output: SpannableStringBuilder, start: Int, end: Int, scale: Float) {
        if (end <= start) return
        output.setSpan(StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        output.setSpan(RelativeSizeSpan(scale), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        output.setSpan(ForegroundColorSpan(Color.WHITE), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

    private fun applyCodeBlock(output: SpannableStringBuilder, start: Int, end: Int) {
        if (end <= start) return
        output.setSpan(TypefaceSpan(Typeface.MONOSPACE), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        output.setSpan(BackgroundColorSpan(Color.rgb(24, 31, 43)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        output.setSpan(ForegroundColorSpan(Color.rgb(218, 229, 250)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
}
