package com.eunmastudio.teacherworkspace.export

import android.content.Context
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import com.eunmastudio.teacherworkspace.LocalQuickQuiz
import java.io.File
import java.io.FileOutputStream

/** 승인한 쪽지시험 문항만 앱 캐시에 PDF로 만들며, 답·해설·개념·난이도는 절대 넣지 않는다. */
class QuickQuizPdfExporter(private val context: Context) {
    fun export(quiz: LocalQuickQuiz, approvedBlocks: List<String>, includePoints: Boolean): File {
        val file = File(context.cacheDir, "exports/approved-quick-quiz.pdf").apply { parentFile?.mkdirs() }
        val document = PdfDocument(); val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 12f }
        val margin = 48f; val width = 595; val height = 842; var pageNumber = 1
        var page = document.startPage(PdfDocument.PageInfo.Builder(width, height, pageNumber).create()); var canvas = page.canvas; var y = margin
        val lines = buildList {
            add("${quiz.subject} 쪽지시험"); add("")
            val approvedIndexes = quiz.questionReviewStatuses.mapIndexedNotNull { index, status -> index.takeIf { status == "승인" } }
            approvedBlocks.forEachIndexed { index, block ->
                val point = if (includePoints) quiz.questionPoints.getOrNull(approvedIndexes.getOrNull(index) ?: -1)?.let { " ［${it}점］" } ?: "" else ""
                add("${index + 1}. ${block.trim()}$point"); add("")
            }
        }
        lines.flatMap { wrap(it, paint, width - margin * 2) }.forEach { line ->
            if (y > height - margin) { document.finishPage(page); pageNumber += 1; page = document.startPage(PdfDocument.PageInfo.Builder(width, height, pageNumber).create()); canvas = page.canvas; y = margin }
            canvas.drawText(line, margin, y, paint); y += 20f
        }
        document.finishPage(page); FileOutputStream(file).use(document::writeTo); document.close(); return file
    }

    private fun wrap(text: String, paint: Paint, width: Float): List<String> {
        if (text.isBlank()) return listOf("")
        var remaining = text.trim(); val lines = mutableListOf<String>()
        while (remaining.isNotEmpty()) { val count = paint.breakText(remaining, true, width, null); val split = if (count == remaining.length) count else remaining.lastIndexOf(' ', count).takeIf { it > 0 } ?: count; lines += remaining.take(split).trimEnd(); remaining = remaining.drop(split).trimStart() }
        return lines
    }
}
