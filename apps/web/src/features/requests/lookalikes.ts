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
// The few letters of those scripts that pass for o (gဝဝgle); only these, so their words stay
// readable.
const ROUND = new Set('ဝㅇロﾛ口');
const OTHER_DIGIT = /(?![0-9])\p{Nd}/u;
// A letter of no script, such as 𝚊 or ℝ, names another file than a; Latin-1's µ and ª stay.
const noScriptLetter = (char: string): boolean =>
  char > 'ÿ' && /\p{L}/u.test(char) && /\p{Script=Common}/u.test(char);
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

const inLatinWord = (char: string): boolean =>
  !WITH_LATIN.test(char) || OTHER_DIGIT.test(char) || noScriptLetter(char) || ROUND.has(char);

// A word in one script, a Russian or Khmer file name, has none: a person reads it as what it is,
// unless its every letter passes for Latin and Latin letters stand beside it (`my-арр`).
function markOf(word: string, latinToken: boolean): (char: string) => boolean {
  if (LATIN.test(word)) return inLatinWord;
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
