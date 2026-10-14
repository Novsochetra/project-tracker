import { describe, expect, it } from 'vitest';
import { CHAT_ANSWER_IMAGES_MAX } from '../src/domain/chat';
import {
  ANSWER_IMAGE_PATH_MAX,
  answerImagePaths,
  withoutImageCards,
} from '../src/logic/answerImages';

const card = (path: string, ticks = '````') => `${ticks}image\npath: ${path}\n${ticks}`;

describe('answerImagePaths', () => {
  it('reads each image card in order', () => {
    const answer = `Here is the screen:\n\n${card('docs/home.png')}\n\nAnd settings:\n${card('/tmp/s.webp')}`;
    expect(answerImagePaths(answer)).toEqual(['docs/home.png', '/tmp/s.webp']);
  });

  it('takes a bare path, quotes and three backticks too', () => {
    const answer = ['```image', '  "shots/a b.png"  ', '```', '````Image', '`c.gif`', '````'];
    expect(answerImagePaths(answer.join('\n'))).toEqual(['shots/a b.png', 'c.gif']);
  });

  it('skips other code blocks, cards that never close and cards with no path', () => {
    const shown = ['````md', card('inside.png', '```'), '````'].join('\n');
    const empty = '````image\n\n````';
    expect(answerImagePaths(`${shown}\n${empty}\n\`\`\`ts\nx\n\`\`\``)).toEqual([]);
    expect(answerImagePaths('````image\npath: open.png')).toEqual([]);
  });

  it('keeps no overlong path and at most the limit of pictures', () => {
    expect(answerImagePaths(card('a'.repeat(ANSWER_IMAGE_PATH_MAX)))).toEqual([]);
    const many = Array.from({ length: CHAT_ANSWER_IMAGES_MAX + 3 }, (_, at) => card(`${at}.png`));
    expect(answerImagePaths(many.join('\n'))).toHaveLength(CHAT_ANSWER_IMAGES_MAX);
  });
});

describe('withoutImageCards', () => {
  it('leaves the words around the cards', () => {
    const answer = `Here it is:\n\n${card('a.png')}\n\nTap to zoom.`;
    expect(withoutImageCards(answer)).toBe('Here it is:\n\n\nTap to zoom.');
  });

  it('keeps an answer with no image card as it is, code and ticket cards too', () => {
    const answer = '```ts\nconst a = 1;\n```\n\n````ticket\ntitle: T\n---\nBody\n````\n';
    expect(withoutImageCards(answer)).toBe(answer);
  });

  it('reads a long answer of cards in linear time', () => {
    const answer = Array.from({ length: 20_000 }, () => card('a.png')).join('\n');
    const started = performance.now();
    expect(withoutImageCards(answer)).toBe('');
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
