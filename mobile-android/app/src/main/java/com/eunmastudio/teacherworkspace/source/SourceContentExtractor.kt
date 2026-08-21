package com.eunmastudio.teacherworkspace.source

import android.content.Context
import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

data class SourceExtraction(
    val suggestedTitle: String,
    val suggestedExcerpt: String,
    val pageReferences: String? = null,
    val extractionNotice: String? = null,
    val imageCachePath: String? = null,
)

/**
 * 원본 파일은 기기 밖으로 보내지 않는다. PDF·텍스트는 로컬에서 읽고, 이미지는 앱 캐시에 복사해
 * 준비된 Gemma 모델로만 내용 확인을 요청할 수 있게 한다. 자동 추출 결과는 교사가 저장 전에 확인한다.
 */
class SourceContentExtractor(private val context: Context) {
    suspend fun extract(uri: Uri): SourceExtraction = withContext(Dispatchers.IO) {
        val title = displayName(uri)
        val mimeType = context.contentResolver.getType(uri).orEmpty()
        when {
            mimeType == "application/pdf" || title.endsWith(".pdf", ignoreCase = true) -> extractPdf(uri, title)
            mimeType.startsWith("text/") || title.endsWith(".txt", ignoreCase = true) -> extractText(uri, title)
            mimeType.startsWith("image/") -> SourceExtraction(
                suggestedTitle = title,
                suggestedExcerpt = "이미지 자료입니다. 모델 준비 후 ‘내용 읽기’를 실행하거나 핵심 내용·페이지·평가 요소를 직접 확인해 입력해 주세요.",
                extractionNotice = "이미지의 읽힌 내용은 원본과 반드시 대조해야 합니다.",
                imageCachePath = cacheImage(uri, title).absolutePath,
            )
            else -> SourceExtraction(
                suggestedTitle = title,
                suggestedExcerpt = "이 파일 형식은 자동으로 읽을 수 없습니다. 핵심 내용·쪽수·평가 요소를 직접 입력해 주세요.",
                extractionNotice = "원본 파일 위치만 앱에 기록했습니다.",
            )
        }
    }

    private fun extractText(uri: Uri, title: String): SourceExtraction {
        val content = context.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { reader ->
            buildString {
                val buffer = CharArray(4_096)
                var total = 0
                while (total < MAX_TEXT_CHARS) {
                    val read = reader.read(buffer, 0, minOf(buffer.size, MAX_TEXT_CHARS - total))
                    if (read <= 0) break
                    append(buffer, 0, read)
                    total += read
                }
            }
        }.orEmpty()
        return SourceExtraction(
            suggestedTitle = title,
            suggestedExcerpt = content.ifBlank { "내용을 읽지 못했습니다. 핵심 내용·쪽수·평가 요소를 직접 입력해 주세요." },
            extractionNotice = if (content.length >= MAX_TEXT_CHARS) "처음 ${MAX_TEXT_CHARS}자만 읽었습니다. 원본을 대조해 필요한 부분을 남겨 주세요." else "텍스트를 기기 안에서 읽었습니다. 저장 전 원본을 대조해 주세요.",
        )
    }

    private fun extractPdf(uri: Uri, title: String): SourceExtraction {
        PDFBoxResourceLoader.init(context)
        val input = context.contentResolver.openInputStream(uri)
            ?: return SourceExtraction(title, "PDF를 열 수 없습니다. 핵심 내용·쪽수·평가 요소를 직접 입력해 주세요.")
        input.use { stream ->
            PDDocument.load(stream).use { document ->
                val pageCount = document.numberOfPages
                val maximumPages = minOf(pageCount, MAX_PDF_PAGES)
                val extractor = PDFTextStripper().apply {
                    startPage = 1
                    endPage = maximumPages
                }
                val content = extractor.getText(document).trim().take(MAX_TEXT_CHARS)
                val pages = if (pageCount > maximumPages) "1–${maximumPages}쪽 (전체 ${pageCount}쪽 중 일부)" else "1–${pageCount}쪽"
                return SourceExtraction(
                    suggestedTitle = title,
                    suggestedExcerpt = content.ifBlank { "이 PDF에는 선택 가능한 텍스트가 없거나 읽을 수 없습니다. 페이지를 직접 확인해 핵심 내용을 입력해 주세요." },
                    pageReferences = pages,
                    extractionNotice = if (content.isBlank()) {
                        "이미지형 PDF일 수 있습니다. 원본 페이지를 열어 교사가 내용을 직접 대조해 주세요."
                    } else {
                        "PDF ${pages}의 텍스트를 기기 안에서 읽었습니다. 수식·첨자·도표는 원본과 대조해 주세요."
                    },
                )
            }
        }
    }

    private fun cacheImage(uri: Uri, title: String): File {
        val extension = title.substringAfterLast('.', "jpg").lowercase().take(8)
        val output = File(context.cacheDir, "source-images/${System.currentTimeMillis()}.$extension").apply { parentFile?.mkdirs() }
        context.contentResolver.openInputStream(uri)?.use { input -> output.outputStream().use { input.copyTo(it) } }
        return output
    }

    private fun displayName(uri: Uri): String = uri.lastPathSegment?.substringAfterLast('/')?.ifBlank { null } ?: "선택한 자료"

    private companion object {
        const val MAX_TEXT_CHARS = 60_000
        const val MAX_PDF_PAGES = 80
    }
}
