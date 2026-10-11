// The scripts whose letters pass for Latin ones: Greek ο, Cyrillic а, Armenian օ, Cherokee Ꭺ.
const SCRIPTS = ['Greek', 'Cyrillic', 'Armenian', 'Cherokee'].map(
  (script) => new RegExp(`\\p{Script=${script}}`, 'u'),
);
const LATIN = /\p{Script=Latin}/u;
// Scripts written without spaces meet Latin inside a word (Tシャツ, ซื้อiPhone), and their letters
// pass for no Latin one; next to a Latin letter, a letter of any other script is marked (Lisu ꓑ,
// Coptic ⲟ).
const WITH_LATIN =
  /[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
// Letters that pass for Latin ones, so a word made only of them reads as Latin (аррӏе.com).
const PASSES_FOR_LATIN = new Set('асеһіјӏорԁԛѕухԝүАВЕКМНОРСТУХЅІЈԚԜҮοαρνικυχΑΒΕΖΗΙΚΜΝΟΡΤΥΧօսհոՕՍ');
const WORD = /[\p{L}\p{M}\p{N}]+/gu;
const TOKEN = /\S+/g;

const scriptOf = (char: string): number => SCRIPTS.findIndex((script) => script.test(char));
const inScripts = (char: string): boolean => scriptOf(char) >= 0;
const scriptCount = (word: string): number =>
  new Set([...word].map(scriptOf).filter((script) => script >= 0)).size;
const passesForLatin = (word: string): boolean =>
  [...word.matchAll(/\p{L}/gu)].every(([letter]) => PASSES_FOR_LATIN.has(letter));

// A word in one script, a Russian or Khmer file name, has none: a person reads it as what it is,
// unless its every letter passes for Latin and Latin letters stand beside it (`my-арр`).
function markOf(word: string, latinToken: boolean): (char: string) => boolean {
  if (LATIN.test(word)) return (char) => !WITH_LATIN.test(char);
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
