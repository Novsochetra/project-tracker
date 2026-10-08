import { afterEach, describe, expect, it } from 'vitest';
import { inSight } from './inSight';

afterEach(() => {
  Reflect.deleteProperty(document, 'elementFromPoint');
  document.body.replaceChildren();
});

function note() {
  const element = document.createElement('div');
  element.innerHTML = '<span>late.png didn’t upload.</span>';
  document.body.append(element);
  return element;
}

describe('inSight', () => {
  it('sees an element whose middle is itself or inside it', () => {
    const element = note();
    document.elementFromPoint = () => element.firstElementChild;
    expect(inSight(element)).toBe(true);
  });

  it('does not see one covered there, or off the screen', () => {
    const element = note();
    document.elementFromPoint = () => document.body;
    expect(inSight(element)).toBe(false);
    document.elementFromPoint = () => null;
    expect(inSight(element)).toBe(false);
  });

  it('counts one as seen where the page has no layout to tell', () => {
    expect(inSight(note())).toBe(true);
  });
});
