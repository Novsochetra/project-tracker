import type { Attachment } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { attachment } from '../../api/test/fixtures';
import { readableFiles, ticketFiles } from './readableFiles';

const A1 = attachment('a1');
const without = (field: keyof Attachment): Attachment => {
  const { [field]: _left, ...rest } = attachment(`no-${field}`);
  return rest as Attachment;
};

describe('readableFiles', () => {
  it('leaves out entries a tile cannot show and keeps the order of the rest', () => {
    const files = [
      null,
      A1,
      5,
      [A1],
      without('id'),
      without('mimeType'),
      without('fileName'),
      without('url'),
      { ...attachment('x'), id: 7 },
      attachment('a2'),
    ] as unknown as Attachment[];
    expect(readableFiles(files)).toEqual([A1, attachment('a2')]);
  });

  it('reads a list the tracker sent as something else as no files', () => {
    expect(readableFiles(null)).toEqual([]);
    expect(readableFiles({} as unknown as Attachment[])).toEqual([]);
  });
});

describe('ticketFiles', () => {
  it('takes the files that name no comment, also those without an activityId', () => {
    const own = attachment('own');
    const onComment = attachment('on-comment', { activityId: 'c1' });
    const noActivity = without('activityId');
    expect(ticketFiles([own, onComment, noActivity])).toEqual([own, noActivity]);
  });
});
