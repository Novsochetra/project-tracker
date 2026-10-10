import { ApiError } from '@tracker/client';
import { describe, expect, it } from 'vitest';
import { isSettledElsewhere } from './answerRefusal';

const refusal = (status: number) => new ApiError(status, 'conflict', 'This was already answered.');

describe('isSettledElsewhere', () => {
  it('takes a 409 as an answer that is no longer needed', () => {
    expect(isSettledElsewhere(refusal(409))).toBe(true);
  });

  it('keeps every other failure an error to show, a gone run too', () => {
    expect(isSettledElsewhere(refusal(404))).toBe(false);
    expect(isSettledElsewhere(refusal(400))).toBe(false);
    expect(isSettledElsewhere(refusal(500))).toBe(false);
    expect(isSettledElsewhere(new TypeError('Failed to fetch'))).toBe(false);
  });
});
