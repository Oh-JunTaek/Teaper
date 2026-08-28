package com.eunmastudio.teacherworkspace

/** 화면·공유·PDF·DOCX를 만들기 직전에 화학식과 전자배치를 유니코드 아래첨자·위첨자로 통일한다. */
object ScienceNotation {
    private val subscript = mapOf('0' to '₀', '1' to '₁', '2' to '₂', '3' to '₃', '4' to '₄', '5' to '₅', '6' to '₆', '7' to '₇', '8' to '₈', '9' to '₉')
    private val superscript = mapOf('0' to '⁰', '1' to '¹', '2' to '²', '3' to '³', '4' to '⁴', '5' to '⁵', '6' to '⁶', '7' to '⁷', '8' to '⁸', '9' to '⁹', '+' to '⁺', '-' to '⁻')

    fun format(value: String): String {
        var text = value.replace(Regex("\\$([^$]+)\\$"), "$1")
            .replace(Regex("\\\\text\\{([^}]*)}"), "$1")
            .replace(Regex("\\\\delta\\^\\{?([+-])\\}?")) { if (it.groupValues[1] == "+") "δ⁺" else "δ⁻" }
            .replace("\\circ", "°")
            .replace(Regex("_\\{?([0-9]+)\\}?")) { toSubscript(it.groupValues[1]) }
            .replace(Regex("\\^\\{?([0-9+-]+)\\}?")) { toSuperscript(it.groupValues[1]) }
        text = text.replace(Regex("\\b(?:[A-Z][a-z]?\\d*){2,}\\b")) { formatBareFormula(it.value) }
        text = text.replace(Regex("\\b((?:[A-Z][a-z]?\\d*)+)([+-])(?=\\s|$|[),.?!])")) { "${formatBareFormula(it.groupValues[1])}${toSuperscript(it.groupValues[2])}" }
        return text.replace(Regex("\\b(\\d+[spdfg])(\\d+)\\b")) { "${it.groupValues[1]}${toSuperscript(it.groupValues[2])}" }
    }

    private fun formatBareFormula(value: String): String = value.replace(Regex("([A-Z][a-z]?)(\\d+)")) { "${it.groupValues[1]}${toSubscript(it.groupValues[2])}" }
    private fun toSubscript(value: String): String = value.map { subscript[it] ?: it }.joinToString("")
    private fun toSuperscript(value: String): String = value.map { superscript[it] ?: it }.joinToString("")
}
