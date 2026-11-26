import type { SearchMatch } from '../api/search';
import { MAX_TICKET_NUMBER } from './ticketKey';

// More words than this narrow a search no further in practice, and each adds LIKEs to the query.
export const SEARCH_TERMS_MAX = 5;
const SNIPPET_RADIUS = 48;

export function searchTerms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return [...new Set(words)].slice(0, SEARCH_TERMS_MAX);
}

export interface KeyQuery {
  projectKey: string | null;
  num: number;
}

const toNum = (digits: string): number | null => {
  const num = Number.parseInt(digits, 10);
  return num >= 1 && num <= MAX_TICKET_NUMBER ? num : null;
};

// "PT-12", "pt 12", "pt12" name one ticket; "12" or "#12" a number in any project.
export function parseKeyQuery(query: string): KeyQuery | null {
  const text = query.trim();
  const bare = /^#?(\d+)$/.exec(text);
  if (bare?.[1]) {
    const num = toNum(bare[1]);
    return num === null ? null : { projectKey: null, num };
  }
  const keyed = /^([A-Za-z0-9]+?)(?:[\s-]+|(?<=[A-Za-z])(?=\d))(\d+)$/.exec(text);
  if (!keyed?.[1] || !keyed[2]) return null;
  const num = toNum(keyed[2]);
  return num === null ? null : { projectKey: keyed[1].toUpperCase(), num };
}

export const LIKE_ESCAPE = '\\';

export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (char) => `\\${char}`);

export const containsPattern = (term: string): string => `%${escapeLike(term)}%`;

export function searchMatchOf(
  title: string,
  terms: readonly string[],
  keyHit: boolean,
): SearchMatch {
  if (keyHit) return 'key';
  if (terms.length === 0) return 'recent';
  const lower = title.toLowerCase();
  return terms.every((term) => lower.includes(term)) ? 'title' : 'description';
}

function firstHit(lower: string, terms: readonly string[]): { index: number; length: number } {
  let best = { index: -1, length: 0 };
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index >= 0 && (best.index < 0 || index < best.index)) best = { index, length: term.length };
  }
  return best;
}

// A line of the description around its first matching word, so the row shows why it matched.
export function searchSnippet(text: string, terms: readonly string[]): string | null {
  const flat = text.replace(/\s+/g, ' ').trim();
  const hit = firstHit(flat.toLowerCase(), terms);
  if (hit.index < 0) return null;
  const start = Math.max(0, hit.index - SNIPPET_RADIUS);
  const end = Math.min(flat.length, hit.index + hit.length + SNIPPET_RADIUS * 2);
  const head = start > 0 ? '…' : '';
  const tail = end < flat.length ? '…' : '';
  return `${head}${flat.slice(start, end).trim()}${tail}`;
}
