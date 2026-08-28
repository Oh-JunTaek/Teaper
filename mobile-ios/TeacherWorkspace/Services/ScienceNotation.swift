import Foundation

/// 화면·공유 텍스트·PDF에 쓰기 직전 화학식과 전자배치를 글꼴 독립적인 유니코드 표기로 통일한다.
enum ScienceNotation {
    private static let subscripts = ["0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉"]
    private static let superscripts = ["0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻"]

    static func format(_ value: String) -> String {
        var result = value.replacingOccurrences(of: "$", with: "")
        result = replace(result, pattern: #"\\text\{([^}]*)\}"#) { match, source in source.substring(with: match.range(at: 1)) }
        result = replace(result, pattern: #"\\delta\^\{?([+-])\}?"#) { match, source in source.substring(with: match.range(at: 1)) == "+" ? "δ⁺" : "δ⁻" }
        result = result.replacingOccurrences(of: "\\circ", with: "°")
        result = replace(result, pattern: #"_\{?([0-9]+)\}?"#) { match, source in toSubscript(source.substring(with: match.range(at: 1))) }
        result = replace(result, pattern: #"\^\{?([0-9+-]+)\}?"#) { match, source in toSuperscript(source.substring(with: match.range(at: 1))) }
        result = replace(result, pattern: #"\b(?:[A-Z][a-z]?\d*){2,}\b"#) { match, source in formatBareFormula(source.substring(with: match.range)) }
        result = replace(result, pattern: #"\b((?:[A-Z][a-z]?\d*)+)([+-])(?=\s|$|[),.?!])"#) { match, source in "\(formatBareFormula(source.substring(with: match.range(at: 1))))\(toSuperscript(source.substring(with: match.range(at: 2))))" }
        return replace(result, pattern: #"\b(\d+[spdfg])(\d+)\b"#) { match, source in "\(source.substring(with: match.range(at: 1)))\(toSuperscript(source.substring(with: match.range(at: 2))))" }
    }

    private static func formatBareFormula(_ formula: String) -> String {
        replace(formula, pattern: #"([A-Z][a-z]?)(\d+)"#) { match, source in "\(source.substring(with: match.range(at: 1)))\(toSubscript(source.substring(with: match.range(at: 2))))" }
    }

    private static func toSubscript(_ digits: String) -> String { digits.map { subscripts[String($0)] ?? String($0) }.joined() }
    private static func toSuperscript(_ characters: String) -> String { characters.map { superscripts[String($0)] ?? String($0) }.joined() }

    private static func replace(_ value: String, pattern: String, transform: (NSTextCheckingResult, NSString) -> String) -> String {
        guard let expression = try? NSRegularExpression(pattern: pattern) else { return value }
        let source = value as NSString
        let matches = expression.matches(in: value, range: NSRange(location: 0, length: source.length))
        return matches.reversed().reduce(value) { current, match in
            guard let range = Range(match.range, in: current) else { return current }
            return current.replacingCharacters(in: range, with: transform(match, source))
        }
    }
}
