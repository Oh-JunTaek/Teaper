package com.eunmastudio.teacherworkspace.export

import android.content.Context
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import com.eunmastudio.teacherworkspace.LocalQuestion
import com.eunmastudio.teacherworkspace.OutputPlanPolicy
import com.eunmastudio.teacherworkspace.ScienceNotation
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

enum class QuestionExportType(val label: String, val extension: String, val mimeType: String) {
    DOCX("시험지 DOCX", "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    PDF("인쇄용 PDF", "pdf", "application/pdf"),
}

/**
 * 승인 문항의 학생용 시험지를 앱 cacheDir에만 생성한다. 외부 저장소 권한과 공유 폴더 저장을 사용하지 않으며,
 * 공유 대상 앱에는 FileProvider URI로 읽기 권한만 일시 부여한다. 검수 상태·정답·해설은 학생용 결과에 넣지 않는다.
 */
class ApprovedQuestionExporter(private val context: Context) {
    fun export(question: LocalQuestion, type: QuestionExportType, includePoints: Boolean = false): File {
        val directory = File(context.cacheDir, "exports").apply { mkdirs() }
        val output = File(directory, "${safeFileStem(question.title)}.${type.extension}")
        when (type) {
            QuestionExportType.DOCX -> writeDocx(question, output, includePoints)
            QuestionExportType.PDF -> writePdf(question, output, includePoints)
        }
        return output
    }

    private fun writeDocx(question: LocalQuestion, file: File, includePoints: Boolean) {
        val documentParagraphs = buildList {
            add(ScienceNotation.format(question.title))
            add("")
            add(studentQuestionText(question.content, question.points, includePoints))
        }.flatMap { it.lineSequence().toList() }

        ZipOutputStream(FileOutputStream(file)).use { zip ->
            zip.writeEntry(
                "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                |<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                |<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                |<Default Extension="xml" ContentType="application/xml"/>
                |<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                |</Types>""".trimMargin(),
            )
            zip.writeEntry(
                "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                |<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                |<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
                |</Relationships>""".trimMargin(),
            )
            val paragraphs = documentParagraphs.joinToString(separator = "") { line ->
                "<w:p><w:r><w:t xml:space=\"preserve\">${xmlEscape(line)}</w:t></w:r></w:p>"
            }
            zip.writeEntry(
                "word/document.xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                |<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                |<w:body>$paragraphs<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
                |</w:document>""".trimMargin(),
            )
        }
    }

    private fun writePdf(question: LocalQuestion, file: File, includePoints: Boolean) {
        val document = PdfDocument()
        val allLines = listOf(ScienceNotation.format(question.title), "") + studentQuestionText(question.content, question.points, includePoints).lineSequence().toList()
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 12f }
        val margin = 48f
        val pageWidth = 595
        val pageHeight = 842
        var pageNumber = 1
        var page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
        var canvas = page.canvas
        var y = margin

        allLines.flatMap { wrapForPdf(it, paint, pageWidth - margin * 2) }.forEach { line ->
            if (y > pageHeight - margin) {
                drawStudentWatermark(canvas, pageWidth, pageHeight)
                document.finishPage(page)
                pageNumber += 1
                page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
                canvas = page.canvas
                y = margin
            }
            canvas.drawText(line, margin, y, paint)
            y += 20f
        }
        drawStudentWatermark(canvas, pageWidth, pageHeight)
        document.finishPage(page)
        FileOutputStream(file).use { document.writeTo(it) }
        document.close()
    }

    private fun ZipOutputStream.writeEntry(name: String, content: String) {
        putNextEntry(ZipEntry(name))
        write(content.toByteArray(Charsets.UTF_8))
        closeEntry()
    }

    private fun wrapForPdf(text: String, paint: Paint, width: Float): List<String> {
        if (text.isBlank()) return listOf("")
        val lines = mutableListOf<String>()
        var remaining = text.trim()
        while (remaining.isNotEmpty()) {
            val count = paint.breakText(remaining, true, width, null)
            val splitAt = if (count == remaining.length) count else remaining.lastIndexOf(' ', count).takeIf { it > 0 } ?: count
            lines += remaining.substring(0, splitAt).trimEnd()
            remaining = remaining.substring(splitAt).trimStart()
        }
        return lines
    }

    /** 생성 결과의 답·해설 구간을 제거하고, 선택한 경우 첫 문제 줄 끝에만 교사 지정 배점을 붙인다. */
    private fun studentQuestionText(content: String, points: Double?, includePoints: Boolean): String {
        val studentLines = content
        .lineSequence()
        .takeWhile { line ->
            val normalized = line.trim().replace("*", "")
            !normalized.startsWith("정답:") && !normalized.startsWith("해설:") &&
                !normalized.startsWith("[정답]") && !normalized.startsWith("[해설]")
        }
        .toMutableList()
        val point = if (includePoints) points?.let { " ［${it}점］" } ?: "" else ""
        val firstQuestionLine = studentLines.indexOfFirst { it.trim().isNotEmpty() }
        if (firstQuestionLine >= 0) studentLines[firstQuestionLine] = "${studentLines[firstQuestionLine]}$point"
        return ScienceNotation.format(studentLines.joinToString("\n").trim())
    }

    /** 기본 플랜의 표기는 학생용 PDF의 오른쪽 아래 여백에만 놓아 문항과 배점을 가리지 않는다. */
    private fun drawStudentWatermark(canvas: android.graphics.Canvas, pageWidth: Int, pageHeight: Int) {
        if (!OutputPlanPolicy.shouldShowStudentWatermark(context)) return
        val watermarkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 8f; color = android.graphics.Color.rgb(130, 130, 130); textAlign = Paint.Align.RIGHT }
        canvas.drawText("EunmaStudio", pageWidth - 48f, pageHeight - 24f, watermarkPaint)
    }

    private fun safeFileStem(value: String): String = value
        .replace(Regex("[^a-zA-Z0-9가-힣 _-]"), "_")
        .replace(Regex("\\s+"), "_")
        .take(80)
        .ifBlank { "approved-question" }

    private fun xmlEscape(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")
}
