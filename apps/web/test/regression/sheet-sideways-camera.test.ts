import { describe, expect, it } from 'vitest';
import { edges, phoneRule } from './phoneCss';

// PT-110, from PT-84: a phone turned sideways keeps the phone layout, and its camera then sits at
// one side of the screen (iOS reports 47px at each side on an iPhone 13, 62px on an iPhone 17
// Pro). The bars, action sheets and the ticket and project screens kept clear of it, but bottom
// sheets (New ticket, capture, Statuses, Connect, Prompt, Report) put Cancel and their text under
// it. Upright both insets are 0, so the sheets must look as before.

const SHEET = 'overlays/Sheet.module.css';
const SIDEWAYS = 47;

// The px a padding comes to with both side insets at `inset`; the rules only add lengths.
function sidePadding(value: string | undefined, inset: number): number {
  const lengths = (value ?? '0px')
    .replace(/env\(safe-area-inset-(?:left|right), 0px\)/g, `${inset}px`)
    .match(/-?\d+(?:\.\d+)?px/g);
  return (lengths ?? []).reduce((sum, length) => sum + Number.parseFloat(length), 0);
}

const sides = (part: string): [number, number] => {
  const [, right, , left] = edges(phoneRule(SHEET, part).get('padding') ?? '0');
  return [left, right];
};

describe('regression: bottom sheets keep clear of a sideways phone’s camera', () => {
  it.each(['.header', '.body', '.footer'])('%s pads by the side insets on phones', (part) => {
    const phone = phoneRule(SHEET, `.phone ${part}`);
    const [left, right] = sides(part);
    expect(sidePadding(phone.get('padding-left'), 0)).toBe(left);
    expect(sidePadding(phone.get('padding-right'), 0)).toBe(right);
    expect(sidePadding(phone.get('padding-left'), SIDEWAYS)).toBe(left + SIDEWAYS);
    expect(sidePadding(phone.get('padding-right'), SIDEWAYS)).toBe(right + SIDEWAYS);
    expect(phone.get('padding-left')).toContain('safe-area-inset-left');
    expect(phone.get('padding-right')).toContain('safe-area-inset-right');
  });
});
