/**
 * 교사가 읽는 화학식·이온식·전자배치를 글꼴 의존성 없이 유니코드 아래첨자·위첨자로 통일한다.
 * 원문은 바꾸지 않고 화면·문서 생성 직전에만 적용해 검색과 검수 기록의 원형을 보존한다.
 */
const subscript: Record<string, string> = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
const superscript: Record<string, string> = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" };

const subscriptDigits = (digits: string) => digits.split("").map(digit => subscript[digit] ?? digit).join("");
const superscriptCharacters = (characters: string) => characters.split("").map(character => superscript[character] ?? character).join("");

/** LaTex 표기와 H2O·Na+ 같은 일반 텍스트 표기를 모두 교사용 읽기 표기로 바꾼다. */
export function formatScienceNotation(value: string): string {
  return String(value ?? "")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\delta\^\{?([+-])\}?/g, (_match, sign: string) => sign === "+" ? "δ⁺" : "δ⁻")
    .replace(/\\circ/g, "°")
    .replace(/_\{?([0-9]+)\}?/g, (_match, digits: string) => subscriptDigits(digits))
    .replace(/\^\{?([0-9+-]+)\}?/g, (_match, characters: string) => superscriptCharacters(characters))
    // 원소 기호가 둘 이상 이어지고 바로 숫자가 붙은 경우만 화학식으로 판단해 일반 문장의 숫자를 보존한다.
    .replace(/\b(?:[A-Z][a-z]?\d*){2,}\b/g, formula => formula.replace(/([A-Z][a-z]?)(\d+)/g, (_match, symbol: string, digits: string) => `${symbol}${subscriptDigits(digits)}`))
    .replace(/\b((?:[A-Z][a-z]?\d*)+)([+-])(?=\s|$|[),.?!])/g, (_match, formula: string, charge: string) => `${formula.replace(/([A-Z][a-z]?)(\d+)/g, (_part: string, symbol: string, digits: string) => `${symbol}${subscriptDigits(digits)}`)}${superscriptCharacters(charge)}`)
    .replace(/\b(\d+[spdfg])(\d+)\b/g, (_match, orbital: string, digits: string) => `${orbital}${superscriptCharacters(digits)}`);
}
