// The scripts whose letters pass for Latin ones: Cyrillic а, Greek ο, Armenian օ, Cherokee Ꭺ.
const SCRIPTS = ['Latin', 'Greek', 'Cyrillic', 'Armenian', 'Cherokee'].map(
  (script) => new RegExp(`\\p{Script=${script}}`, 'u'),
);
const WORD = /[\p{L}\p{M}\p{N}]+/gu;

const scriptOf = (char: string): number => SCRIPTS.findIndex((script) => script.test(char));

// Where a word mixes those scripts (`pаypal` with a Cyrillic а), each of its letters that isn't
// Latin, by its index in the text. A word in one script, a Russian or Khmer file name, has none:
// a person reads it as what it is.
export function lookalikesOf(text: string): Set<number> {
  const marked = new Set<number>();
  for (const { 0: word, index } of text.matchAll(WORD)) {
    const scripts = [...word].map(scriptOf);
    if (new Set(scripts.filter((script) => script >= 0)).size < 2) continue;
    let at = index;
    [...word].forEach((char, position) => {
      if ((scripts[position] ?? 0) > 0) marked.add(at);
      at += char.length;
    });
  }
  return marked;
}
