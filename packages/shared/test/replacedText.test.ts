import { describe, expect, it } from 'vitest';
import {
  descriptionReplacedText,
  replacedDescription,
  titleReplacedText,
} from '../src/logic/replacedText';

describe('titleReplacedText', () => {
  it('names the title it replaced', () => {
    expect(titleReplacedText('Crash on launch')).toBe('changed the title from “Crash on launch”');
  });
});

describe('descriptionReplacedText', () => {
  it('keeps the old description whole after the sentence', () => {
    expect(descriptionReplacedText('Steps:\n1. Open\n', 'Open it')).toBe(
      'changed the description\nSteps:\n1. Open\n',
    );
    expect(descriptionReplacedText('Steps', '  ')).toBe('removed the description\nSteps');
  });

  it('has nothing to keep when there was no description', () => {
    expect(descriptionReplacedText('', 'Open it')).toBe('added a description');
    expect(descriptionReplacedText(' \n', 'Open it')).toBe('added a description');
  });
});

describe('replacedDescription', () => {
  it('reads the sentence and the old description back', () => {
    expect(replacedDescription(descriptionReplacedText('a\n\nb', 'c'))).toEqual({
      sentence: 'changed the description',
      oldText: 'a\n\nb',
    });
    expect(replacedDescription(descriptionReplacedText('a', ''))).toEqual({
      sentence: 'removed the description',
      oldText: 'a',
    });
  });

  it('leaves every other event alone', () => {
    for (const text of [
      'added a description',
      'changed the description',
      'changed status to Done',
      titleReplacedText('Crash\nchanged the description'),
      'changed the description from a report\nmore',
    ]) {
      expect(replacedDescription(text), text).toBeNull();
    }
  });
});
