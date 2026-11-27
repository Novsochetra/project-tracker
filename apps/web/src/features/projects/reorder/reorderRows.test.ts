import { describe, expect, it } from 'vitest';
import { settleRows, shownTops, type RowElements } from './reorderRows';

interface FakeRow {
  id: string;
  top: number;
  written: string[];
}

// A row that records each transform written to it and is read where `top` says.
function fakeRow(row: FakeRow): HTMLElement {
  const style = {
    set transform(value: string) {
      row.written.push(value);
    },
    get transform() {
      return row.written.at(-1) ?? '';
    },
  };

  return {
    style,
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
    getBoundingClientRect: () => ({ top: row.top }),
  } as unknown as HTMLElement;
}

function fakeRows(tops: Record<string, number>) {
  const fakes = Object.entries(tops).map(([id, top]) => ({ id, top, written: [] as string[] }));
  const rows: RowElements = new Map(fakes.map((fake) => [fake.id, fakeRow(fake)]));

  return { rows, fakes: new Map(fakes.map((fake) => [fake.id, fake])) };
}

describe('settleRows', () => {
  it('starts each row where it was shown, read the given way, and lets it glide home', () => {
    const { rows, fakes } = fakeRows({ a: 100, b: 144 });
    const groupTop = 100;
    const topOf = (row: HTMLElement) => row.getBoundingClientRect().top - groupTop;
    const shown = shownTops(rows, topOf);
    fakes.get('a')!.top = 144;
    fakes.get('b')!.top = 100;

    settleRows(rows, shown, true, topOf);

    expect(fakes.get('a')?.written).toEqual(['', 'translate3d(0, -44px, 0)', '']);
    expect(fakes.get('b')?.written).toEqual(['', 'translate3d(0, 44px, 0)', '']);
  });

  it('leaves a row that was not shown, and every row without a glide, in its place', () => {
    const { rows, fakes } = fakeRows({ a: 0, b: 44 });
    fakes.get('a')!.top = 44;

    settleRows(rows, new Map([['a', 0]]), true);
    settleRows(rows, new Map([['a', 0]]), false);

    expect(fakes.get('b')?.written).toEqual(['', '']);
    expect(fakes.get('a')?.written).toEqual(['', 'translate3d(0, -44px, 0)', '', '']);
  });
});
