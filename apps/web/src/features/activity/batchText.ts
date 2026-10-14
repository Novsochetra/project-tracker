import type { ActivityBatch } from '@tracker/shared';

export const batchProgressText = ({ done, total }: ActivityBatch): string =>
  `${done} of ${total} done`;

export const failedKeysText = ({ failedKeys }: ActivityBatch): string =>
  failedKeys.length > 0 ? `Not finished: ${failedKeys.join(', ')}` : '';

export const isBatchActive = ({ state }: ActivityBatch): boolean =>
  state === 'running' || state === 'waiting';
