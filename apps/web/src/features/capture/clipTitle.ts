// Chinese, Japanese and Korean characters and emoji take about two Latin letters' width.
const WIDE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}\u3000-\u303f\uff01-\uff60\uffe0-\uffe6]/u;

const widthOf = (character: string): number => (WIDE.test(character) ? 2 : 1);

// Steps by code point, so an emoji or another character outside the BMP is never cut in half.
export function clipTitle(text: string, maxWidth: number): string {
  const characters = Array.from(text);
  const width = characters.reduce((sum, character) => sum + widthOf(character), 0);
  if (width <= maxWidth) return text;
  let room = maxWidth - 1;
  const kept: string[] = [];
  for (const character of characters) {
    room -= widthOf(character);
    if (room < 0) break;
    kept.push(character);
  }
  return `${kept.join('').trimEnd()}…`;
}
