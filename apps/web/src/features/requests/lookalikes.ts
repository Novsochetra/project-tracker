// The scripts whose letters pass for Latin ones: Greek ο, Cyrillic а, Armenian օ, Cherokee Ꭺ,
// Lisu ꓑ, Coptic ⲟ.
const SCRIPTS = ['Greek', 'Cyrillic', 'Armenian', 'Cherokee', 'Lisu', 'Coptic'].map(
  (script) => new RegExp(`\\p{Script=${script}}`, 'u'),
);
const LATIN = /\p{Script=Latin}/u;
// Scripts written without spaces meet Latin inside a word (Tシャツ, ซื้อiPhone), and their letters
// pass for no Latin one; next to a Latin letter, a letter of any other script is marked.
const WITH_LATIN =
  /[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
// The few letters of those scripts that pass for o, marked only among Latin letters (gဝဝgle), so
// プロジェクト or 人口 beside Latin stays readable.
const ROUND = new Set('ဝㅇロﾛ口');
const OTHER_DIGIT = /(?![0-9])\p{Nd}/u;
// Math and letterlike symbols (𝚊, ℝ) name another file than a; other letters of no script, such as
// the long-vowel mark ー, are part of their words.
const noScriptLetter = (char: string): boolean =>
  /[\u{1D400}-\u{1D7FF}\u{2100}-\u{214F}]/u.test(char) && /\p{L}/u.test(char);
// Letters that pass for Latin ones, so a word made only of them reads as Latin (аррӏе.com), and the
// scripts that almost never name a file, whose every letter counts (ꓮꓑꓑꓡꓰ.com).
const PASSES_FOR_LATIN = new Set('асеһіјӏорԁԛѕухԝүАВЕКМНОРСТУХЅІЈԚԜҮοαρνικυχΑΒΕΖΗΙΚΜΝΟΡΤΥΧօսհոՕՍ');
const RARE = /[\p{Script=Cherokee}\p{Script=Lisu}\p{Script=Coptic}]/u;
const WORD = /[\p{L}\p{M}\p{N}]+/gu;
const TOKEN = /\S+/g;

const scriptOf = (char: string): number => SCRIPTS.findIndex((script) => script.test(char));
const inScripts = (char: string): boolean => scriptOf(char) >= 0;
const scriptCount = (word: string): number =>
  new Set([...word].map(scriptOf).filter((script) => script >= 0)).size;
const passesForLatin = (word: string): boolean =>
  [...word.matchAll(/\p{L}/gu)].every(
    ([letter]) => PASSES_FOR_LATIN.has(letter) || RARE.test(letter),
  );

const amongLatin = (word: string): boolean =>
  [...word.matchAll(/\p{L}/gu)].every(
    ([letter]) => LATIN.test(letter) || noScriptLetter(letter) || ROUND.has(letter),
  );

const inLatinWord =
  (round: boolean) =>
  (char: string): boolean =>
    !WITH_LATIN.test(char) ||
    OTHER_DIGIT.test(char) ||
    noScriptLetter(char) ||
    (round && ROUND.has(char));

// A word in one script, a Russian or Khmer file name, has none: a person reads it as what it is,
// unless its every letter passes for Latin and Latin letters stand beside it (`my-арр`).
function markOf(word: string, latinToken: boolean): (char: string) => boolean {
  if (LATIN.test(word)) return inLatinWord(amongLatin(word));
  const reads = scriptCount(word) > 1 || (latinToken && passesForLatin(word));
  return reads ? inScripts : () => false;
}

export function lookalikesOf(text: string): Set<number> {
  const marked = new Set<number>();
  for (const { 0: token, index: start } of text.matchAll(TOKEN)) {
    const latinToken = LATIN.test(token);
    for (const { 0: word, index } of token.matchAll(WORD)) {
      const mark = markOf(word, latinToken);
      let at = start + index;
      for (const char of word) {
        if (mark(char)) marked.add(at);
        at += char.length;
      }
    }
  }
  return marked;
}
