import type { NavigationKind } from './routes';

interface Entry {
  key: string;
  path: string;
}

/** Mirrors the history entries seen in this session so back() knows what history.back() reveals. */
export class SessionHistory {
  private entries: Entry[] = [];
  private index = -1;

  record(key: string, path: string, kind: NavigationKind): void {
    const current = this.entries[this.index];
    if (current?.key === key) return;
    if (kind === 'PUSH' && current) {
      this.entries = [...this.entries.slice(0, this.index + 1), { key, path }];
      this.index += 1;
      return;
    }
    if (kind === 'REPLACE' && current) {
      this.entries[this.index] = { key, path };
      return;
    }
    const found = this.entries.findIndex((entry) => entry.key === key);
    if (found >= 0) {
      this.index = found;
      return;
    }
    this.entries = [{ key, path }];
    this.index = 0;
  }

  previousPath(): string | null {
    return this.entries[this.index - 1]?.path ?? null;
  }
}
